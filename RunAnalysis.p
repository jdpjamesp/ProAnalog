/*------------------------------------------------------------------------
    File        : RunAnalysis.p
    Purpose     : Command-line entry point. Reads input.json, calls the
                  configured LLM provider, and writes output.html using
                  output.template.html. Then opens output.html.
    Usage       : _progres -b -p ProAnalog\RunAnalysis.p
  ----------------------------------------------------------------------*/

BLOCK-LEVEL ON ERROR UNDO, THROW.

USING Config.AppConfig             FROM PROPATH.
USING Session.ConversationSession  FROM PROPATH.
USING Progress.Json.ObjectModel.*  FROM PROPATH.
USING System.Diagnostics.Process   FROM ASSEMBLY.
USING System.IO.StreamReader       FROM ASSEMBLY.
USING System.IO.StreamWriter       FROM ASSEMBLY.
USING System.Text.StringBuilder    FROM ASSEMBLY.

/* ------------------------------------------------------------------ */

DEFINE VARIABLE oConfig       AS AppConfig           NO-UNDO.
DEFINE VARIABLE oSession      AS ConversationSession NO-UNDO.
DEFINE VARIABLE oParser       AS ObjectModelParser   NO-UNDO.
DEFINE VARIABLE oDoc          AS JsonObject          NO-UNDO.
DEFINE VARIABLE oFiles        AS JsonArray           NO-UNDO.
DEFINE VARIABLE oHistory      AS JsonArray           NO-UNDO.
DEFINE VARIABLE oReader       AS StreamReader        NO-UNDO.
DEFINE VARIABLE oWriter       AS StreamWriter        NO-UNDO.
DEFINE VARIABLE oSb           AS StringBuilder       NO-UNDO.
DEFINE VARIABLE cBaseDir      AS CHARACTER           NO-UNDO.
DEFINE VARIABLE cInputPath    AS CHARACTER           NO-UNDO.
DEFINE VARIABLE cOutputPath   AS CHARACTER           NO-UNDO.
DEFINE VARIABLE cTemplatePath AS CHARACTER           NO-UNDO.
DEFINE VARIABLE cMode         AS CHARACTER           NO-UNDO.
DEFINE VARIABLE cPrompt       AS CHARACTER           NO-UNDO.
DEFINE VARIABLE cFilePaths    AS CHARACTER           NO-UNDO.
DEFINE VARIABLE cResponse     AS CHARACTER           NO-UNDO.
DEFINE VARIABLE cHistoryJson  AS CHARACTER           NO-UNDO.
DEFINE VARIABLE cJson         AS CHARACTER           NO-UNDO.
DEFINE VARIABLE cFilePath     AS CHARACTER           NO-UNDO.
DEFINE VARIABLE cLine         AS CHARACTER           NO-UNDO.
DEFINE VARIABLE i             AS INTEGER             NO-UNDO.

/* ------------------------------------------------------------------ */
/* Path resolution                                                     */
/* ------------------------------------------------------------------ */

FILE-INFO:FILE-NAME = THIS-PROCEDURE:FILE-NAME.
cBaseDir = System.IO.Path:GetDirectoryName(
    IF FILE-INFO:FULL-PATHNAME <> ? THEN FILE-INFO:FULL-PATHNAME
    ELSE THIS-PROCEDURE:FILE-NAME).

cInputPath    = System.IO.Path:Combine(cBaseDir, "input.json").
cOutputPath   = System.IO.Path:Combine(cBaseDir, "output.html").
cTemplatePath = System.IO.Path:Combine(cBaseDir, "output.template.html").

/* ------------------------------------------------------------------ */
/* Read and parse input.json                                           */
/* ------------------------------------------------------------------ */

FILE-INFO:FILE-NAME = cInputPath.
IF FILE-INFO:FULL-PATHNAME = ? THEN
    UNDO, THROW NEW Progress.Lang.AppError(
        SUBSTITUTE("input.json not found at &1 — run index.html first.", cInputPath), 0).

oReader = NEW StreamReader(cInputPath, System.Text.Encoding:UTF8).
oSb     = NEW StringBuilder().
DO WHILE NOT oReader:EndOfStream:
    oSb:AppendLine(oReader:ReadLine()).
END.
oReader:Close().
oReader = ?.

cJson   = oSb:ToString().
oParser = NEW ObjectModelParser().
oDoc    = CAST(oParser:Parse(cJson), JsonObject).

cMode   = oDoc:GetCharacter("mode").
cPrompt = oDoc:GetCharacter("prompt").

/* ------------------------------------------------------------------ */
/* Initialise session and load context                                 */
/* ------------------------------------------------------------------ */

oConfig  = NEW AppConfig().
oSession = NEW ConversationSession(oConfig).

IF cMode = "initial" THEN DO:

    oFiles = CAST(oDoc:GetJsonArray("files"), JsonArray).

    DO i = 1 TO oFiles:Length:
        cFilePath = oFiles:GetCharacter(i).
        FILE-INFO:FILE-NAME = cFilePath.
        IF FILE-INFO:FULL-PATHNAME = ? THEN
            UNDO, THROW NEW Progress.Lang.AppError(
                SUBSTITUTE("Log file not found: &1", cFilePath), 0).
        cFilePaths = cFilePaths
            + (IF cFilePaths = "" THEN "" ELSE CHR(1))
            + cFilePath.
    END.

    oSession:LoadFiles(cFilePaths).

END.
ELSE IF cMode = "followup" THEN DO:

    oHistory = CAST(oDoc:GetJsonArray("history"), JsonArray).
    oSession:LoadHistory(oHistory).

END.
ELSE
    UNDO, THROW NEW Progress.Lang.AppError(
        SUBSTITUTE("Unknown mode '&1' — expected 'initial' or 'followup'.", cMode), 0).

/* ------------------------------------------------------------------ */
/* Ask the question                                                    */
/* ------------------------------------------------------------------ */

MESSAGE "Sending request to" oSession:ProviderLabel "...".

cResponse    = oSession:Ask(cPrompt).
cHistoryJson = oSession:GetHistoryJson().

/* Prevent </script> in embedded JSON from breaking the HTML parser */
cHistoryJson = REPLACE(cHistoryJson, "</script>", "<\/script>").

/* ------------------------------------------------------------------ */
/* Write output.html from template                                     */
/* ------------------------------------------------------------------ */

FILE-INFO:FILE-NAME = cTemplatePath.
IF FILE-INFO:FULL-PATHNAME = ? THEN
    UNDO, THROW NEW Progress.Lang.AppError(
        SUBSTITUTE("Template not found: &1", cTemplatePath), 0).

oReader = NEW StreamReader(cTemplatePath, System.Text.Encoding:UTF8).
oWriter = NEW StreamWriter(cOutputPath, FALSE, System.Text.Encoding:UTF8).

DO WHILE NOT oReader:EndOfStream:
    cLine = oReader:ReadLine().
    IF INDEX(cLine, "%%QUESTION_JS%%") > 0 THEN
        cLine = REPLACE(cLine, "%%QUESTION_JS%%", JsString(cPrompt)).
    IF INDEX(cLine, "%%HISTORY_JSON%%") > 0 THEN
        cLine = REPLACE(cLine, "%%HISTORY_JSON%%", cHistoryJson).
    oWriter:WriteLine(cLine).
END.

oReader:Close().
oWriter:Close().

MESSAGE "Done. Opening" cOutputPath.

/* Auto-open in default browser */
DO ON ERROR UNDO:
    Process:Start(cOutputPath).
    CATCH oe AS Progress.Lang.Error:
        MESSAGE "Could not auto-open output.html:" oe:GetMessage(1)
                "~nPlease open it manually:" cOutputPath.
    END CATCH.
END.

/* ------------------------------------------------------------------ */
/* Internal function: escape a string for a JS double-quoted literal  */
/* and wrap it in double quotes ready to assign to a JS const.        */
/* ------------------------------------------------------------------ */

FUNCTION JsString RETURNS CHARACTER (INPUT pcText AS CHARACTER):

    pcText = REPLACE(pcText, "~\",   "~\~\").
    pcText = REPLACE(pcText, '"',    '~\"').
    pcText = REPLACE(pcText, "~n",   "\n").
    pcText = REPLACE(pcText, "~r",   "\r").
    pcText = REPLACE(pcText, "~t",   "\t").
    pcText = REPLACE(pcText, "</",   "<\/").

    RETURN '"' + pcText + '"'.

END FUNCTION.
