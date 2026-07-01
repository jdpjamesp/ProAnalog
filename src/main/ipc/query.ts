import { ipcMain } from 'electron'
import { IPC } from '../../shared/types'
import { askQuestion } from '../query'

export function registerQueryHandlers(): void {
  ipcMain.handle(IPC.query.ask, async (event, sessionId: number, question: string, timeRangeStart?: number, timeRangeEnd?: number) => {
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
