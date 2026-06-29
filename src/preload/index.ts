import { contextBridge, ipcRenderer } from 'electron'
import type { Session, Query, ChunkRef, ProviderConfig, IngestConfig } from '../shared/types'
import { IPC } from '../shared/types'

const api = {
  sessions: {
    list:   ():                                    Promise<Session[]>          => ipcRenderer.invoke(IPC.sessions.list),
    get:    (id: number):                          Promise<Session | undefined> => ipcRenderer.invoke(IPC.sessions.get, id),
    create: (data: { name: string; filename: string; filepath: string; file_size: number }): Promise<Session> =>
                                                   ipcRenderer.invoke(IPC.sessions.create, data),
    rename: (id: number, name: string):            Promise<void>               => ipcRenderer.invoke(IPC.sessions.rename, id, name),
    delete: (id: number):                          Promise<void>               => ipcRenderer.invoke(IPC.sessions.delete, id),
  },
  queries: {
    list:   (sessionId: number):                   Promise<Query[]>            => ipcRenderer.invoke(IPC.queries.list, sessionId),
    create: (data: { session_id: number; question: string; answer: string; chunks_used: ChunkRef[]; tokens_used: number }): Promise<Query> =>
                                                   ipcRenderer.invoke(IPC.queries.create, data),
  },
  settings: {
    getAll: ():                                    Promise<Record<string, unknown>> => ipcRenderer.invoke(IPC.settings.getAll),
    get:    <T>(key: string):                      Promise<T | null>            => ipcRenderer.invoke(IPC.settings.get, key),
    set:    (key: string, value: unknown):         Promise<void>               => ipcRenderer.invoke(IPC.settings.set, key, value),
    getProvider:  ():                              Promise<ProviderConfig | null> => ipcRenderer.invoke(IPC.settings.get, 'provider'),
    setProvider:  (config: ProviderConfig):        Promise<void>               => ipcRenderer.invoke(IPC.settings.set, 'provider', config),
    getIngest:    ():                              Promise<IngestConfig | null>  => ipcRenderer.invoke(IPC.settings.get, 'ingest'),
    setIngest:    (config: IngestConfig):          Promise<void>               => ipcRenderer.invoke(IPC.settings.set, 'ingest', config),
  },
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
