&ANALYZE-SUSPEND _VERSION-NUMBER AB_v10r12
&ANALYZE-RESUME
&Scoped-define WINDOW-NAME C-Win
&ANALYZE-SUSPEND _UIB-CODE-BLOCK _CUSTOM _DEFINITIONS C-Win
/*------------------------------------------------------------------------
    File        : ProAnalog.w
    Purpose     : Main GUI window for ProAnalog log analysis tool.
                  This is a thin shell — all business logic lives in
                  Session.ConversationSession and its dependencies.
    Notes       : Requires .NET bridge (OpenEdge 12.x on Windows).
  ----------------------------------------------------------------------*/

USING Session.ConversationSession FROM ANYWHERE.
USING Config.AppConfig            FROM ANYWHERE.

DEFINE VARIABLE oSession  AS ConversationSession NO-UNDO.
DEFINE VARIABLE oConfig   AS AppConfig           NO-UNDO.
DEFINE VARIABLE lBusy     AS LOGICAL             NO-UNDO INITIAL FALSE.

/* &ANALYZE-SUSPEND _UIB-PREPROCESSOR-BLOCK */
&ANALYZE-RESUME

/* ***********************  Control Definitions  ********************** */

DEFINE VARIABLE C-Win AS WIDGET-HANDLE NO-UNDO.

/* Main window frame */
DEFINE FRAME f-main
    WITH 1 DOWN KEEP-TAB-ORDER OVERLAY
         SIDE-LABELS NO-UNDERLINE THREE-D
         AT COL 1 ROW 1
         SIZE 140 BY 40
         TITLE "ProAnalog — OpenEdge Log Analyser".

/* ---- Toolbar area -------------------------------------------------- */
DEFINE BUTTON btn-load
    LABEL "Load Log File(s)..."
    SIZE 22 BY 1.1.

DEFINE BUTTON btn-reset
    LABEL "New Session"
    SIZE 16 BY 1.1.

/* ---- File list display --------------------------------------------- */
DEFINE VARIABLE ed-files AS CHARACTER
    VIEW-AS EDITOR SCROLLBAR-VERTICAL NO-WORD-WRAP
    SIZE 130 BY 4 NO-UNDO.

/* ---- Chat history display ------------------------------------------ */
DEFINE VARIABLE ed-history AS CHARACTER
    VIEW-AS EDITOR SCROLLBAR-VERTICAL SCROLLBAR-HORIZONTAL
    SIZE 130 BY 22 NO-UNDO.

/* ---- Question input ------------------------------------------------ */
DEFINE VARIABLE ed-question AS CHARACTER
    VIEW-AS EDITOR SCROLLBAR-VERTICAL
    SIZE 115 BY 3 NO-UNDO.

DEFINE BUTTON btn-send
    LABEL "Send"
    SIZE 13 BY 3.

/* ---- Status bar ---------------------------------------------------- */
DEFINE VARIABLE txt-status AS CHARACTER FORMAT "X(120)"
    VIEW-AS TEXT
    SIZE 130 BY 1 NO-UNDO.

/* ***********************  Frame Layout  **************************** */

UPDATE
    btn-load   AT ROW 1.5  COL 2
    btn-reset  AT ROW 1.5  COL 26
    ed-files   AT ROW 3.2  COL 2   LABEL "Loaded files:"
    ed-history AT ROW 8.5  COL 2   LABEL "Conversation:"
    ed-question AT ROW 31.5 COL 2  LABEL "Ask a question:"
    btn-send   AT ROW 31.5 COL 118
    txt-status AT ROW 39   COL 2   NO-LABEL
WITH FRAME f-main.

/* ************************  Main Block  ***************************** */

ON CHOOSE OF btn-load IN FRAME f-main DO:
    RUN ChooseFiles.
END.

ON CHOOSE OF btn-reset IN FRAME f-main DO:
    RUN ResetSession.
END.

ON CHOOSE OF btn-send IN FRAME f-main DO:
    RUN SendQuestion.
END.

/* Allow Ctrl+Enter to submit from the question editor */
ON CTRL-RETURN OF ed-question IN FRAME f-main DO:
    RUN SendQuestion.
END.

/* -------------------------------------------------------------------- */
/* Initialise                                                            */
/* -------------------------------------------------------------------- */
RUN Initialise.
WAIT-FOR CLOSE OF FRAME f-main.

/* ************************  Procedures  ***************************** */

PROCEDURE Initialise:

    DO ON ERROR UNDO, LEAVE:
        oConfig  = NEW AppConfig().
        oSession = NEW ConversationSession(oConfig).
        RUN SetStatus(SUBSTITUTE("Ready — &1", oSession:ProviderLabel)).
    END.

    ASSIGN
        ed-files:READ-ONLY    IN FRAME f-main = TRUE
        ed-history:READ-ONLY  IN FRAME f-main = TRUE
        btn-send:SENSITIVE    IN FRAME f-main = FALSE
        btn-reset:SENSITIVE   IN FRAME f-main = FALSE.

    DISPLAY
        ed-files
        ed-history
        ed-question
        txt-status
    WITH FRAME f-main.

    ENABLE ALL WITH FRAME f-main.
    VIEW FRAME f-main.

END PROCEDURE.

/* -------------------------------------------------------------------- */

PROCEDURE ChooseFiles:

    DEFINE VARIABLE cFiles      AS CHARACTER NO-UNDO.
    DEFINE VARIABLE cFormatNames AS CHARACTER NO-UNDO.
    DEFINE VARIABLE cSummary    AS CHARACTER NO-UNDO.
    DEFINE VARIABLE i           AS INTEGER   NO-UNDO.
    DEFINE VARIABLE cDelim      AS CHARACTER NO-UNDO.

    /* System file chooser — multi-select via .NET OpenFileDialog */
    DEFINE VARIABLE oDialog AS System.Windows.Forms.OpenFileDialog NO-UNDO.

    oDialog = NEW System.Windows.Forms.OpenFileDialog().
    ASSIGN
        oDialog:Title            = "Select Log File(s)"
        oDialog:Filter           = "Log files (*.log;*.lg;*.txt;*.out)|*.log;*.lg;*.txt;*.out|All files (*.*)|*.*"
        oDialog:Multiselect      = TRUE
        oDialog:CheckFileExists  = TRUE.

    IF oDialog:ShowDialog() = System.Windows.Forms.DialogResult:OK THEN DO:

        /* Build CHR(1)-delimited list from the selected files array */
        cFiles = "".
        DO i = 0 TO oDialog:FileNames:Length - 1:
            IF i > 0 THEN cFiles = cFiles + CHR(1).
            cFiles = cFiles + oDialog:FileNames[i].
        END.

        IF cFiles = "" THEN RETURN.

        RUN SetStatus("Loading and analysing log file(s)...").
        lBusy = TRUE.

        DO ON ERROR UNDO, LEAVE:
            cFormatNames = oSession:LoadFiles(cFiles).
        END.

        lBusy = FALSE.

        /* Update the files display */
        cSummary = "".
        cDelim   = oSession:GetFilesSummary().
        DO i = 1 TO NUM-ENTRIES(cDelim, CHR(1)):
            cSummary = cSummary + ENTRY(i, cDelim, CHR(1)) + CHR(10).
        END.

        ASSIGN
            ed-files:SCREEN-VALUE  IN FRAME f-main = cSummary
            btn-send:SENSITIVE     IN FRAME f-main = TRUE
            btn-reset:SENSITIVE    IN FRAME f-main = TRUE.

        RUN SetStatus(SUBSTITUTE("&1 file(s) loaded — &2  |  Ask a question below.",
            oSession:FileCount, oSession:ProviderLabel)).

        RUN AppendHistory("System", "Files loaded. Detected formats: " +
            REPLACE(cFormatNames, CHR(1), ", ") + ".").
    END.

    oDialog:Dispose().

END PROCEDURE.

/* -------------------------------------------------------------------- */

PROCEDURE SendQuestion:

    DEFINE VARIABLE cQuestion AS CHARACTER NO-UNDO.
    DEFINE VARIABLE cResponse AS CHARACTER NO-UNDO.

    IF lBusy THEN RETURN.

    cQuestion = TRIM(ed-question:SCREEN-VALUE IN FRAME f-main).
    IF cQuestion = "" THEN RETURN.

    IF NOT oSession:IsLoaded THEN DO:
        MESSAGE "Please load one or more log files before asking a question."
            VIEW-AS ALERT-BOX INFORMATION.
        RETURN.
    END.

    /* Clear input and show the question in history */
    ed-question:SCREEN-VALUE IN FRAME f-main = "".
    RUN AppendHistory("You", cQuestion).
    RUN SetStatus("Waiting for response...").

    lBusy = TRUE.
    btn-send:SENSITIVE IN FRAME f-main = FALSE.

    DO ON ERROR UNDO, LEAVE:
        cResponse = oSession:Ask(cQuestion).
    END.

    IF ERROR-STATUS:ERROR THEN DO:
        cResponse = "Error: " + ERROR-STATUS:GET-MESSAGE(1).
        RUN AppendHistory("Error", cResponse).
    END.
    ELSE
        RUN AppendHistory("ProAnalog", cResponse).

    lBusy = FALSE.
    btn-send:SENSITIVE IN FRAME f-main = TRUE.

    RUN SetStatus(SUBSTITUTE("Ready — &1", oSession:ProviderLabel)).

END PROCEDURE.

/* -------------------------------------------------------------------- */

PROCEDURE ResetSession:

    IF MESSAGE-BOX("Start a new session? The current conversation will be cleared.",
            "New Session", MB_YESNO + MB_ICONQUESTION) = IDYES THEN DO:

        oSession:Reset().

        ASSIGN
            ed-files:SCREEN-VALUE    IN FRAME f-main = ""
            ed-history:SCREEN-VALUE  IN FRAME f-main = ""
            ed-question:SCREEN-VALUE IN FRAME f-main = ""
            btn-send:SENSITIVE       IN FRAME f-main = FALSE
            btn-reset:SENSITIVE      IN FRAME f-main = FALSE.

        RUN SetStatus(SUBSTITUTE("Session cleared — &1", oSession:ProviderLabel)).
    END.

END PROCEDURE.

/* -------------------------------------------------------------------- */

PROCEDURE AppendHistory:
    DEFINE INPUT PARAMETER pcSender  AS CHARACTER NO-UNDO.
    DEFINE INPUT PARAMETER pcMessage AS CHARACTER NO-UNDO.

    DEFINE VARIABLE cCurrent AS CHARACTER NO-UNDO.
    DEFINE VARIABLE cLine    AS CHARACTER NO-UNDO.

    cLine    = SUBSTITUTE("[&1]: &2", pcSender, pcMessage).
    cCurrent = ed-history:SCREEN-VALUE IN FRAME f-main.

    IF cCurrent = "" THEN
        ed-history:SCREEN-VALUE IN FRAME f-main = cLine.
    ELSE
        ed-history:SCREEN-VALUE IN FRAME f-main =
            cCurrent + CHR(10) + STRING(FILL("-", 80)) + CHR(10) + cLine.

    /* Scroll to bottom */
    ed-history:CURSOR-OFFSET IN FRAME f-main =
        LENGTH(ed-history:SCREEN-VALUE IN FRAME f-main).

END PROCEDURE.

/* -------------------------------------------------------------------- */

PROCEDURE SetStatus:
    DEFINE INPUT PARAMETER pcText AS CHARACTER NO-UNDO.
    txt-status:SCREEN-VALUE IN FRAME f-main = pcText.
END PROCEDURE.
