// Turns the Element Codex page into ELEMENT_CODEX.md: node scripts/codex-to-md.cjs docs/element-codex.html ELEMENT_CODEX.md
const fs = require('fs')
const vm = require('vm')
const [, , src, out] = process.argv
const html = fs.readFileSync(src, 'utf8')
const grab = (name, open, close) => {
  const start = html.indexOf(`const ${name} = ${open}`)
  if (start < 0) throw new Error('missing ' + name)
  let depth = 0, i = html.indexOf(open, start)
  for (; i < html.length; i++) {
    if (html[i] === open) depth++
    else if (html[i] === close && --depth === 0) break
  }
  return vm.runInNewContext('(' + html.slice(html.indexOf(open, start), i + 1) + ')')
}
const E = grab('E', '[', ']'), COLS = grab('COLS', '[', ']'), M = grab('M', '{', '}'), C = grab('C', '[', ']')
const KINDS = [['force', 'Forces'], ['liquid', 'Liquids'], ['gas', 'Gases'], ['solid', 'Solids and powders'], ['made', 'Made by reactions']]
const cell = (t) => (t ? t.replace(/\|/g, '\\|') : '—')
let md = `# Element Codex

Every element is two things: something you cast, and something in the world that reacts. When a spell mixes elements, or materials meet, the world decides what happens, by these rules (\`GAME_DESIGN.md\` #19, #20, #21).

**Status:** Lyra picked all 59 elements (#70, #71, #77). She approved the first 27 as written (#76); **the 32 added in round two are her picks with Claude's details**, still to review. Decisions made from it are recorded in \`GAME_DESIGN.md\`; this file is kept in step with the Element Codex artifact: https://claude.ai/artifact/DV9k7rdGQ1bbkGHdZbkVdL

## Elements
`
for (const [kind, title] of KINDS) {
  md += `\n### ${title}\n`
  for (const e of E.filter((x) => x.kind === kind)) {
    md += `\n#### ${e.name}${e.picked ? " (Lyra's element)" : e.added ? ' (added in round two; details to review)' : ''}\n\nColour: \`${e.col}\`${e.pattern ? ' (speckled)' : ''}\n\n`
    md += `- **In the world:** ${e.world}\n- **Cast:** ${e.cast}\n- **Draw it in from:** ${e.draw}\n`
  }
}
md += `\n## What each force does to each material\n\nCast a force at something and this is what happens. "Sustained" means it takes a held spell (a Beam, a channelled Cone), not a single bolt. The materials added in round two describe their own reactions on their cards and in the next section.\n\n`
md += `| Force ↓ on → | ${COLS.join(' | ')} |\n|${'---|'.repeat(COLS.length + 1)}\n`
for (const [id, row] of Object.entries(M)) md += `| **${E.find((e) => e.id === id).name}** | ${row.map(cell).join(' | ')} |\n`
md += `\n## When materials meet\n\nWhat happens on contact, with no spell involved.\n\n`
for (const [a, b] of C) md += `- **${a}:** ${b}\n`
md += `\n## Notes\n\n- Colours stay clear of the style guide's damage red and reward gold, and of the hero's white, so nothing in the world borrows those jobs.\n- Creatures (and the player) are made of cells, so fire, acid, decay and void eat their cells away, and Life mends them.\n- Miasma and rot are what decay leaves behind. Blood is a dark red, kept off the damage red; snow and salt are kept off the hero's white; gold is in reward gold on purpose, because it's treasure. Anything not listed would be a new element.\n- Numbers (how fast, how far, how long) come later, in play.\n`
fs.writeFileSync(out, md)
console.log(`${E.length} elements, ${Object.keys(M).length} forces × ${COLS.length} materials, ${C.length} contacts`)
