import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'dashboard', component: 'Pane', requestId: 'dashboard',
  props: { title: 'Dashboard', isFocused: false, bodyColumns: 50, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
} as const

test('to-dos are added, ticked and drawn; installed skills are listed', async ($, on) => {
  const store: Record<string, unknown> = {}
  on('store.get', (_, e) => ({ value: store[(e as { key: string }).key] }))
  on('store.set', (_, e) => { const a = e as { key: string; value: unknown }; store[a.key] = a.value; return { value: undefined } })
  on('command.register', () => ({ value: { command: 'x' } }))
  on('command.list', () => ({ value: [
    { name: 'grill-me', description: 'A relentless interview to sharpen a plan', source: 'plugin', plugin: 'anthropic-skills' },
    { name: 'model', description: 'Set the model', source: 'builtin' },
  ] }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('prompt.submit', (_, e) => ({ text: e.text }) as never)

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const added = await $.command.run({ command: 'todo', args: 'add call the bank' } as never)
  expect((added as { text: string }).text).toContain('Added #1')
  await $.command.run({ command: 'todo', args: 'done 1' } as never)
  await $.command.run({ command: 'panel', args: '' } as never)
  await $.prompt.submit({ text: 'grill me on my plan' } as never)

  for (const surface of ['terminal', 'desktop', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /call the bank/ }))?.text).toContain('call the bank')
    expect((await ui.find({ type: 'Text', text: /anthropic-skills/ }))?.text).toContain('anthropic-skills')
    expect((await ui.find({ type: 'Text', text: /\/grill-me A relentless/ }))).toBeTruthy()
    await ui.unmount()
  }
})
