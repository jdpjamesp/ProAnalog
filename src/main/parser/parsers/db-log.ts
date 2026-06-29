import type {
  LogParser, ParseResult, ParseStats,
  DbLogEntry, SectionHeader, UnparsedLine, Severity
} from '../types'

// [yyyy/mm/dd@hh:mm:ss.uuu+hhmm] P-<pid>  T-<tid>  <S> <source>: (<msgnum>)  <message>
const ENTRY_RE =
  /^\[(\d{4}\/\d{2}\/\d{2}@\d{2}:\d{2}:\d{2}\.\d{3}([+-]\d{4}))\]\s+P-(\S+)\s+T-(\S+)\s+([IWF])\s+([^:]+):\s+\((\d+)\)\s+(.*?)\s*$/

// Plain-text date banner:   Fri May 13 14:45:50 2022
const SECTION_RE =
  /^\s{2,}((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\w+\s+\d+\s+\d{2}:\d{2}:\d{2}\s+\d{4})\s*$/

function parseTimestamp(ts: string): Date {
  // ts = "2022/05/13@14:45:50.174+0100"
  const atIdx = ts.indexOf('@')
  const isoDate = ts.slice(0, atIdx).replace(/\//g, '-')
  const rest = ts.slice(atIdx + 1)
  // Timezone sign is at the last +/- after the milliseconds
  const tzIdx = rest.search(/[+-]\d{4}$/)
  const time = rest.slice(0, tzIdx)
  const tz = rest.slice(tzIdx)
  // Convert +0100 → +01:00
  const isoTz = tz.slice(0, 3) + ':' + tz.slice(3)
  return new Date(`${isoDate}T${time}${isoTz}`)
}

function parseSource(raw: string): { source: string; userNum: number | null } {
  const trimmed = raw.trim()
  // Source field is "NAME" or "NAME n" — trailing digits are the user number
  const match = trimmed.match(/^(\w+)\s+(\d+)$/)
  if (match) return { source: match[1], userNum: parseInt(match[2], 10) }
  return { source: trimmed.replace(/\s+$/, ''), userNum: null }
}

export const dbLogParser: LogParser = {
  logType: 'db-log',

  detect(filename: string, sample: string): boolean {
    if (filename.toLowerCase().endsWith('.lg')) return true
    // Sniff: look for the characteristic bracket-timestamp on the first non-blank line
    const firstLine = sample.split(/\r?\n/).find(l => l.trim().length > 0) ?? ''
    return /^\[2\d{3}\/\d{2}\/\d{2}@/.test(firstLine.trimStart())
  },

  parse(content: string): ParseResult {
    const rawLines = content.split(/\r?\n/)
    const lines: (DbLogEntry | SectionHeader | UnparsedLine)[] = []
    const bySource: Record<string, number> = {}
    const bySeverity: Partial<Record<Severity, number>> = {}
    let parsedEntries = 0
    let sectionHeaders = 0
    let unparsedLines = 0

    for (let i = 0; i < rawLines.length; i++) {
      const raw = rawLines[i]
      const lineNumber = i + 1

      if (!raw.trim()) continue

      const sectionMatch = SECTION_RE.exec(raw)
      if (sectionMatch) {
        lines.push({ type: 'section-header', text: sectionMatch[1], raw, lineNumber } satisfies SectionHeader)
        sectionHeaders++
        continue
      }

      const entryMatch = ENTRY_RE.exec(raw)
      if (entryMatch) {
        const [, tsStr, tzOffset, pid, tid, severityStr, sourceRaw, msgNumStr, message] = entryMatch
        const { source, userNum } = parseSource(sourceRaw)
        const severity = severityStr as Severity

        bySource[source] = (bySource[source] ?? 0) + 1
        bySeverity[severity] = (bySeverity[severity] ?? 0) + 1

        lines.push({
          type: 'db-log-entry',
          timestamp: parseTimestamp(tsStr),
          tzOffset,
          pid,
          tid,
          severity,
          source,
          userNum,
          messageNum: parseInt(msgNumStr, 10),
          message,
          raw,
          lineNumber,
        } satisfies DbLogEntry)
        parsedEntries++
        continue
      }

      lines.push({ type: 'unparsed', raw, lineNumber } satisfies UnparsedLine)
      unparsedLines++
    }

    const stats: ParseStats = {
      totalLines: rawLines.length,
      parsedEntries,
      sectionHeaders,
      unparsedLines,
      bySource,
      bySeverity,
    }

    return { logType: 'db-log', lines, stats }
  },
}
