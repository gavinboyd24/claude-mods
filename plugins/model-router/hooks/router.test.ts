import { expect, test } from 'claude-code/testing'
import { choose } from './register'

test('quick questions go to Haiku, work to Sonnet, big jobs to Opus', async () => {
  expect(choose('what time is it in Tokyo?')).toBe('haiku')
  expect(choose('fix the typo in my budget sheet')).toBe('sonnet')
  expect(choose('help me plan the church website rebuild')).toBe('opus')
  expect(choose('x'.repeat(2000))).toBe('opus')
})

test('the picked model is sent with the request', async ($, on) => {
  const store: Record<string, unknown> = {}
  on('store.get', (_, e) => ({ value: store[(e as { key: string }).key] }))
  on('store.set', (_, e) => { const a = e as { key: string; value: unknown }; store[a.key] = a.value; return { value: undefined } })
  on('prompt.submit', (_, e) => ({ text: e.text }) as never)
  let sent = ''
  on('ui.status', () => ({ value: undefined }))
  on('turn.step', async function* (_, e) { sent = e.model; return { turnId: e.turnId, index: e.index, answer: "", toolUses: [], stopReason: "end_turn", usage: null } as never })

  await $.prompt.submit({ text: 'hi there' } as never)
  for await (const _ of $.turn.step({ turnId: 't', index: 0, model: 'opus', messageCount: 1 } as never)) { /* drain */ }
  expect(sent).toBe('haiku')
})
