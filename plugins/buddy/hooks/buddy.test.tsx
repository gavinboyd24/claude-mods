import { expect, test } from 'claude-code/testing'

const BAND = { plugin: 'buddy', component: 'AbovePrompt', props: { hasSurvey: false, isCollapsed: false, isWorking: false }, viewport: { columns: 40, rows: 20 } } as const

test('the buddy is drawn above the prompt and can be hidden', async ($, on) => {
  on('command.register', () => ({ value: { command: 'buddy' } }))
  on('clock.every', () => ({ value: undefined }) as never)
  on('ui.render', ($, e) => { const { Text } = $.ui.resolve(e); return <Text>engine</Text> })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' } as never)
  expect((await ui.find({ type: 'Text', text: /ᴗ/ }))).toBeTruthy()
  await ui.unmount()

  await $.command.run({ command: 'buddy', args: 'hide' } as never)
  const hidden = await $.ui.mount({ ...BAND, surface: 'desktop' } as never)
  expect((await hidden.find({ type: 'Text', text: /ᴗ/ }))).toBeFalsy()
  await hidden.unmount()
})
