export type Todo = { text: string; done: boolean }
export type Entry = { name: string; description: string; plugin: string }
export type Catalog = { plugins: string[]; skills: Entry[] }

declare module 'claude-code' {
  interface PluginState {
    dashboard: { todos: Shaped<Todo[]>; catalog: Catalog; suggested: Entry[] }
  }
}
