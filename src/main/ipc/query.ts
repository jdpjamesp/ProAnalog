import { ipcMain } from 'electron'
import { IPC } from '../../shared/types'
import { askQuestion } from '../query'
import { isIngestionInProgress } from '../state'

export function registerQueryHandlers(): void {
  ipcMain.handle(IPC.query.ask, async (event, sessionId: number, question: string, timeRangeStart?: number, timeRangeEnd?: number) => {
    if (isIngestionInProgress()) {
      const message = 'Cannot query while ingestion is in progress'
      event.sender.send(IPC.query.error, message)
      throw new Error(message)
    }
    try {
      const timeRange = (timeRangeStart !== undefined && timeRangeEnd !== undefined)
        ? { start: timeRangeStart, end: timeRangeEnd }
        : undefined
      return await askQuestion(event.sender, sessionId, question, timeRange)
    } catch (err) {
      event.sender.send(IPC.query.error, String(err))
      throw err
    }
  })
}
