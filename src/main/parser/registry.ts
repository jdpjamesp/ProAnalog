import type { LogParser } from './types'

const parsers: LogParser[] = []

export function registerParser(parser: LogParser): void {
  parsers.push(parser)
}

/** Find a parser that claims the given file, checking in registration order. */
export function detectParser(filename: string, sample: string): LogParser | null {
  return parsers.find(p => p.detect(filename, sample)) ?? null
}

export function getParser(logType: string): LogParser | null {
  return parsers.find(p => p.logType === logType) ?? null
}

export function listParsers(): string[] {
  return parsers.map(p => p.logType)
}
