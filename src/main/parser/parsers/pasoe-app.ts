import type {
  LogParser, ParseResult, ParseStats,
  PasoeAppEntry, UnparsedLine
} from '../types'

// [yy/mm/dd@hh:mm:ss.uuu±hhmm] P-nnnnnn T-nnnnnn <level> <agent> <category> <rest>
//
// Known categories:
//   --           ABL/user application log (may have (Procedure: 'name' Line:nn) prefix)
//   AS           App server infrastructure
//   MSAS         Multi-server application server
//   CONN         Database connection (category is followed by heavy whitespace padding)
//
// Known agent patterns: AS-N, AS-Aux-N, AS-ResourceMgr, AS-Listener
//
// Note: 2-digit year (yy), unlike the DB log which uses yyyy.
const ENTRY_RE =
  /^\[(\d{2}\/\d{2}\/\d{2}@\d{2}:\d{2}:\d{2}\.\d{3}([+-]\d{4}))\]\s+P-(\S+)\s+T-(\S+)\s+(\d+)\s+(\S+)\s+(\S+)\s+(.*)/

// (Procedure: 'name possibly with spaces' Line:nn)
const PROCEDURE_RE = /^\(Procedure:\s+'([^']+)'\s+Line:(\d+)\)\s*/

function parseTimestamp(ts: string): Date {
  // ts = "26/06/17@12:07:11.732+0100"  →  yy/mm/dd@hh:mm:ss.uuu±hhmm
  const atIdx = ts.indexOf('@')
  const datePart = ts.slice(0, atIdx)   // "26/06/17"
  const rest = ts.slice(atIdx + 1)       // "12:07:11.732+0100"

  const [yy, mm, dd] = datePart.split('/')
  const year = `20${yy}`                 // assume 2000s

  const tzIdx = rest.search(/[+-]\d{4}$/)
  const time = rest.slice(0, tzIdx)      // "12:07:11.732"
  const tz = rest.slice(tzIdx)           // "+0100"
  const isoTz = tz.slice(0, 3) + ':' + tz.slice(3)  // "+01:00"

  return new Date(`${year}-${mm}-${dd}T${time}${isoTz}`)
}

// Typical filenames: pasoe.app.log, <agent>.log, application.log — no strong convention.
// Rely primarily on content sniffing.
const APP_LOG_NAME_RE = /(?:pasoe.*app|application[-_.]log)/i

// Sniff: 2-digit year bracket timestamp followed by P- and T- tokens then a digit (log level)
const APP_LOG_SNIFF_RE = /^\[\d{2}\/\d{2}\/\d{2}@\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{4}\]\s+P-\S+\s+T-\S+\s+\d+\s+/

export const pasoeAppParser: LogParser = {
  logType: 'pasoe-app',

  detect(filename: string, sample: string): boolean {
    if (APP_LOG_NAME_RE.test(filename)) return true
    const firstLine = sample.split(/\r?\n/).find(l => l.trim().length > 0) ?? ''
    return APP_LOG_SNIFF_RE.test(firstLine.trimStart())
  },

  parse(content: string): ParseResult {
    const rawLines = content.split(/\r?\n/)
    const lines: (PasoeAppEntry | UnparsedLine)[] = []
    const bySource: Record<string, number> = {}   // keyed by agent (AS-6, AS-Aux-7, etc.)
    let parsedEntries = 0
    let unparsedLines = 0

    for (let i = 0; i < rawLines.length; i++) {
      const raw = rawLines[i]
      const lineNumber = i + 1

      if (!raw.trim()) continue

      const m = ENTRY_RE.exec(raw)
      if (m) {
        const [, tsStr, tzOffset, pid, tid, levelStr, agent, category, rest] = m

        // CONN category pads the category field with whitespace before the message;
        // trimStart() normalises this and is harmless for other categories.
        const trimmedRest = rest.trimStart()

        // Extract optional (Procedure: 'name' Line:nn) prefix (-- category only)
        let procedureName: string | null = null
        let procedureLine: number | null = null
        let message = trimmedRest

        const procMatch = PROCEDURE_RE.exec(trimmedRest)
        if (procMatch) {
          procedureName = procMatch[1]
          procedureLine = parseInt(procMatch[2], 10)
          message = trimmedRest.slice(procMatch[0].length)
        }

        bySource[agent] = (bySource[agent] ?? 0) + 1

        lines.push({
          type: 'pasoe-app-entry',
          timestamp: parseTimestamp(tsStr),
          tzOffset,
          pid,
          tid,
          logLevel: parseInt(levelStr, 10),
          agent,
          category,
          procedureName,
          procedureLine,
          message,
          raw,
          lineNumber,
        } satisfies PasoeAppEntry)
        parsedEntries++
        continue
      }

      lines.push({ type: 'unparsed', raw, lineNumber } satisfies UnparsedLine)
      unparsedLines++
    }

    const stats: ParseStats = {
      totalLines: rawLines.length,
      parsedEntries,
      sectionHeaders: 0,
      unparsedLines,
      bySource,
      bySeverity: {},
    }

    return { logType: 'pasoe-app', lines, stats }
  },
}
