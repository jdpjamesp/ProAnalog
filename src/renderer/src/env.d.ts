/// <reference types="vite/client" />

import type { Api } from '../../preload/index'

declare global {
  interface Window {
    api: Api
  }
}

// React's CSSProperties extends csstype.Properties — augment here so
// Electron's drag-region property is recognised without casting.
declare module 'csstype' {
  interface Properties {
    WebkitAppRegion?: 'drag' | 'no-drag'
  }
}
