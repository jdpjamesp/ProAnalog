import { ipcMain } from 'electron'
import { IPC } from '../../shared/types'
import { askQuestion } from '../query'

export function registerQueryHandlers(): void {
  ipcMain.handle(IPC.query.ask, async (event, sessionId: number, question: string) => {
    try {
      return await askQuestion(event.sender, sessionId, question)
    } catch (err) {
      event.sender.send(IPC.query.error, String(err))
      throw err
    }
  })
}
