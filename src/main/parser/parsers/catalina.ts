import type {
  LogParser, ParseResult, ParseStats, Severity,
  CatalinaEntry, UnparsedLine,
} from '../types'

// DD-Mon-YYYY HH:MM:SS.mmm LEVEL [thread] logger message
// e.g. 17-Jun-2026 12:07:03.130 INFO [main] org.apache.coyote.AbstractProtocol.init Initializing...
const ENTRY_RE = /^(\d{2}-\w{3}-\d{4} \d{2}:\d{2}:\d{2}\.\d{3})\s+(SEVERE|WARNING|WARN|ERROR|INFO|DEBUG|FINE(?:R|ST)?)\s+\[([^\]]+)\]\s+(\S+)\s+(.*)/

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4,  Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
}

function parseTimestamp(s: string): Date {
  // "17-Jun-2026 12:07:03.130"
  const [datePart, timePart] = s.split(' ')
  const [dd, mon, yyyy] = datePart.split('-')
  const [hh, mm, rest] = timePart.split(':')
  const [ss, ms] = rest.split('.')
  return new Date(
    parseInt(yyyy, 10),
    MONTHS[mon] ?? 0,
    parseInt(dd, 10),
    parseInt(hh, 10),
    parseInt(mm, 10),
    parseInt(ss, 10),
    parseInt(ms, 10),
  )
}

function toSeverity(level: string): Severity {
  if (level === 'ERROR' || level === 'SEVERE')           return 'F'
  if (level === 'WARN'  || level === 'WARNING')          return 'W'
  return 'I'
}

const CATALINA_NAME_RE = /^(catalina|localhost)(\..+)?$/i
const CATALINA_SNIFF_RE = /^\d{2}-\w{3}-\d{4} \d{2}:\d{2}:\d{2}\.\d{3}\s+(SEVERE|WARNING|WARN|ERROR|INFO|DEBUG|FINE)/

export const catalinaParser: LogParser = {
  logType: 'catalina',

  detect(filename: string, sample: string): boolean {
    if (CATALINA_NAME_RE.test(filename)) return true
    const firstLine = sample.split(/\r?\n/).find(l => l.trim().length > 0) ?? ''
    return CATALINA_SNIFF_RE.test(firstLine)
  },

  parse(content: string): ParseResult {
    const rawLines = content.split(/\r?\n/)
    const lines: (CatalinaEntry | UnparsedLine)[] = []
    const bySource: Record<string, number> = {}
    const bySeverity: Partial<Record<Severity, number>> = {}
    let parsedEntries = 0
    let unparsedLines = 0

    for (let i = 0; i < rawLines.length; i++) {
      const raw = rawLines[i]
      const lineNumber = i + 1

      if (!raw.trim()) continue

      const m = ENTRY_RE.exec(raw)
      if (m) {
        const [, tsStr, level, thread, logger, message] = m
        const severity = toSeverity(level)

        bySource[logger]  = (bySource[logger]   ?? 0) + 1
        bySeverity[severity] = (bySeverity[severity] ?? 0) + 1

        lines.push({
          type: 'catalina-entry',
          timestamp: parseTimestamp(tsStr),
          level,
          severity,
          thread,
          logger,
          message,
          raw,
          lineNumber,
        } satisfies CatalinaEntry)
        parsedEntries++
        continue
      }

      // Thread dump headers, stack frames, plain text — keep as unparsed so they still get chunked
      lines.push({ type: 'unparsed', raw, lineNumber } satisfies UnparsedLine)
      unparsedLines++
    }

    const stats: ParseStats = {
      totalLines: rawLines.length,
      parsedEntries,
      sectionHeaders: 0,
      unparsedLines,
      bySource,
      bySeverity,
    }

    return { logType: 'catalina', lines, stats }
  },
}
