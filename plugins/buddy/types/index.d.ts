export type Walk = { x: number; dir: 1 | -1; tick: number }

declare module 'claude-code' {
  interface PluginState {
    buddy: { walk: Walk; isHidden: boolean }
  }
}
