/*------------------------------------------------------------------------
    File        : Session/ConversationSession.cls
    Purpose     : Orchestrates a full log analysis session. Accepts one or
                  more log files, detects their formats, builds a system
                  prompt, manages the conversation history, and delegates
                  API calls to the configured LLM provider.
    Syntax      : Session.ConversationSession
  ----------------------------------------------------------------------*/

BLOCK-LEVEL ON ERROR UNDO, THROW.

USING Chunker.FileChunker              FROM PROPATH.
USING Config.AppConfig                 FROM PROPATH.
USING LLM.*                            FROM PROPATH.
USING LogDetector.*                    FROM PROPATH.
USING Progress.Json.ObjectModel.*      FROM PROPATH.

CLASS Session.ConversationSession:

    DEFINE PRIVATE VARIABLE oConfig    AS AppConfig          NO-UNDO.
    DEFINE PRIVATE VARIABLE oProvider  AS ILLMProvider       NO-UNDO.
    DEFINE PRIVATE VARIABLE oDetector  AS LogDetectorService NO-UNDO.
    DEFINE PRIVATE VARIABLE oChunker   AS FileChunker        NO-UNDO.

    /* Ordered message history for the current conversation */
    DEFINE PRIVATE TEMP-TABLE ttMsg NO-UNDO
        FIELD iSeq    AS INTEGER
        FIELD cRole   AS CHARACTER
        FIELD cContent AS CHARACTER
        INDEX ixSeq IS PRIMARY UNIQUE iSeq.

    DEFINE PRIVATE VARIABLE iNextMsg AS INTEGER NO-UNDO INITIAL 0.

    /* Files loaded into this session */
    DEFINE PRIVATE TEMP-TABLE ttFile NO-UNDO
        FIELD cPath       AS CHARACTER
        FIELD cFormatName AS CHARACTER
        INDEX ixPath IS PRIMARY UNIQUE cPath.

    /* TRUE once LoadFiles() has been called */
    DEFINE PUBLIC PROPERTY IsLoaded AS LOGICAL NO-UNDO
        GET. PRIVATE SET.

    /* Provider label for display in the UI status bar */
    DEFINE PUBLIC PROPERTY ProviderLabel AS CHARACTER NO-UNDO
        GET:
            RETURN oProvider:GetLabel().
        END GET.

    /* Number of files loaded */
    DEFINE PUBLIC PROPERTY FileCount AS INTEGER NO-UNDO
        GET:
            DEFINE VARIABLE i AS INTEGER NO-UNDO.
            FOR EACH ttFile NO-LOCK: i = i + 1. END.
            RETURN i.
        END GET.

    /*--------------------------------------------------------------------*/

    CONSTRUCTOR PUBLIC ConversationSession(INPUT poConfig AS AppConfig):
        oConfig   = poConfig.
        oProvider = LLMProviderFactory:Create(poConfig).
        oDetector = NEW LogDetectorService().
        oChunker  = NEW FileChunker(poConfig:ChunkSizeChars).
    END CONSTRUCTOR.

    /*--------------------------------------------------------------------*/
    /* Load one or more log files. Detects each file's format, builds the */
    /* system prompt, and optionally embeds small files directly.         */
    /* pcFilePaths is a CHR(1)-delimited list of file paths.              */
    /* Returns a CHR(1)-delimited list of detected format names.          */
    /*--------------------------------------------------------------------*/

    METHOD PUBLIC CHARACTER LoadFiles(INPUT pcFilePaths AS CHARACTER):

        DEFINE VARIABLE oFmt        AS LogFormat NO-UNDO.
        DEFINE VARIABLE cPath       AS CHARACTER NO-UNDO.
        DEFINE VARIABLE cSystemPrompt AS CHARACTER NO-UNDO.
        DEFINE VARIABLE cFormatNames  AS CHARACTER NO-UNDO.
        DEFINE VARIABLE iFiles      AS INTEGER   NO-UNDO.
        DEFINE VARIABLE i           AS INTEGER   NO-UNDO.
        DEFINE VARIABLE iChunks     AS INTEGER   NO-UNDO.
        DEFINE VARIABLE j           AS INTEGER   NO-UNDO.
        DEFINE VARIABLE cChunkText  AS CHARACTER NO-UNDO.

        EMPTY TEMP-TABLE ttMsg.
        EMPTY TEMP-TABLE ttFile.
        iNextMsg = 0.
        IsLoaded = FALSE.

        iFiles = NUM-ENTRIES(pcFilePaths, CHR(1)).

        /* Build format context for each file */
        cSystemPrompt =
            "You are ProAnalog, an expert assistant specialising in Progress OpenEdge " +
            "application diagnostics. The user has provided one or more log files for " +
            "analysis. The format of each file is described below. Use this context " +
            "when answering the user's questions — do not ask for clarification about " +
            "the log format as it has already been provided.~n~n".

        DO i = 1 TO iFiles:
            cPath = TRIM(ENTRY(i, pcFilePaths, CHR(1))).
            IF cPath = "" THEN NEXT.

            oFmt = oDetector:DetectFormat(cPath).

            CREATE ttFile.
            ASSIGN
                ttFile.cPath       = cPath
                ttFile.cFormatName = oFmt:Name.

            cSystemPrompt = cSystemPrompt +
                SUBSTITUTE("--- File &1: &2 ---~n&3~n~n",
                    i,
                    System.IO.Path:GetFileName(cPath),
                    oFmt:Context).

            cFormatNames = (IF cFormatNames = "" THEN "" ELSE cFormatNames + CHR(1))
                         + oFmt:Name.
        END.

        /* Add the system message */
        THIS-OBJECT:AppendMessage("system", cSystemPrompt).

        /* Embed file content as user messages.                            */
        /* Large files are chunked; each chunk is a separate user message  */
        /* prefixed with a header so the LLM understands the structure.    */
        DO i = 1 TO iFiles:
            cPath = TRIM(ENTRY(i, pcFilePaths, CHR(1))).
            IF cPath = "" THEN NEXT.

            FIND FIRST ttFile WHERE ttFile.cPath = cPath NO-LOCK NO-ERROR.

            iChunks = oChunker:ChunkFile(cPath).

            IF iChunks = 1 THEN DO:
                THIS-OBJECT:AppendMessage("user",
                    SUBSTITUTE("[Log file: &1 (&2)]~n~n&3",
                        System.IO.Path:GetFileName(cPath),
                        ttFile.cFormatName,
                        oChunker:GetChunk(1))).
            END.
            ELSE DO:
                DO j = 1 TO iChunks:
                    cChunkText = oChunker:GetChunk(j).
                    THIS-OBJECT:AppendMessage("user",
                        SUBSTITUTE("[Log file: &1 (&2) — chunk &3 of &4]~n~n&5",
                            System.IO.Path:GetFileName(cPath),
                            ttFile.cFormatName,
                            j,
                            iChunks,
                            cChunkText)).
                END.
            END.
        END.

        IsLoaded = TRUE.
        RETURN cFormatNames.

    END METHOD.

    /*--------------------------------------------------------------------*/
    /* Send a user question and return the LLM's response.                */
    /* Maintains full conversation history across multiple turns.         */
    /*--------------------------------------------------------------------*/

    METHOD PUBLIC CHARACTER Ask(INPUT pcQuestion AS CHARACTER):

        DEFINE VARIABLE oMessages AS LLMMessage EXTENT NO-UNDO.
        DEFINE VARIABLE cResponse AS CHARACTER         NO-UNDO.

        IF NOT IsLoaded THEN
            UNDO, THROW NEW Progress.Lang.AppError(
                "No log files loaded. Call LoadFiles() before Ask().", 0).

        /* Add the user's question to history */
        THIS-OBJECT:AppendMessage("user", pcQuestion).

        /* Build the full message array for the API call */
        oMessages = THIS-OBJECT:BuildMessageArray().

        /* Call the provider */
        cResponse = oProvider:SendMessages(oMessages, oConfig:MaxTokens).

        /* Add the response to history for future turns */
        THIS-OBJECT:AppendMessage("assistant", cResponse).

        RETURN cResponse.

    END METHOD.

    /*--------------------------------------------------------------------*/
    /* Returns a CHR(1)-delimited list of "filename | format" for display */
    /*--------------------------------------------------------------------*/

    METHOD PUBLIC CHARACTER GetFilesSummary():

        DEFINE VARIABLE cResult AS CHARACTER NO-UNDO.

        FOR EACH ttFile NO-LOCK:
            cResult = cResult +
                (IF cResult = "" THEN "" ELSE CHR(1)) +
                System.IO.Path:GetFileName(ttFile.cPath) +
                " | " + ttFile.cFormatName.
        END.

        RETURN cResult.

    END METHOD.

    /*--------------------------------------------------------------------*/
    /* Clears all loaded files and conversation history.                  */
    /*--------------------------------------------------------------------*/

    METHOD PUBLIC VOID Reset():
        EMPTY TEMP-TABLE ttMsg.
        EMPTY TEMP-TABLE ttFile.
        iNextMsg = 0.
        IsLoaded = FALSE.
    END METHOD.

    /*--------------------------------------------------------------------*/

    METHOD PRIVATE VOID AppendMessage(INPUT pcRole    AS CHARACTER,
                                      INPUT pcContent AS CHARACTER):
        iNextMsg = iNextMsg + 1.
        CREATE ttMsg.
        ASSIGN
            ttMsg.iSeq     = iNextMsg
            ttMsg.cRole    = pcRole
            ttMsg.cContent = pcContent.
    END METHOD.

    /*--------------------------------------------------------------------*/
    /* Returns the full conversation history as a JSON array string.    */
    /* Used by RunAnalysis.p to embed history in output.html for        */
    /* follow-up prompts.                                               */
    /*--------------------------------------------------------------------*/

    METHOD PUBLIC CHARACTER GetHistoryJson():

        DEFINE VARIABLE cJson  AS CHARACTER NO-UNDO.
        DEFINE VARIABLE lFirst AS LOGICAL   NO-UNDO INITIAL TRUE.

        cJson = "[".

        FOR EACH ttMsg NO-LOCK BY ttMsg.iSeq:
            IF NOT lFirst THEN cJson = cJson + ",".
            cJson = cJson +
                SUBSTITUTE('~{"role":"&1","content":"&2"~}',
                    ttMsg.cRole,
                    THIS-OBJECT:EscapeJson(ttMsg.cContent)).
            lFirst = FALSE.
        END.

        cJson = cJson + "]".
        RETURN cJson.

    END METHOD.

    /*--------------------------------------------------------------------*/
    /* Restores conversation history from a parsed JsonArray.           */
    /* Called by RunAnalysis.p for follow-up prompts.                   */
    /*--------------------------------------------------------------------*/

    METHOD PUBLIC VOID LoadHistory(INPUT poHistory AS JsonArray):

        DEFINE VARIABLE oMsg AS JsonObject NO-UNDO.
        DEFINE VARIABLE i    AS INTEGER    NO-UNDO.

        EMPTY TEMP-TABLE ttMsg.
        EMPTY TEMP-TABLE ttFile.
        iNextMsg = 0.

        DO i = 1 TO poHistory:Length:
            oMsg = CAST(poHistory:GetJsonObject(i), JsonObject).
            THIS-OBJECT:AppendMessage(
                oMsg:GetCharacter("role"),
                oMsg:GetCharacter("content")).
        END.

        IsLoaded = TRUE.

    END METHOD.

    /*--------------------------------------------------------------------*/

    METHOD PRIVATE CHARACTER EscapeJson(INPUT pcText AS CHARACTER):

        pcText = REPLACE(pcText, "~\",  "~\~\").
        pcText = REPLACE(pcText, '"',   '~\"').
        pcText = REPLACE(pcText, "~n",  "\n").
        pcText = REPLACE(pcText, "~r",  "\r").
        pcText = REPLACE(pcText, "~t",  "\t").

        RETURN pcText.

    END METHOD.

    /*--------------------------------------------------------------------*/

    METHOD PRIVATE LLMMessage EXTENT BuildMessageArray():

        DEFINE VARIABLE oResult AS LLMMessage EXTENT NO-UNDO.
        DEFINE VARIABLE iCount  AS INTEGER           NO-UNDO.
        DEFINE VARIABLE i       AS INTEGER           NO-UNDO.

        FOR EACH ttMsg NO-LOCK: iCount = iCount + 1. END.

        EXTENT(oResult) = iCount.
        i = 0.

        FOR EACH ttMsg NO-LOCK BY ttMsg.iSeq:
            i = i + 1.
            oResult[i] = NEW LLMMessage(ttMsg.cRole, ttMsg.cContent).
        END.

        RETURN oResult.

    END METHOD.

END CLASS.
