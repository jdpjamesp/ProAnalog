import type { AnyLogLine } from '../parser/types'
import type { Chunk, IngestOptions } from './types'

function getTimestamp(line: AnyLogLine): Date | null {
  switch (line.type) {
    case 'db-log-entry':
    case 'pasoe-access-entry':
    case 'pasoe-app-entry':
      return line.timestamp
    default:
      return null
  }
}

/**
 * Filter lines to those falling within an optional time range.
 * Finds the first and last timestamped line in range, then returns
 * everything between those indices — including non-timestamped lines
 * (section headers, unparsed) that sit between in-range entries.
 */
function filterByTimeRange(
  lines: AnyLogLine[],
  start?: Date,
  end?: Date
): AnyLogLine[] {
  if (!start && !end) return lines

  let firstIdx = -1
  let lastIdx = -1

  for (let i = 0; i < lines.length; i++) {
    const ts = getTimestamp(lines[i])
    if (!ts) continue
    const inRange = (!start || ts >= start) && (!end || ts <= end)
    if (inRange) {
      if (firstIdx === -1) firstIdx = i
      lastIdx = i
    }
  }

  if (firstIdx === -1) return []
  return lines.slice(firstIdx, lastIdx + 1)
}

export function chunkLines(
  lines: AnyLogLine[],
  sessionId: number,
  filename: string,
  logType: string,
  options: IngestOptions
): Chunk[] {
  const { chunkSize, chunkOverlap } = options

  // Remove blank/empty lines before chunking
  const contentLines = lines.filter(l => l.raw.trim().length > 0)

  // Apply optional time range — takes the contiguous block between the first
  // and last in-range timestamped lines (no per-line inference)
  const filtered = filterByTimeRange(contentLines, options.timeRangeStart, options.timeRangeEnd)

  if (filtered.length === 0) return []

  const chunks: Chunk[] = []
  const step = Math.max(1, chunkSize - chunkOverlap)

  for (let i = 0; i < filtered.length; i += step) {
    const slice = filtered.slice(i, i + chunkSize)

    const timestamps = slice
      .map(getTimestamp)
      .filter((ts): ts is Date => ts !== null)
      .map(ts => ts.getTime())

    chunks.push({
      id: `${sessionId}:${filename}:${slice[0].lineNumber}`,
      sessionId,
      filename,
      logType,
      lineStart: slice[0].lineNumber,
      lineEnd: slice[slice.length - 1].lineNumber,
      timestampStart: timestamps.length > 0 ? Math.min(...timestamps) : null,
      timestampEnd: timestamps.length > 0 ? Math.max(...timestamps) : null,
      text: slice.map(l => l.raw).join('\n'),
    })
  }

  return chunks
}
