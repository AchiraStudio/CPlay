interface Window {
  __TAURI__?: {
    window: {
      getCurrent: () => {
        minimize: () => Promise<void>
        maximize: () => Promise<void>
        toggleMaximize: () => Promise<void>
        close: () => Promise<void>
      }
    }
    event: {
      listen: (event: string, cb: (e: { payload: unknown }) => void) => Promise<() => void>
    }
    core: {
      invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>
    }
  }
}
