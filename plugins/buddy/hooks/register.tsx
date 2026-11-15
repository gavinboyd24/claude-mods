import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Walk } from '../types'

const walk = atom({ plugin: 'buddy', key: 'walk' } as const, { x: 0, dir: 1, tick: 0 })
const isHidden = atom({ plugin: 'buddy', key: 'isHidden' } as const, false)

const SPRITE_W = 9
const TICK_MS = 300

// An original little orange critter, three rows tall.
function sprite(w: Walk, isWorking: boolean): string[] {
  const step = w.tick % 2 === 0
  const resting = !isWorking && w.tick % 60 >= 52 // stops for a little wave now and then
  const top = '╭─────╮'
  let face: string
  if (isWorking) face = '│ •_• │'
  else if (resting) face = '│ ^ᴗ^ │'
  else face = w.dir === 1 ? '│  •ᴗ•│' : '│•ᴗ•  │'
  const legs = resting || isWorking ? '╰─┬─┬─╯' : step ? '╰─┬─┬─╯' : '╰─╱─╲─╯'
  const side = resting ? ' ∕' : isWorking ? (w.tick % 3 === 0 ? ' …' : '  ') : '  '
  return [`${top}  `, `${face}${side}`, `${legs}  `]
}

export const register: Register = on => {
  let width = 60
  let working = false

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'buddy', description: 'Your walking buddy: /buddy hide or /buddy show' })
    $.clock.every(TICK_MS, () => {
      void update($, walk, w => {
        if (working) return { ...w, tick: w.tick + 1 }
        const resting = w.tick % 60 >= 52
        const max = Math.max(0, width - SPRITE_W - 1)
        let x = resting ? w.x : w.x + w.dir
        let dir = w.dir
        if (x >= max) { x = max; dir = -1 }
        if (x <= 0) { x = 0; dir = 1 }
        return { x, dir, tick: w.tick + 1 }
      })
    })
    return next(e)
  })

  on('command.run', { command: 'buddy' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'hide') { await update($, isHidden, () => true); return { text: 'Buddy is taking a nap. /buddy show brings them back.' } }
    if (arg === 'show' || arg === '') { await update($, isHidden, () => false); return { text: 'Buddy is back!' } }
    return { text: 'Use /buddy hide or /buddy show.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, isHidden))) return next(e)
    working = e.props.isWorking
    width = Math.max(SPRITE_W + 2, e.viewport?.columns ?? 60)

    const w = await read($, walk)
    const x = Math.min(w.x, Math.max(0, width - SPRITE_W - 1))
    const pad = ' '.repeat(x)
    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        {sprite(w, working).map((row, i) => (
          <Text key={`r${i}`} color="claude" mono>{pad}{row}</Text>
        ))}
      </Box>
    )
  })
}
