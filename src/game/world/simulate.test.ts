import { describe, expect, test } from 'vitest'
import { applyDisc, cold, heat, life, push } from './elements.ts'
import { CellGrid, Material as M } from './grid.ts'
import { step, STEPS_PER_SECOND } from './simulate.ts'

/** A small box: stone floor and walls around an empty inside. */
function box(w = 40, h = 30): CellGrid {
  const g = new CellGrid(w, h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (x === 0 || x === w - 1 || y === h - 1) g.set(x, y, M.STONE)
  return g
}
const run = (g: CellGrid, seconds: number) => { for (let i = 0; i < seconds * STEPS_PER_SECOND; i++) step(g) }
const count = (g: CellGrid, m: number) => g.cells.filter((c) => c === m).length

describe('the world simulation', () => {
  test('sand falls and piles into a heap', () => {
    const g = box()
    for (let i = 0; i < 40; i++) g.set(20, 2 + (i % 5), M.SAND)
    for (let y = 2; y < 7; y++) for (let x = 18; x < 23; x++) g.set(x, y, M.SAND)
    const n = count(g, M.SAND)
    run(g, 2)
    expect(count(g, M.SAND)).toBe(n)
    expect(g.get(20, 28)).toBe(M.SAND) // reached the floor
    expect(g.get(20, 26)).toBe(M.SAND) // and piled up
    expect(g.get(3, 28)).toBe(M.EMPTY) // but not spread flat like water
  })

  test('water falls and spreads out across the floor', () => {
    const g = box()
    for (let y = 2; y < 10; y++) for (let x = 16; x < 24; x++) g.set(x, y, M.WATER) // enough for the floor and a bit
    run(g, 3)
    const floorRow = Array.from({ length: 38 }, (_, i) => g.get(i + 1, 28)).filter((m) => m === M.WATER).length
    expect(floorRow).toBeGreaterThan(30) // spread across the floor
    expect(g.get(20, 25)).toBe(M.EMPTY) // levelled out, not heaped
  })

  test('sand sinks through water', () => {
    const g = box()
    for (let y = 20; y < 29; y++) for (let x = 1; x < 39; x++) g.set(x, y, M.WATER)
    g.set(20, 5, M.SAND)
    run(g, 2)
    expect(g.get(20, 28) === M.SAND || g.get(19, 28) === M.SAND || g.get(21, 28) === M.SAND).toBe(true)
  })

  test('fire spreads along wood and burns it away, leaving smoke and ash', () => {
    const g = box()
    for (let x = 5; x < 35; x++) g.set(x, 20, M.WOOD)
    heat(g, 5, 20)
    run(g, 20)
    expect(count(g, M.WOOD)).toBe(0)
    expect(count(g, M.FIRE)).toBe(0)
  })

  test('heat boils water to steam, which rises and partly rains back', () => {
    const g = box()
    for (let y = 24; y < 29; y++) for (let x = 1; x < 39; x++) g.set(x, y, M.WATER)
    const before = count(g, M.WATER)
    applyDisc(g, ['heat'], 20, 26, 5)
    expect(count(g, M.STEAM)).toBeGreaterThan(10)
    expect(count(g, M.WATER)).toBeLessThan(before)
    run(g, 10)
    expect(count(g, M.STEAM)).toBe(0)
  })

  test('cold freezes water to ice you can stand on, and puts fire out', () => {
    const g = box()
    for (let y = 24; y < 29; y++) for (let x = 1; x < 39; x++) g.set(x, y, M.WATER)
    for (let x = 1; x < 39; x++) cold(g, x, 24)
    expect(g.get(10, 24)).toBe(M.ICE)
    expect(g.isSolid(10, 24)).toBe(true)
    g.set(20, 10, M.FIRE, 100)
    cold(g, 20, 10)
    expect(g.get(20, 10)).toBe(M.EMPTY)
  })

  test('a strong push breaks stone into rubble; a weak one only shoves loose stuff', () => {
    const g = box()
    for (let y = 10; y < 20; y++) for (let x = 15; x < 25; x++) g.set(x, y, M.STONE)
    push(g, 20, 15, 6, 0.3)
    expect(count(g, M.RUBBLE)).toBe(0)
    push(g, 20, 15, 6, 1)
    expect(count(g, M.RUBBLE)).toBeGreaterThan(5)
  })

  test('life grows plants on surfaces, not in mid-air', () => {
    const g = box()
    applyDisc(g, ['life'], 20, 27, 4)
    expect(count(g, M.PLANT)).toBeGreaterThan(0)
    const air = new CellGrid(20, 20)
    life(air, 10, 10)
    expect(count(air, M.PLANT)).toBe(0)
  })

  test('the edge of the world counts as stone and can never be changed', () => {
    const g = box()
    expect(g.get(-1, 5)).toBe(M.STONE)
    push(g, 0, 15, 8, 1)
    expect(g.get(-1, 15)).toBe(M.STONE)
  })
})

test('flames from a burning post stay short; the burning wood itself never floats away', () => {
  const g = new CellGrid(40, 160)
  for (let y = 120; y < 160; y++) for (let x = 18; x < 21; x++) g.set(x, y, M.WOOD)
  heat(g, 19, 120)
  let top = 999
  for (let i = 0; i < 6 * STEPS_PER_SECOND; i++) {
    step(g)
    for (let p = 0; p < g.cells.length; p++) if (g.cells[p] === M.FIRE) top = Math.min(top, Math.floor(p / 40))
  }
  expect(top).toBeGreaterThan(120 - 30) // flames reach well under 30 cells above the post
})
