import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Catalog, Entry, Todo } from '../types'

const PANE = 'dashboard'
const TITLE = 'Dashboard'
const STORE_KEY = 'todos'

// Mirrors of what the pane draws; writing one redraws the pane.
const todos = atom({ plugin: 'dashboard', key: 'todos' } as const, [], { shape: 'todos-1' })
const catalog = atom({ plugin: 'dashboard', key: 'catalog' } as const, { plugins: [], skills: [] })
const suggested = atom({ plugin: 'dashboard', key: 'suggested' } as const, [])

const STOP = new Set(
  'a an and are as at be but by can do for from have how i if in is it me my of on or so that the this to up use we what when with you your'.split(' '),
)
const words = (s: string) =>
  new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2 && !STOP.has(w)))

// --- to-dos are kept in the mod's store, so they last across chats ---
async function loadTodos($: EngineInterface): Promise<Todo[]> {
  const raw = await $.store.get(STORE_KEY)
  return Array.isArray(raw)
    ? raw.filter(t => t && typeof t.text === 'string').map(t => ({ text: String(t.text), done: !!t.done }))
    : []
}
async function saveTodos($: EngineInterface, list: Todo[]) {
  await $.store.set(STORE_KEY, list)
  await update($, todos, () => list)
}

// --- what is installed: plugins/mods and the skills or commands they add ---
async function refreshCatalog($: EngineInterface): Promise<Catalog> {
  const cmds = await $.command.list()
  const skills: Entry[] = cmds
    .filter(c => c.source === 'plugin' || c.source === 'user')
    .map(c => ({ name: c.name, description: c.description ?? '', plugin: c.plugin ?? (c.source === 'user' ? 'your own' : 'other') }))
    .sort((a, b) => a.name.localeCompare(b.name))
  const plugins = [...new Set(skills.map(s => s.plugin))].sort()
  const next = { plugins, skills }
  await update($, catalog, () => next)
  return next
}

function suggest(text: string, skills: Entry[]): Entry[] {
  const want = words(text)
  if (want.size === 0) return []
  return skills
    .map(s => {
      const have = words(`${s.name.replace(/[-:]/g, ' ')} ${s.description}`)
      let score = 0
      for (const w of want) if (have.has(w)) score += 1
      return { s, score }
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(x => x.s)
}

function asText(list: Todo[], cat: Catalog, tips: Entry[]): string {
  const lines: string[] = ['TO-DO']
  if (list.length === 0) lines.push('  (empty. Add one with /todo add <thing>)')
  list.forEach((t, i) => lines.push(`  ${i + 1}. [${t.done ? 'x' : ' '}] ${t.text}`))
  lines.push('', `ACTIVE PLUGINS & MODS (${cat.plugins.length})`)
  lines.push('  ' + (cat.plugins.join(', ') || 'none found'))
  if (tips.length) {
    lines.push('', 'SUGGESTED FOR YOUR LAST MESSAGE')
    tips.forEach(s => lines.push(`  /${s.name}: ${s.description.slice(0, 90)}`))
  }
  lines.push('', `SKILLS & COMMANDS YOU CAN USE (${cat.skills.length})`)
  cat.skills.forEach(s => lines.push(`  /${s.name}`))
  return lines.join('\n')
}

const HELP =
  'To-do commands:\n' +
  '  /todo add <thing>   add an item\n' +
  '  /todo done <n>      tick item n\n' +
  '  /todo undo <n>      untick item n\n' +
  '  /todo remove <n>    delete item n\n' +
  '  /todo clear         delete all ticked items\n' +
  '  /todo               show the list\n' +
  'Open the panel with /panel.'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'todo', description: 'To-do list: /todo add <thing>, /todo done <n>, /todo remove <n>' })
    await $.command.register({ name: 'panel', description: 'Open the dashboard: to-dos, active mods and skills' })
    await update($, todos, () => [])
    await saveTodos($, await loadTodos($))
    return next(e)
  })

  on('command.run', { command: 'panel' }, async $ => {
    const cat = await refreshCatalog($)
    const opened = await $.ui.open({ id: PANE, title: TITLE })
    if (opened.isPlaced) return { text: 'Dashboard opened.' }
    // This app can't draw side panels: show the same thing as text instead.
    return { text: asText(await read($, todos), cat, await read($, suggested)) }
  })

  on('command.run', { command: 'todo' }, async ($, e) => {
    const [verb = '', ...rest] = e.args.trim().split(/\s+/)
    const arg = rest.join(' ').trim()
    const list = await loadTodos($)
    const n = Number.parseInt(arg, 10) - 1
    const valid = Number.isInteger(n) && n >= 0 && n < list.length

    switch (verb.toLowerCase()) {
      case '':
      case 'list':
        return { text: list.length ? list.map((t, i) => `${i + 1}. [${t.done ? 'x' : ' '}] ${t.text}`).join('\n') : 'Your to-do list is empty.\n\n' + HELP }
      case 'add':
        if (!arg) return { text: 'What should I add? Example: /todo add call the bank' }
        await saveTodos($, [...list, { text: arg, done: false }])
        return { text: `Added #${list.length + 1}: ${arg}` }
      case 'done':
      case 'undo':
        if (!valid) return { text: `There's no item ${arg || '(number missing)'}. Type /todo to see the numbers.` }
        await saveTodos($, list.map((t, i) => (i === n ? { ...t, done: verb.toLowerCase() === 'done' } : t)))
        return { text: `${verb.toLowerCase() === 'done' ? 'Ticked' : 'Unticked'}: ${list[n]?.text ?? ""}` }
      case 'remove':
      case 'delete':
        if (!valid) return { text: `There's no item ${arg || '(number missing)'}. Type /todo to see the numbers.` }
        await saveTodos($, list.filter((_, i) => i !== n))
        return { text: `Removed: ${list[n]?.text ?? ""}` }
      case 'clear': {
        const left = list.filter(t => !t.done)
        await saveTodos($, left)
        return { text: `Cleared ${list.length - left.length} ticked item(s).` }
      }
      default:
        // "/todo buy milk" with no verb adds it.
        await saveTodos($, [...list, { text: e.args.trim(), done: false }])
        return { text: `Added #${list.length + 1}: ${e.args.trim()}` }
    }
  })

  // Suggest skills that match what was just asked.
  on('prompt.submit', async ($, e, next) => {
    if (!e.command && !e.isMeta) {
      const cat = (await read($, catalog)).skills.length ? await read($, catalog) : await refreshCatalog($)
      await update($, suggested, () => suggest(e.text, cat.skills))
    }
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const list = await read($, todos)
    const cat = await read($, catalog)
    const tips = await read($, suggested)
    const room = Math.max(4, (e.viewport?.rows ?? 30) - 14 - list.length - tips.length)

    const toggle = (i: number) => async () => {
      const now = await loadTodos($)
      if (now[i]) await saveTodos($, now.map((t, j) => (j === i ? { ...t, done: !t.done } : t)))
    }

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Text bold color="claude">To-do</Text>
          {list.length === 0 && <Text dimColor>Empty. Type /todo add something</Text>}
          {list.map((t, i) => (
            <Box key={`t${i}`}>
              <Button key={`b${i}`} label={t.done ? '[x]' : '[ ]'} onPress={toggle(i)} />
              <Text strikethrough={t.done} dimColor={t.done}> {i + 1}. {t.text}</Text>
            </Box>
          ))}
        </Box>

        <Box flexDirection="column">
          <Text bold color="claude">Active plugins & mods ({cat.plugins.length})</Text>
          <Text wrap="wrap">{cat.plugins.join(', ') || 'Loading. Run /panel again'}</Text>
        </Box>

        {tips.length > 0 && (
          <Box flexDirection="column">
            <Text bold color="claude">Suggested for your last message</Text>
            {tips.map(s => (
              <Text key={`s${s.name}`}>/{s.name} <Text dimColor>{s.description.slice(0, 70)}</Text></Text>
            ))}
          </Box>
        )}

        <Box flexDirection="column">
          <Text bold color="claude">Skills & commands you can use ({cat.skills.length})</Text>
          {cat.skills.slice(0, room).map(s => (
            <Text key={`k${s.name}`} dimColor>/{s.name}</Text>
          ))}
          {cat.skills.length > room && <Text dimColor>…and {cat.skills.length - room} more (type / to browse)</Text>}
        </Box>
      </Box>
    )
  })
}
