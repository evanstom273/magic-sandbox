// Turns the Element Codex page into the game's copy of it, for the in-game guide:
// node scripts/codex-to-json.cjs docs/element-codex.html src/game/magic/codex.json
// The codex page stays the one source; a unit test fails if this copy falls behind it.
const fs = require('fs')
const vm = require('vm')
const [, , src, out] = process.argv

function readCodex(html) {
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
  return {
    elements: E.map((e) => ({ id: e.id, name: e.name, kind: e.kind, colour: e.col, world: e.world, cast: e.cast, draw: e.draw })),
    columns: COLS,
    forces: M,
    contacts: C,
  }
}

module.exports = { readCodex }
if (require.main === module) fs.writeFileSync(out, JSON.stringify(readCodex(fs.readFileSync(src, 'utf8')), null, 1) + '\n')
