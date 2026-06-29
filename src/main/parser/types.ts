export type Severity = 'I' | 'W' | 'F'

// ── Base ──────────────────────────────────────────────────────────────────────

interface BaseEntry {
  raw: string
  lineNumber: number  // 1-based
}

// ── Concrete line types ───────────────────────────────────────────────────────

/** A structured log entry from the OpenEdge database log (.lg) */
export interface DbLogEntry extends BaseEntry {
  type: 'db-log-entry'
  timestamp: Date
  tzOffset: string        // e.g. '+0100'
  pid: string
  tid: string
  severity: Severity
  source: string          // e.g. 'DBUTIL', 'BROKER', 'ENCDC'
  userNum: number | null  // null when source has no user number (e.g. DBUTIL)
  messageNum: number
  message: string
}

/** Plain-text section banner lines that appear between activity groups */
export interface SectionHeader extends BaseEntry {
  type: 'section-header'
  text: string            // e.g. 'Fri May 13 14:45:50 2022'
}

/** A single request entry from a PASOE access log.
 *  Format: %h %u [%t] "%r" %s %b <responseMs> <threadId> <extra>
 *  Note: NOT standard Combined Log Format — no logname, no referer/UA fields. */
export interface PasoeAccessEntry extends BaseEntry {
  type: 'pasoe-access-entry'
  remoteHost: string
  remoteUser: string | null      // authenticated user, or null when '-'
  timestamp: Date
  tzOffset: string               // e.g. '+0100'
  method: string                 // GET, POST, etc. — empty string for malformed requests
  path: string                   // request path including query string
  protocol: string               // e.g. 'HTTP/1.1'
  statusCode: number
  bytesSent: number | null       // response body bytes, null when '-'
  responseTimeMs: number | null  // server processing time in ms
  threadId: string | null        // PASOE thread name, e.g. 'thd-61'
  extra: string | null           // trailing field, usually '-'
}

/** A single entry from a PASOE application log.
 *  Format: [yy/mm/dd@hh:mm:ss.uuu±hhmm] P-pid T-tid <level> <agent> <category> [<procedureCtx>] <message>
 *  Timestamp uses 2-digit year (yy), unlike the DB log which uses 4-digit (yyyy). */
export interface PasoeAppEntry extends BaseEntry {
  type: 'pasoe-app-entry'
  timestamp: Date
  tzOffset: string              // e.g. '+0100'
  pid: string
  tid: string
  logLevel: number              // numeric level: 1 = standard, 2 = verbose/detail
  agent: string                 // e.g. 'AS-6', 'AS-Aux-7'
  category: string              // '--' = ABL/user application log, 'AS' = infrastructure
  procedureName: string | null  // from (Procedure: 'name' Line:nn), null if not present
  procedureLine: number | null
  message: string
}

/** A single entry from a PASOE webapp logback log (e.g. active.2026-06-18.log).
 *  Format: HH:MM:SS.mmm/uptimeMs [thread] LEVEL logger - message
 *  No date in the line — inferred from filename during detect(). */
export interface PasoeWebappEntry extends BaseEntry {
  type: 'pasoe-webapp-entry'
  timestamp: Date
  uptimeMs: number       // JVM uptime counter in ms — precise relative ordering within file
  thread: string         // e.g. 'uULbdGO0QiijTmebEnmlJw-agent-watchdog'
  level: string          // e.g. 'WARN', 'INFO'
  severity: Severity
  logger: string         // abbreviated Java class, e.g. 'c.p.appserv.PoolMgt.AgentWatchdog'
  message: string
}

/** A single entry from a Tomcat catalina.out log.
 *  Format: DD-Mon-YYYY HH:MM:SS.mmm LEVEL [thread] class.method message
 *  No timezone offset — logged in server local time. */
export interface CatalinaEntry extends BaseEntry {
  type: 'catalina-entry'
  timestamp: Date
  level: string          // e.g. 'INFO', 'WARN', 'SEVERE'
  severity: Severity
  thread: string         // e.g. 'main', 'localhost-startStop-1'
  logger: string         // Java FQCN + method, e.g. 'org.apache.coyote.AbstractProtocol.init'
  message: string
}

/** A line that didn't match any known pattern */
export interface UnparsedLine extends BaseEntry {
  type: 'unparsed'
}

/** Discriminated union of all line types across all parsers.
 *  Add new entry types here as new parsers are introduced. */
export type AnyLogLine = DbLogEntry | SectionHeader | PasoeAccessEntry | PasoeAppEntry | PasoeWebappEntry | CatalinaEntry | UnparsedLine

// ── Results ───────────────────────────────────────────────────────────────────

export interface ParseStats {
  totalLines: number
  parsedEntries: number
  sectionHeaders: number
  unparsedLines: number
  bySource: Record<string, number>
  bySeverity: Partial<Record<Severity, number>>
}

export interface ParseResult {
  logType: string
  lines: AnyLogLine[]
  stats: ParseStats
}

// ── Parser interface ──────────────────────────────────────────────────────────

export interface LogParser {
  /** Stable identifier for this log format, e.g. 'db-log' */
  readonly logType: string
  /** Return true if this parser should handle the given file.
   *  @param filename  Basename of the file (with extension)
   *  @param sample    First ~2 KB of file content for sniffing */
  detect(filename: string, sample: string): boolean
  parse(content: string): ParseResult
}
