import { describe, expect, test } from 'vitest'
import { applyDisc, decay, mix, sound, unmake } from './elements.ts'
import { CellGrid, Material as M, type Field } from './grid.ts'
import { lifeFor } from './reactions.ts'
import { step, STEPS_PER_SECOND } from './simulate.ts'

function box(w = 40, h = 30): CellGrid {
  const g = new CellGrid(w, h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (x === 0 || x === w - 1 || y === h - 1) g.set(x, y, M.STONE)
  return g
}
const run = (g: CellGrid, seconds: number) => { for (let i = 0; i < seconds * STEPS_PER_SECOND; i++) step(g) }
const count = (g: CellGrid, m: number) => g.cells.filter((c) => c === m).length
const fill = (g: CellGrid, m: number, x0: number, x1: number, y0: number, y1: number) => {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) g.set(x, y, m, lifeFor(m))
}
/** Puts a field in the grid the way the magic does. */
function field(g: CellGrid, f: Field): void {
  g.fields = [f]
  g.field.fill(0)
  for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) if ((x + 0.5 - f.x) ** 2 + (y + 0.5 - f.y) ** 2 <= f.r * f.r) g.field[y * g.width + x] = 1
}

describe('the forces (Element Codex)', () => {
  test('Decay rots wood and plants and corrodes metal, slowly; salt stops it; gold never rots', () => {
    const g = box()
    fill(g, M.WOOD, 2, 10, 20, 22)
    fill(g, M.METAL, 12, 20, 20, 24)
    fill(g, M.GOLD, 22, 28, 20, 22)
    for (let i = 0; i < 20; i++) for (let y = 20; y < 22; y++) for (let x = 2; x < 28; x++) decay(g, x, y)
    for (let i = 0; i < 10; i++) for (let y = 22; y < 24; y++) for (let x = 12; x < 20; x++) decay(g, x, y)
    expect(count(g, M.WOOD)).toBeLessThan(4)
    expect(count(g, M.METAL)).toBeLessThan(32)
    expect(count(g, M.METAL)).toBeGreaterThan(10) // slowly
    expect(count(g, M.GOLD)).toBe(12)
    const h = box()
    h.set(10, 20, M.WOOD); h.set(10, 19, M.SALT)
    for (let i = 0; i < 20; i++) decay(h, 10, 20)
    expect(h.get(10, 20)).toBe(M.WOOD)
  })

  test('Life and Decay cancel where they meet', () => {
    expect(mix(['life', 'decay'])).toEqual([])
    expect(mix(['decay', 'heat'])).toEqual(['decay', 'heat'])
  })

  test('Void unmakes anything but obsidian; meeting liquid mana it bursts', () => {
    const g = box()
    fill(g, M.STONE, 5, 15, 20, 29)
    fill(g, M.OBSIDIAN, 15, 20, 20, 29)
    applyDisc(g, ['void'], 15, 24, 5)
    expect(g.get(12, 24)).toBe(M.EMPTY)
    expect(count(g, M.OBSIDIAN)).toBe(45)
    const h = box(60, 40)
    fill(h, M.STONE, 1, 59, 20, 39)
    fill(h, M.MANA, 28, 32, 18, 20)
    unmake(h, 30, 19)
    expect(h.blasts.length).toBe(1)
    expect(h.get(30, 25)).toBe(M.EMPTY) // a hole well into the stone below
  })

  test('Sound shatters glass, ice and crystal, and shakes rubble down from a ceiling', () => {
    const g = box()
    fill(g, M.GLASS, 10, 15, 25, 29)
    fill(g, M.ICE, 16, 21, 25, 29)
    fill(g, M.STONE, 20, 30, 5, 8)
    for (let i = 0; i < 6; i++) applyDisc(g, ['sound'], 15, 26, 8)
    expect(count(g, M.GLASS)).toBeLessThan(10)
    expect(count(g, M.SNOW)).toBeGreaterThan(5)
    for (let i = 0; i < 30; i++) for (let x = 20; x < 30; x++) sound(g, x, 7)
    expect(count(g, M.RUBBLE)).toBeGreaterThan(0)
  })

  test('a gravity well gathers a pool of water up into a floating ball', () => {
    const g = box()
    fill(g, M.WATER, 1, 39, 24, 29)
    field(g, { kind: 'pull', x: 20, y: 18, r: 12 })
    run(g, 3)
    let lowest = 0
    for (let y = 0; y < 29; y++) for (let x = 14; x < 26; x++) if (g.get(x, y) === M.WATER && Math.hypot(x - 20, y - 18) < 4) lowest++
    expect(lowest).toBeGreaterThan(20) // a ball round the middle, up in the air
  })

  test('packed in a gravity well, sand turns to stone', () => {
    const g = box()
    fill(g, M.SAND, 12, 28, 10, 26)
    field(g, { kind: 'pull', x: 20, y: 18, r: 12 })
    run(g, 5)
    expect(count(g, M.STONE)).toBeGreaterThan(110 + 3) // the box's own stone is 110 cells
  })

  test('a magnet pulls metal towards it, and only metal', () => {
    const g = box()
    fill(g, M.METAL, 2, 5, 26, 29)
    fill(g, M.STONE, 35, 38, 26, 29)
    field(g, { kind: 'magnet', x: 20, y: 20, r: 20 })
    run(g, 2)
    expect(g.get(3, 27)).not.toBe(M.METAL)
    let near = 0
    for (let y = 15; y < 26; y++) for (let x = 15; x < 26; x++) if (g.get(x, y) === M.METAL) near++
    expect(near).toBeGreaterThan(4)
    expect(g.get(36, 27)).toBe(M.STONE)
  })

  test('slowed time: sand hangs in the air; sped-up time: lava cools to stone and honey turns to amber', () => {
    const g = box()
    fill(g, M.SAND, 18, 22, 5, 7)
    field(g, { kind: 'slow', x: 20, y: 8, r: 8 })
    run(g, 0.5)
    let high = 0
    for (let y = 0; y < 16; y++) for (let x = 0; x < 40; x++) if (g.get(x, y) === M.SAND) high++
    expect(high).toBeGreaterThan(4) // most of it still up there
    const h = box()
    fill(h, M.LAVA, 5, 15, 27, 29)
    fill(h, M.HONEY, 25, 35, 27, 29)
    field(h, { kind: 'fast', x: 20, y: 26, r: 20 })
    run(h, 6)
    expect(count(h, M.LAVA)).toBeLessThan(10)
    expect(count(h, M.AMBER)).toBeGreaterThan(5)
  })
})
