import type {
  LogParser, ParseResult, ParseStats, Severity,
  PasoeWebappEntry, UnparsedLine,
} from '../types'

// HH:MM:SS.mmm/uptimeMs [thread] LEVEL  logger - message
// e.g. 01:28:17.738/48071309 [uULbdGO0QiijTmebEnmlJw-agent-watchdog] WARN  c.p.appserv.PoolMgt.AgentWatchdog - AgentWatchdog(...) : ...
const ENTRY_RE = /^(\d{2}:\d{2}:\d{2}\.\d{3})\/(\d+)\s+\[([^\]]+)\]\s+(TRACE|DEBUG|INFO|WARN|WARNING|ERROR|FATAL)\s+(\S+)\s+-\s+(.*)/

// Filename: anything.<YYYY-MM-DD>.log
const DATE_IN_NAME_RE = /(\d{4}-\d{2}-\d{2})/

function toSeverity(level: string): Severity {
  if (level === 'ERROR' || level === 'FATAL')  return 'F'
  if (level === 'WARN'  || level === 'WARNING') return 'W'
  return 'I'
}

function buildTimestamp(dateStr: string, timeStr: string): Date {
  // dateStr = 'YYYY-MM-DD', timeStr = 'HH:MM:SS.mmm'
  return new Date(`${dateStr}T${timeStr}`)
}

// date extracted from filename during detect(), used in parse()
// (detect is always called before parse for the same file)
let _fileDate = ''

// Sniff: time-of-day/uptimeCounter [thread
const SNIFF_RE = /^\d{2}:\d{2}:\d{2}\.\d{3}\/\d+\s+\[/

export const pasoeWebappParser: LogParser = {
  logType: 'pasoe-webapp',

  detect(filename: string, sample: string): boolean {
    const dateMatch = DATE_IN_NAME_RE.exec(filename)
    _fileDate = dateMatch ? dateMatch[1] : new Date().toISOString().slice(0, 10)

    const firstLine = sample.split(/\r?\n/).find(l => l.trim().length > 0) ?? ''
    return SNIFF_RE.test(firstLine)
  },

  parse(content: string): ParseResult {
    const rawLines = content.split(/\r?\n/)
    const lines: (PasoeWebappEntry | UnparsedLine)[] = []
    const bySource: Record<string, number> = {}
    const bySeverity: Partial<Record<Severity, number>> = {}
    let parsedEntries = 0
    let unparsedLines = 0

    const dateStr = _fileDate || new Date().toISOString().slice(0, 10)

    for (let i = 0; i < rawLines.length; i++) {
      const raw = rawLines[i]
      const lineNumber = i + 1

      if (!raw.trim()) continue

      const m = ENTRY_RE.exec(raw)
      if (m) {
        const [, timeStr, uptimeMsStr, thread, level, logger, message] = m
        const severity = toSeverity(level)

        bySource[logger]     = (bySource[logger]     ?? 0) + 1
        bySeverity[severity] = (bySeverity[severity] ?? 0) + 1

        lines.push({
          type: 'pasoe-webapp-entry',
          timestamp: buildTimestamp(dateStr, timeStr),
          uptimeMs: parseInt(uptimeMsStr, 10),
          thread,
          level,
          severity,
          logger,
          message,
          raw,
          lineNumber,
        } satisfies PasoeWebappEntry)
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
      bySeverity,
    }

    return { logType: 'pasoe-webapp', lines, stats }
  },
}
