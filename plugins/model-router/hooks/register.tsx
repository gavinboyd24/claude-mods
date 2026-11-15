import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Mode, Tier } from '../types'

// The tier picked for the current message, shown in the status line.
const tier = atom({ plugin: 'model-router', key: 'tier' } as const, null)

const MODE_KEY = 'mode'
const MODES: readonly Mode[] = ['auto', 'off', 'haiku', 'sonnet', 'opus']
const NAMES: Record<Tier, string> = { haiku: 'Haiku', sonnet: 'Sonnet', opus: 'Opus' }

// Big or hard work goes to Opus.
const HARD =
  /\b(plan|planning|architect\w*|design|refactor\w*|debug\w*|investigat\w*|research|strateg\w*|analy[sz]\w*|deep[- ]dive|complex|migrat\w*|rewrite|overhaul|audit|review (the|my|this) (code|repo|project))\b/i
// Anything that asks for real work skips Haiku.
const WORK =
  /\b(fix|build|write|create|code|implement|edit|change|update|install|set ?up|configure|deploy|draft|make|generate|convert|compare|summari[sz]e)\b/i

export function choose(text: string): Tier {
  const t = text.trim()
  if (t.length > 1500 || HARD.test(t)) return 'opus'
  if (t.length < 160 && !t.includes('```') && !WORK.test(t)) return 'haiku'
  return 'sonnet'
}

async function getMode($: { store: { get: (k: string) => Promise<unknown> } }): Promise<Mode> {
  const m = await $.store.get(MODE_KEY)
  return MODES.includes(m as Mode) ? (m as Mode) : 'auto'
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'router',
      description: 'Model router: /router auto | off | haiku | sonnet | opus (no argument shows the setting)',
    })
    const mode = await getMode($)
    $.ui.status(mode === 'off' ? undefined : `Router: ${mode}`)
    return next(e)
  })

  on('command.run', { command: 'router' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (!arg) {
      const mode = await getMode($)
      return {
        text:
          `Model router is set to "${mode}".\n` +
          'auto = Haiku for quick questions, Sonnet for normal work, Opus for big or hard tasks.\n' +
          'Change it with /router auto, /router off, /router haiku, /router sonnet or /router opus.',
      }
    }
    if (!MODES.includes(arg as Mode)) {
      return { text: `"${arg}" isn't a setting. Use auto, off, haiku, sonnet or opus.` }
    }
    await $.store.set(MODE_KEY, arg)
    $.ui.status(arg === 'off' ? undefined : `Router: ${arg}`)
    return { text: arg === 'off' ? 'Model router turned off. Your normal model is used.' : `Model router set to "${arg}".` }
  })

  on('prompt.submit', async ($, e, next) => {
    const mode = await getMode($)
    if (mode === 'off') {
      await update($, tier, () => null)
      return next(e)
    }
    const picked: Tier = mode === 'auto' ? choose(e.text) : mode
    await update($, tier, () => picked)
    $.ui.status(`Router: ${NAMES[picked]}${mode === 'auto' ? ' (auto)' : ''}`)
    return next(e)
  })

  // Every model request of the main conversation uses the picked tier;
  // subagents keep whatever model they were given.
  on('turn.step', async function* ($, e, next) {
    const picked = e.agentId ? null : await read($, tier)
    return yield* next(picked ? { ...e, model: picked } : e)
  })
}
