/*------------------------------------------------------------------------
    File        : LogDetector/LogDetectorService.cls
    Purpose     : Samples the first N lines of a file and matches them
                  against registered LogFormat detection patterns to
                  identify the log type.
    Syntax      : LogDetector.LogDetectorService
    Notes       : Uses .NET System.Text.RegularExpressions for pattern
                  matching. Returns the first matching LogFormat from the
                  registry. If no format matches, returns an "Unknown"
                  LogFormat with generic context.
  ----------------------------------------------------------------------*/

BLOCK-LEVEL ON ERROR UNDO, THROW.

USING LogDetector.*                        FROM PROPATH.
USING System.Text.RegularExpressions.Regex FROM ASSEMBLY.
USING System.IO.StreamReader               FROM ASSEMBLY.

CLASS LogDetector.LogDetectorService:

    /* Number of lines to sample from the top of each file */
    DEFINE PRIVATE STATIC VARIABLE SAMPLE-LINES AS INTEGER INITIAL 50 NO-UNDO.

    DEFINE PRIVATE VARIABLE oRegistry AS LogFormatRegistry NO-UNDO.

    /*--------------------------------------------------------------------*/

    CONSTRUCTOR PUBLIC LogDetectorService():
        oRegistry = NEW LogFormatRegistry().
    END CONSTRUCTOR.

    CONSTRUCTOR PUBLIC LogDetectorService(INPUT poRegistry AS LogFormatRegistry):
        oRegistry = poRegistry.
    END CONSTRUCTOR.

    /*--------------------------------------------------------------------*/
    /* Main entry point. Accepts a file path and returns the best         */
    /* matching LogFormat, or an "Unknown" format if none match.          */
    /*--------------------------------------------------------------------*/

    METHOD PUBLIC LogFormat DetectFormat(INPUT pcFilePath AS CHARACTER):

        DEFINE VARIABLE oFormats  AS LogFormat EXTENT NO-UNDO.
        DEFINE VARIABLE oFmt      AS LogFormat        NO-UNDO.
        DEFINE VARIABLE cSample   AS CHARACTER        NO-UNDO.
        DEFINE VARIABLE cPatterns AS CHARACTER        NO-UNDO.
        DEFINE VARIABLE cPattern  AS CHARACTER        NO-UNDO.
        DEFINE VARIABLE i         AS INTEGER          NO-UNDO.
        DEFINE VARIABLE j         AS INTEGER          NO-UNDO.
        DEFINE VARIABLE iCount    AS INTEGER          NO-UNDO.

        IF NOT System.IO.File:Exists(pcFilePath) THEN
            UNDO, THROW NEW Progress.Lang.AppError(
                SUBSTITUTE("File not found: &1", pcFilePath), 0).

        cSample  = THIS-OBJECT:ReadSample(pcFilePath).
        oFormats = oRegistry:GetFormats().
        iCount   = EXTENT(oFormats).

        DO i = 1 TO iCount:
            oFmt      = oFormats[i].
            cPatterns = oFmt:DetectionPatterns.

            DO j = 1 TO NUM-ENTRIES(cPatterns, CHR(1)):
                cPattern = ENTRY(j, cPatterns, CHR(1)).
                IF TRIM(cPattern) = "" THEN NEXT.

                IF Regex:IsMatch(cSample, cPattern,
                        System.Text.RegularExpressions.RegexOptions:Multiline) THEN
                    RETURN oFmt.
            END.
        END.

        /* No match — return a generic unknown format */
        RETURN THIS-OBJECT:UnknownFormat(pcFilePath).

    END METHOD.

    /*--------------------------------------------------------------------*/
    /* Reads up to SAMPLE-LINES lines from the file and returns them      */
    /* as a single string (newline-delimited) for regex matching.         */
    /*--------------------------------------------------------------------*/

    METHOD PRIVATE CHARACTER ReadSample(INPUT pcFilePath AS CHARACTER):

        DEFINE VARIABLE oReader AS StreamReader NO-UNDO.
        DEFINE VARIABLE cLine   AS CHARACTER    NO-UNDO.
        DEFINE VARIABLE cResult AS CHARACTER    NO-UNDO.
        DEFINE VARIABLE i       AS INTEGER      NO-UNDO.

        oReader = NEW StreamReader(pcFilePath).

        DO WHILE NOT oReader:EndOfStream AND i < SAMPLE-LINES:
            cLine   = oReader:ReadLine().
            cResult = cResult + cLine + "~n".
            i       = i + 1.
        END.

        oReader:Close().
        oReader:Dispose().

        RETURN cResult.

    END METHOD.

    /*--------------------------------------------------------------------*/
    /* Builds a generic LogFormat for files whose type cannot be          */
    /* determined from the sample lines.                                  */
    /*--------------------------------------------------------------------*/

    METHOD PRIVATE LogFormat UnknownFormat(INPUT pcFilePath AS CHARACTER):

        DEFINE VARIABLE cName AS CHARACTER NO-UNDO.

        cName = System.IO.Path:GetFileName(pcFilePath).

        RETURN NEW LogFormat(
            SUBSTITUTE("Unknown Log (&1)", cName),
            SUBSTITUTE("The attached file '&1' is a log file whose format could not be " +
                "automatically identified. Please use your best judgement when analysing " +
                "its contents. Look for recurring patterns such as timestamps, severity " +
                "levels, or process identifiers to understand the structure.", cName),
            "").

    END METHOD.

END CLASS.
