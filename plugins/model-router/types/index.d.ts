export type Tier = 'haiku' | 'sonnet' | 'opus'
export type Mode = 'auto' | 'off' | Tier

declare module 'claude-code' {
  interface PluginState {
    'model-router': { tier: Tier | null }
  }
}
