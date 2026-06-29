import type {
  LogParser, ParseResult, ParseStats,
  PasoeAccessEntry, UnparsedLine
} from '../types'

// PASOE access log format (custom Tomcat variant):
// %h %u [%t] "%r" %s %b <responseMs> <threadId> <extra>
//
// Example:
// 10.211.80.150 - [18/Jun/2026:00:02:28 +0100] "POST /web/api/foo.p?x=1 HTTP/1.1" 200 4363 218 thd-61 -
//
// NOT standard Combined Log Format — no separate logname field, no quoted referer/UA.
const ENTRY_RE =
  /^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+"([^"]*)"\s+(\d{3})\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)/

const MONTHS: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
}

function parseTimestamp(ts: string): { date: Date; tzOffset: string } {
  // ts = "18/Jun/2026:00:02:28 +0100"
  const match = ts.match(/^(\d{2})\/(\w{3})\/(\d{4}):(\d{2}:\d{2}:\d{2})\s+([+-]\d{4})$/)
  if (!match) return { date: new Date(NaN), tzOffset: '+0000' }
  const [, day, mon, year, time, tz] = match
  const month = MONTHS[mon] ?? '01'
  const isoTz = tz.slice(0, 3) + ':' + tz.slice(3)
  return {
    date: new Date(`${year}-${month}-${day}T${time}${isoTz}`),
    tzOffset: tz,
  }
}

function nullIfDash(value: string | undefined): string | null {
  return (!value || value === '-') ? null : value
}

function parseRequestLine(line: string): { method: string; path: string; protocol: string } {
  if (!line || line === '-') return { method: '', path: '', protocol: '' }
  const firstSpace = line.indexOf(' ')
  const lastSpace = line.lastIndexOf(' ')
  if (firstSpace === -1) return { method: line, path: '', protocol: '' }
  if (firstSpace === lastSpace) return { method: line.slice(0, firstSpace), path: line.slice(firstSpace + 1), protocol: '' }
  return {
    method:   line.slice(0, firstSpace),
    path:     line.slice(firstSpace + 1, lastSpace),
    protocol: line.slice(lastSpace + 1),
  }
}

function parseIntOrNull(value: string | undefined): number | null {
  if (!value || value === '-') return null
  const n = parseInt(value, 10)
  return isNaN(n) ? null : n
}

// Tomcat access log filenames are typically:
//   localhost_access_log.2022-05-13.txt
//   localhost_access_log.txt
//   access_log.2022-05-13
const ACCESS_LOG_NAME_RE = /access[-_]log/i

// Content sniff: IP address, a dash, then a bracket timestamp (no logname field)
const ACCESS_LOG_SNIFF_RE = /^\d{1,3}(?:\.\d{1,3}){3}\s+\S+\s+\[\d{2}\/\w{3}\/\d{4}:/

export const pasoeAccessParser: LogParser = {
  logType: 'pasoe-access',

  detect(filename: string, sample: string): boolean {
    if (ACCESS_LOG_NAME_RE.test(filename)) return true
    const firstLine = sample.split(/\r?\n/).find(l => l.trim().length > 0) ?? ''
    return ACCESS_LOG_SNIFF_RE.test(firstLine.trimStart())
  },

  parse(content: string): ParseResult {
    const rawLines = content.split(/\r?\n/)
    const lines: (PasoeAccessEntry | UnparsedLine)[] = []
    const bySource: Record<string, number> = {}   // keyed by HTTP method
    let parsedEntries = 0
    let unparsedLines = 0

    for (let i = 0; i < rawLines.length; i++) {
      const raw = rawLines[i]
      const lineNumber = i + 1

      if (!raw.trim()) continue

      const m = ENTRY_RE.exec(raw)
      if (m) {
        const [, remoteHost, remoteUser, tsStr, requestLine, statusStr, bytesStr, responseTimeStr, threadId, extra] = m
        const { date, tzOffset } = parseTimestamp(tsStr)
        const { method, path, protocol } = parseRequestLine(requestLine)

        bySource[method || 'UNKNOWN'] = (bySource[method || 'UNKNOWN'] ?? 0) + 1

        lines.push({
          type: 'pasoe-access-entry',
          remoteHost,
          remoteUser: nullIfDash(remoteUser),
          timestamp: date,
          tzOffset,
          method,
          path,
          protocol,
          statusCode: parseInt(statusStr, 10),
          bytesSent: parseIntOrNull(bytesStr),
          responseTimeMs: parseIntOrNull(responseTimeStr),
          threadId: nullIfDash(threadId),
          extra: nullIfDash(extra),
          raw,
          lineNumber,
        } satisfies PasoeAccessEntry)
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

    return { logType: 'pasoe-access', lines, stats }
  },
}
