/*------------------------------------------------------------------------
    File        : LogDetector/LogFormatRegistry.cls
    Purpose     : Holds all known LogFormat definitions. Hardcoded for now
                  but structured so a future version can load definitions
                  from a JSON file or database by overriding BuildFormats().
    Syntax      : LogDetector.LogFormatRegistry
  ----------------------------------------------------------------------*/

BLOCK-LEVEL ON ERROR UNDO, THROW.

USING LogDetector.LogFormat FROM ANYWHERE.

CLASS LogDetector.LogFormatRegistry:

    DEFINE PRIVATE TEMP-TABLE ttFormat NO-UNDO
        FIELD iSeq   AS INTEGER
        FIELD oFormat AS CLASS LogFormat
        INDEX ixSeq IS PRIMARY UNIQUE iSeq.

    DEFINE PRIVATE VARIABLE iNext AS INTEGER NO-UNDO INITIAL 0.

    /*--------------------------------------------------------------------*/

    CONSTRUCTOR PUBLIC LogFormatRegistry():
        THIS-OBJECT:BuildFormats().
    END CONSTRUCTOR.

    /*--------------------------------------------------------------------*/
    /* Returns a new EXTENT of all registered formats, in priority order. */
    /*--------------------------------------------------------------------*/

    METHOD PUBLIC LogFormat EXTENT GetFormats():

        DEFINE VARIABLE oResult AS LogFormat EXTENT NO-UNDO.
        DEFINE VARIABLE iCount  AS INTEGER          NO-UNDO.
        DEFINE VARIABLE i       AS INTEGER          NO-UNDO.

        iCount = 0.
        FOR EACH ttFormat NO-LOCK:
            iCount = iCount + 1.
        END.

        EXTENT(oResult) = iCount.
        i = 0.

        FOR EACH ttFormat NO-LOCK BY ttFormat.iSeq:
            i = i + 1.
            oResult[i] = ttFormat.oFormat.
        END.

        RETURN oResult.

    END METHOD.

    /*--------------------------------------------------------------------*/
    /* Override this method in a subclass to load formats from a file     */
    /* or database instead of hardcoded definitions.                      */
    /*--------------------------------------------------------------------*/

    METHOD PROTECTED VOID BuildFormats():

        /* ----------------------------------------------------------------
           PASOE Tomcat Application Log (catalina.out / localhost.yyyy-mm-dd.log)
           Lines start with a date/time stamp and severity level.
           Example:  16-Apr-2025 08:23:11.456 INFO [main] ...
        ---------------------------------------------------------------- */
        THIS-OBJECT:Register(NEW LogFormat(
            "PASOE Tomcat Application Log",
            "This is a Progress OpenEdge PASOE (PAS for OpenEdge) Tomcat application log. " +
            "It follows standard Tomcat/Catalina log format. Each entry begins with a " +
            "timestamp in the format DD-Mon-YYYY HH:MM:SS.mmm followed by a severity level " +
            "(SEVERE, WARNING, INFO, CONFIG, FINE, FINER, FINEST) and the source thread or " +
            "component in square brackets. Entries may span multiple lines for stack traces. " +
            "This log records application server lifecycle events, session activity, " +
            "deployment messages, OpenEdge agent startup/shutdown, and unhandled errors.",
            "^\d{2}-[A-Za-z]{3}-\d{4} \d{2}:\d{2}:\d{2}\.\d{3} (SEVERE|WARNING|INFO|CONFIG|FINE|FINER|FINEST)"
        )).

        /* ----------------------------------------------------------------
           PASOE Tomcat Access Log (access_log.yyyy-mm-dd.txt)
           Combined Log Format: host ident user [timestamp] "request" status bytes [referrer] [agent]
           Example:  192.168.1.1 - jsmith [16/Apr/2025:08:23:11 +0000] "GET /oeabl/... HTTP/1.1" 200 4321
        ---------------------------------------------------------------- */
        THIS-OBJECT:Register(NEW LogFormat(
            "PASOE Tomcat Access Log",
            "This is a Progress OpenEdge PASOE Tomcat HTTP access log in Combined Log Format. " +
            "Each line represents one HTTP request and contains: client IP address, ident " +
            "(usually -), authenticated username (or -), request timestamp in " +
            "[DD/Mon/YYYY:HH:MM:SS +offset] format, the HTTP request line in double quotes, " +
            "the HTTP status code, the response size in bytes, the referrer URL, and the " +
            "user-agent string. A status of 200 means success; 404 means not found; 500 means " +
            "server error. This log is used to analyse web traffic, endpoint usage, error rates, " +
            "and performance (response sizes) for the OpenEdge application server.",
            "^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3} \S+ \S+ \[\d{2}/[A-Za-z]{3}/\d{4}:\d{2}:\d{2}:\d{2} [+\-]\d{4}\]"
        )).

        /* ----------------------------------------------------------------
           Classic WebSpeed Transaction Server Log
           Lines begin with a bracketed date/time and process info.
           Example:  [04/16/25 08:23:11] msgsrv: ...
                     [04/16/25@08:23:11] (BrkSrv-1) ...
        ---------------------------------------------------------------- */
        THIS-OBJECT:Register(NEW LogFormat(
            "Classic WebSpeed Log",
            "This is a Progress OpenEdge Classic WebSpeed Transaction Server log. " +
            "Each entry begins with a bracketed date and time stamp in the format " +
            "[MM/DD/YY HH:MM:SS] or [MM/DD/YY@HH:MM:SS], often followed by a process " +
            "identifier or broker/agent name in parentheses. The log records WebSpeed " +
            "broker and agent activity including request handling, agent startup and " +
            "shutdown, connection events, and ABL procedure execution errors. " +
            "This is a legacy format predating PASOE and is associated with the classic " +
            "WebSpeed web object runner (WOB) environment.",
            "^\[\d{2}/\d{2}/\d{2}[@\s]\d{2}:\d{2}:\d{2}\]"
        )).

        /* ----------------------------------------------------------------
           OpenEdge Database Log File (dbname.lg)
           Lines begin with a bracketed timestamp and a log entry type code.
           Example:  [2025/04/16@08:23:11.456+0000] P-12345   T-98765  1: (333)   ...
        ---------------------------------------------------------------- */
        THIS-OBJECT:Register(NEW LogFormat(
            "OpenEdge Database Log",
            "This is a Progress OpenEdge database log file (.lg). Each entry begins with " +
            "a timestamp in the format [YYYY/MM/DD@HH:MM:SS.mmm+offset], followed by a " +
            "process identifier (P-nnnnn), a thread identifier (T-nnnnn), a sequence number, " +
            "a message code in parentheses, and the log message text. " +
            "This log records all significant database engine activity including: server " +
            "startup and shutdown, connections and disconnections, checkpoint activity, " +
            "before-image (BI) and after-image (AI) management, crash recovery, lock table " +
            "usage, buffer pool activity, database errors, and administrative operations. " +
            "Message codes in parentheses (e.g. (333), (2809)) can be looked up in the " +
            "OpenEdge Database Administration guide.",
            "^\[\d{4}/\d{2}/\d{2}@\d{2}:\d{2}:\d{2}\.\d{3}[+\-]\d{4}\]"
        )).

    END METHOD.

    /*--------------------------------------------------------------------*/
    /* Adds a LogFormat to the registry in sequence order.                */
    /*--------------------------------------------------------------------*/

    METHOD PROTECTED VOID Register(INPUT oFmt AS LogFormat):
        iNext = iNext + 1.
        CREATE ttFormat.
        ASSIGN
            ttFormat.iSeq   = iNext
            ttFormat.oFormat = oFmt.
    END METHOD.

END CLASS.
