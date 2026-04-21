/*------------------------------------------------------------------------
    File        : LogDetector/LogFormatRegistry.cls
    Purpose     : Holds all known LogFormat definitions. Hardcoded for now
                  but structured so a future version can load definitions
                  from a JSON file or database by overriding BuildFormats().
    Syntax      : LogDetector.LogFormatRegistry
  ----------------------------------------------------------------------*/

BLOCK-LEVEL ON ERROR UNDO, THROW.

USING LogDetector.LogFormat FROM PROPATH.

CLASS LogDetector.LogFormatRegistry:

    DEFINE PRIVATE TEMP-TABLE ttFormat NO-UNDO
        FIELD iSeq   AS INTEGER
        FIELD oFormat AS CLASS Progress.Lang.Object
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
            oResult[i] = CAST(ttFormat.oFormat, LogFormat).
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
            "^\d\d-[A-Za-z][A-Za-z][A-Za-z]-\d\d\d\d \d\d:\d\d:\d\d\.\d\d\d (SEVERE|WARNING|INFO|CONFIG|FINE|FINER|FINEST)"
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
            "^\d+\.\d+\.\d+\.\d+ \S+( \S+)? \[\d\d/[A-Za-z][A-Za-z][A-Za-z]/\d\d\d\d:\d\d:\d\d:\d\d [+-]\d\d\d\d\]"
        )).

        /* ----------------------------------------------------------------
           Classic AppServer Broker/Agent Log
           Registered BEFORE WebSpeed: both share the [MM/DD/YY...] timestamp
           format so AppServer is identified first by its unique identifiers.
           Example:  [04/16/25@08:23:11] (AsBroker-1): Broker startup complete
                     [04/16/25@08:23:11] (AsAgent-1-12345): Agent connected
        ---------------------------------------------------------------- */
        THIS-OBJECT:Register(NEW LogFormat(
            "Classic AppServer Log",
            "This is a Progress OpenEdge Classic AppServer broker and agent log " +
            "(not PASOE). The log records activity for the traditional 4GL AppServer " +
            "environment used to host ABL business logic for client/server and web " +
            "service deployments. Broker log entries contain process identifiers such " +
            "as (AsBroker-N) or (AsAgent-N). The log captures broker startup and " +
            "shutdown, agent pool sizing and management, client connection and " +
            "disconnection events, request routing and queuing, ABL procedure " +
            "execution, and agent-level errors or crashes. Agent counts, queue depths, " +
            "and connection timeouts in this log are key indicators of capacity and " +
            "performance issues.",
            "AsBroker|AsAgent|AppServer Broker|AppServer Agent"
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
            "^\[\d\d/\d\d/\d\d[@\s]\d\d:\d\d:\d\d\]"
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
            "^\[\d\d\d\d/\d\d/\d\d@\d\d:\d\d:\d\d\.\d\d\d[+-]\d\d\d\d\]"
        )).

        /* ----------------------------------------------------------------
           OpenEdge AdminServer Log (admserv.log)
           Records activity for the OpenEdge Administration Server and
           NameServer, which manage database and application server instances.
           Example:  [2025/04/16@08:23:11.456+0000] AdminServer started
        ---------------------------------------------------------------- */
        THIS-OBJECT:Register(NEW LogFormat(
            "OpenEdge AdminServer Log",
            "This is a Progress OpenEdge Administration Server log (typically admserv.log). " +
            "The AdminServer manages OpenEdge databases, AppServer brokers, and other " +
            "server resources on a host. It works alongside the NameServer (or NSALIAS) " +
            "which provides service location for clients. This log records AdminServer " +
            "and NameServer startup and shutdown, registration and deregistration of " +
            "managed servers, health check activity, port assignments, and administrative " +
            "commands issued via the OpenEdge Management console or command-line tools. " +
            "Errors here often indicate configuration issues, port conflicts, or " +
            "connectivity problems between managed components.",
            "AdminServer|NameServer|NSALIAS|Name Server"
        )).

        /* ----------------------------------------------------------------
           OpenEdge ProDataServer Log
           Records activity for the DataServer connecting OpenEdge to
           non-Progress databases (ODBC, MS SQL Server, Oracle).
           Example:  [04/16/25@08:23:11] (DataServer-1): Schema connection established
        ---------------------------------------------------------------- */
        THIS-OBJECT:Register(NEW LogFormat(
            "OpenEdge ProDataServer Log",
            "This is a Progress OpenEdge ProDataServer log. The ProDataServer provides " +
            "connectivity between OpenEdge ABL applications and non-Progress databases " +
            "such as Microsoft SQL Server (MSS DataServer), Oracle (Oracle DataServer), " +
            "or ODBC data sources. This log records DataServer broker and agent startup " +
            "and shutdown, schema holder connections, query translations, connection " +
            "pooling, and errors encountered when mapping between the OpenEdge data " +
            "model and the foreign database. Connection failures, schema mismatches, and " +
            "SQL translation errors are the most common issues to investigate.",
            "DataServer|ODBC DataServer|MSS DataServer|Oracle DataServer"
        )).

        /* ----------------------------------------------------------------
           OpenEdge Replication Log
           Records activity for OpenEdge database replication (target/source).
           Example:  [2025/04/16@08:23:11.456+0000] Replication Target: transition to primary
        ---------------------------------------------------------------- */
        THIS-OBJECT:Register(NEW LogFormat(
            "OpenEdge Replication Log",
            "This is a Progress OpenEdge database replication log. OpenEdge replication " +
            "maintains a synchronised copy of a database (the replication target) from a " +
            "primary source database. This log records replication agent startup and " +
            "shutdown, synchronisation state transitions (e.g. transitioning to primary " +
            "after failover), after-image (AI) file processing, connection status between " +
            "source and target, lag indicators, and replication errors. Key events to " +
            "look for include state transitions, AI sequence gaps, connection interruptions, " +
            "and any messages indicating the target has fallen behind the source.",
            "[Rr]eplication [Tt]arget|[Rr]eplication [Ss]ource|[Rr]eplication [Aa]gent|transition to primary|transition to target"
        )).

        /* ----------------------------------------------------------------
           OpenEdge Management / OpenEdge Explorer Log
           Java-based management infrastructure log.
           Example:  2025-04-16 08:23:11,456 INFO  [com.openedge.oem] - ...
        ---------------------------------------------------------------- */
        THIS-OBJECT:Register(NEW LogFormat(
            "OpenEdge Management Log",
            "This is a Progress OpenEdge Management (OEM) or OpenEdge Explorer log. " +
            "OpenEdge Management is the Java-based infrastructure used to monitor and " +
            "manage OpenEdge servers, databases, and application components. The log " +
            "uses a Java log4j-style format with timestamps, severity levels, and " +
            "component class names. It records management agent activity, monitored " +
            "resource status changes, alert generation, trend data collection, and " +
            "communication between the management console and managed nodes. Errors " +
            "here typically indicate connectivity issues between the management " +
            "infrastructure and the components it monitors.",
            "OpenEdge Management|oemanager|OEM Agent|com\.openedge\.oem|com\.openedge\.oe\.management"
        )).

        /* ----------------------------------------------------------------
           Progress Developer Studio (PDSOE) Log
           Eclipse-based IDE error log format.
           Example:  !SESSION 2025-04-16 08:23:11.456 -------
                     !ENTRY com.openedge.pdt.core 4 0 2025-04-16 08:23:11.456
        ---------------------------------------------------------------- */
        THIS-OBJECT:Register(NEW LogFormat(
            "Progress Developer Studio Log",
            "This is a Progress Developer Studio for OpenEdge (PDSOE) log, generated " +
            "by the Eclipse-based IDE. The log follows the standard Eclipse error log " +
            "format: sessions are delimited by !SESSION headers, and individual entries " +
            "use !ENTRY (component, severity, code, timestamp), !MESSAGE (description), " +
            "and !STACK (stack trace) markers. Severity codes are: 0=OK, 1=INFO, " +
            "2=WARNING, 4=ERROR. Component names beginning with com.openedge or " +
            "com.progress identify OpenEdge-specific plugins. This log is most useful " +
            "for diagnosing IDE crashes, plugin errors, build failures, and ABL " +
            "Language Server issues.",
            "^!SESSION \d\d\d\d-\d\d-\d\d|^!ENTRY com\.openedge|^!ENTRY com\.progress"
        )).

        /* ----------------------------------------------------------------
           Windows Event Log (text export)
           Exported from Windows Event Viewer or PowerShell Get-WinEvent.
           Example:  Log Name:      Application
                     Source:        Progress OpenEdge
                     Event ID:      1000
        ---------------------------------------------------------------- */
        THIS-OBJECT:Register(NEW LogFormat(
            "Windows Event Log",
            "This is a Windows Event Log exported in text format, typically from " +
            "Windows Event Viewer or via PowerShell (Get-WinEvent | Format-List). " +
            "Each event record contains fields including Log Name, Source, Date/Time, " +
            "Event ID, Task Category, Level (Information/Warning/Error/Critical), " +
            "Keywords, User, Computer, and a Description containing the event message. " +
            "Records may be from any Windows event channel (Application, System, " +
            "Security, or custom OpenEdge channels). When analysing, the Source field " +
            "identifies the application that logged the event, the Event ID identifies " +
            "the specific event type, and the Description contains the detail. " +
            "OpenEdge-related entries often appear under Source values such as " +
            "'Progress OpenEdge' or the specific server component name.",
            "^Log Name:\s+\S|^Source:\s+\S|^Event\[\d+\]:"
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
