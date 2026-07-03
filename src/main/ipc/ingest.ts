import { readFile } from 'fs/promises'
import { basename } from 'path'
import { detectParser, listParsers } from '../parser'
import { runIngestPipeline, DEFAULT_INGEST_OPTIONS } from '../ingest'
import type { IngestParseResult, IngestRunOptions } from '../../shared/types'
import type { WebContents } from 'electron'
import { IPC } from '../../shared/types'
import { setIngestionInProgress } from '../state'

const SNIFF_BYTES = 2048

export async function parseLogFile(filepath: string): Promise<IngestParseResult> {
  const content = await readFile(filepath, 'utf-8')
  const filename = basename(filepath)
  const parser = detectParser(filename, content.slice(0, SNIFF_BYTES))

  const allLines = content.split(/\r?\n/)
  const preview  = allLines.slice(0, 10)

  if (!parser) {
    return {
      logType: null,
      totalLines: allLines.length,
      parsedEntries: 0,
      sectionHeaders: 0,
      unparsedLines: 0,
      bySource: {},
      bySeverity: {},
      preview,
    }
  }

  const result = parser.parse(content)
  return {
    logType: result.logType,
    totalLines: result.stats.totalLines,
    parsedEntries: result.stats.parsedEntries,
    sectionHeaders: result.stats.sectionHeaders,
    unparsedLines: result.stats.unparsedLines,
    bySource: result.stats.bySource,
    bySeverity: result.stats.bySeverity as Record<string, number>,
    preview,
  }
}

export async function runIngest(sender: WebContents, options: IngestRunOptions): Promise<void> {
  setIngestionInProgress(true)
  try {
    await runIngestPipeline(
      options.sessionId,
      options.files,
      {
        chunkSize: options.chunkSize ?? DEFAULT_INGEST_OPTIONS.chunkSize,
        chunkOverlap: options.chunkOverlap ?? DEFAULT_INGEST_OPTIONS.chunkOverlap,
        timeRangeStart: options.timeRangeStart ? new Date(options.timeRangeStart) : undefined,
        timeRangeEnd: options.timeRangeEnd ? new Date(options.timeRangeEnd) : undefined,
      },
      (progress) => sender.send(IPC.ingest.progress, progress)
    )
  } finally {
    setIngestionInProgress(false)
  }
}
