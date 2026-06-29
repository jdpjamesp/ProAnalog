import { ipcMain } from 'electron'
import { IPC } from '../../shared/types'
import * as sessions from '../db/sessions'
import * as queries from '../db/queries'
import * as settings from '../db/settings'

export function registerIpcHandlers(): void {
  // ── Sessions ──────────────────────────────────────────────────────────
  ipcMain.handle(IPC.sessions.list, () => sessions.listSessions())

  ipcMain.handle(IPC.sessions.get, (_e, id: number) => sessions.getSession(id))

  ipcMain.handle(IPC.sessions.create, (_e, data: {
    name: string; filename: string; filepath: string; file_size: number
  }) => sessions.createSession(data))

  ipcMain.handle(IPC.sessions.rename, (_e, id: number, name: string) =>
    sessions.renameSession(id, name))

  ipcMain.handle(IPC.sessions.delete, (_e, id: number) =>
    sessions.deleteSession(id))

  // ── Queries ───────────────────────────────────────────────────────────
  ipcMain.handle(IPC.queries.list, (_e, sessionId: number) =>
    queries.listQueries(sessionId))

  ipcMain.handle(IPC.queries.create, (_e, data: Parameters<typeof queries.createQuery>[0]) =>
    queries.createQuery(data))

  // ── Settings ──────────────────────────────────────────────────────────
  ipcMain.handle(IPC.settings.getAll, () => settings.getAllSettings())

  ipcMain.handle(IPC.settings.get, (_e, key: string) => settings.getSetting(key))

  ipcMain.handle(IPC.settings.set, (_e, key: string, value: unknown) =>
    settings.setSetting(key, value))
}
