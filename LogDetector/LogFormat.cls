/*------------------------------------------------------------------------
    File        : LogDetector/LogFormat.cls
    Purpose     : Data class representing a known log format — its display
                  name, the context string sent to the LLM as a system
                  prompt, and the regex patterns used to detect it.
    Syntax      : LogDetector.LogFormat
  ----------------------------------------------------------------------*/

BLOCK-LEVEL ON ERROR UNDO, THROW.

CLASS LogDetector.LogFormat:

    /* Human-readable name shown in the UI */
    DEFINE PUBLIC PROPERTY Name AS CHARACTER NO-UNDO
        GET. PRIVATE SET.

    /* Paragraph(s) describing the format to the LLM */
    DEFINE PUBLIC PROPERTY Context AS CHARACTER NO-UNDO
        GET. PRIVATE SET.

    /* Comma-delimited list of regex patterns; ANY match identifies the format */
    DEFINE PUBLIC PROPERTY DetectionPatterns AS CHARACTER NO-UNDO
        GET. PRIVATE SET.

    /*--------------------------------------------------------------------*/

    CONSTRUCTOR PUBLIC LogFormat(INPUT pcName     AS CHARACTER,
                                 INPUT pcContext   AS CHARACTER,
                                 INPUT pcPatterns  AS CHARACTER):
        THIS-OBJECT:Name             = pcName.
        THIS-OBJECT:Context          = pcContext.
        THIS-OBJECT:DetectionPatterns = pcPatterns.
    END CONSTRUCTOR.

END CLASS.
