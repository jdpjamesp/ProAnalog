import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { IpcRendererEvent } from 'electron'
import type { Session, SessionFile, Query, ChunkRef, ProviderConfig, IngestConfig, QueryConfig, IngestParseResult, IngestRunOptions, IngestProgress } from '../shared/types'
import { IPC } from '../shared/types'

type Unsub = () => void

const api = {
  shell: {
    openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:open-external', url),
  },
  getFilePath: (file: File): string => webUtils.getPathForFile(file),
  sessions: {
    list:   ():                             Promise<Session[]>           => ipcRenderer.invoke(IPC.sessions.list),
    get:    (id: number):                   Promise<Session | undefined>  => ipcRenderer.invoke(IPC.sessions.get, id),
    create: (data: { name: string }):       Promise<Session>              => ipcRenderer.invoke(IPC.sessions.create, data),
    rename: (id: number, name: string):     Promise<void>                 => ipcRenderer.invoke(IPC.sessions.rename, id, name),
    delete: (id: number):                   Promise<void>                 => ipcRenderer.invoke(IPC.sessions.delete, id),
  },
  sessionFiles: {
    list: (sessionId: number):              Promise<SessionFile[]>        => ipcRenderer.invoke(IPC.sessionFiles.list, sessionId),
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
    getQuery:     ():                              Promise<QueryConfig | null>   => ipcRenderer.invoke(IPC.settings.get, 'query'),
    setQuery:     (config: QueryConfig):           Promise<void>               => ipcRenderer.invoke(IPC.settings.set, 'query', config),
  },
  ingest: {
    parse:    (filepath: string):         Promise<IngestParseResult> => ipcRenderer.invoke(IPC.ingest.parse, filepath),
    parsers:  ():                         Promise<string[]>          => ipcRenderer.invoke(IPC.ingest.parsers),
    run:      (options: IngestRunOptions): Promise<void>              => ipcRenderer.invoke(IPC.ingest.run, options),
    onProgress: (cb: (progress: IngestProgress) => void): Unsub => {
      ipcRenderer.on(IPC.ingest.progress, (_e, p: IngestProgress) => cb(p))
      return () => ipcRenderer.removeAllListeners(IPC.ingest.progress)
    },
  },
  query: {
    ask: (sessionId: number, question: string, timeRangeStart?: number, timeRangeEnd?: number): Promise<Query> =>
      ipcRenderer.invoke(IPC.query.ask, sessionId, question, timeRangeStart, timeRangeEnd),
    onToken: (cb: (token: string) => void): Unsub => {
      const handler = (_e: IpcRendererEvent, t: string) => cb(t)
      ipcRenderer.on(IPC.query.token, handler)
      return () => ipcRenderer.removeListener(IPC.query.token, handler)
    },
    onChunks: (cb: (chunks: ChunkRef[]) => void): Unsub => {
      const handler = (_e: IpcRendererEvent, c: ChunkRef[]) => cb(c)
      ipcRenderer.on(IPC.query.chunks, handler)
      return () => ipcRenderer.removeListener(IPC.query.chunks, handler)
    },
    onError: (cb: (msg: string) => void): Unsub => {
      const handler = (_e: IpcRendererEvent, m: string) => cb(m)
      ipcRenderer.on(IPC.query.error, handler)
      return () => ipcRenderer.removeListener(IPC.query.error, handler)
    },
  },
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
