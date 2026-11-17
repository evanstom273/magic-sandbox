import { describe, expect, test } from 'vitest'
import { light, mix, shadow } from './elements.ts'
import { CellGrid, Material as M } from './grid.ts'
import { LIGHTING, LightMap } from './light.ts'
import { electrify, GLOW, lifeFor } from './reactions.ts'
import { step, STEPS_PER_SECOND } from './simulate.ts'

function box(w = 60, h = 30): CellGrid {
  const g = new CellGrid(w, h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (x === 0 || x === w - 1 || y === h - 1) g.set(x, y, M.STONE)
  return g
}
const fill = (g: CellGrid, m: number, x0: number, x1: number, y0: number, y1: number) => {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) g.set(x, y, m, lifeFor(m))
}
const count = (g: CellGrid, m: number) => g.cells.filter((c) => c === m).length

describe('light and dark', () => {
  test('the world is dark but for what glows: lava lights its surroundings, warm', () => {
    const g = box(200, 30)
    fill(g, M.LAVA, 10, 14, 27, 29)
    const l = new LightMap(g.width, g.height)
    l.compute(g, [])
    const at = (x: number, y: number) => l.r[y * g.width + x]
    expect(at(190, 10)).toBeCloseTo(LIGHTING.ambient, 2) // far off: just the dark
    expect(at(12, 24)).toBeGreaterThan(0.8) // above the lava: lit
    expect(l.r[24 * g.width + 12]).toBeGreaterThan(l.b[24 * g.width + 12]) // and warm
  })

  test('rock throws shadows; glass lets light through', () => {
    const g = box()
    fill(g, M.STONE, 20, 26, 0, 29) // a thick wall
    const l = new LightMap(g.width, g.height)
    l.compute(g, [{ x: 10, y: 15, r: 1.5, g: 1.5, b: 1.5 }])
    expect(l.r[15 * g.width + 30]).toBeLessThan(LIGHTING.ambient + 0.05) // behind the wall: dark
    fill(g, M.GLASS, 20, 26, 0, 29)
    l.compute(g, [{ x: 10, y: 15, r: 1.5, g: 1.5, b: 1.5 }])
    expect(l.r[15 * g.width + 30]).toBeGreaterThan(LIGHTING.ambient + 0.3)
  })

  test('light reaches every way round a source, not just some directions', () => {
    const g = box()
    const l = new LightMap(g.width, g.height)
    l.compute(g, [{ x: 30.5, y: 15.5, r: 1.5, g: 1.5, b: 1.5 }])
    const at = (x: number, y: number) => l.r[y * g.width + x]
    expect(at(22, 23)).toBeCloseTo(at(38, 7), 3) // down-left matches up-right
    expect(at(22, 7)).toBeCloseTo(at(38, 23), 3)
    expect(at(22, 23)).toBeCloseTo(at(38, 23), 3)
  })

  test('Shadow pools darkness, and snuffs what glows in it', () => {
    const g = box()
    fill(g, M.LAVA, 28, 32, 27, 29)
    const l = new LightMap(g.width, g.height)
    l.compute(g, [], [{ x: 30, y: 26, radius: 8, strength: 0.85 }])
    expect(l.r[25 * g.width + 30]).toBeLessThan(LIGHTING.ambient)
  })

  test('Light makes glass glow for a while; it dispels ectoplasm; Shadow makes plants wilt', () => {
    const g = box()
    g.set(10, 28, M.GLASS)
    light(g, 10, 28)
    const l = new LightMap(g.width, g.height)
    l.compute(g, [])
    expect(l.r[27 * g.width + 10]).toBeGreaterThan(LIGHTING.ambient + 0.2)
    for (let i = 0; i < 13 * STEPS_PER_SECOND; i++) step(g)
    l.compute(g, [])
    expect(l.r[27 * g.width + 10]).toBeCloseTo(LIGHTING.ambient, 2)
    g.set(20, 20, M.ECTOPLASM, 1000)
    light(g, 20, 20)
    expect(g.get(20, 20)).toBe(M.EMPTY)
    g.set(30, 28, M.PLANT, GLOW)
    shadow(g, 30, 28)
    expect(g.life[28 * g.width + 30] & GLOW).toBe(0)
  })

  test('the codex mixes: Light and Shadow cancel; Shadow and Life make ectoplasm; Heat and Lightning make plasma', () => {
    expect(mix(['light', 'shadow'])).toEqual([])
    expect(mix(['shadow', 'life'])).toEqual(['ectoplasm'])
    expect(mix(['heat', 'lightning'])).toContain('plasma')
  })
})

describe('lightning', () => {
  test('runs through a whole pool and sets off gunpowder beside it, but not through stone', () => {
    const g = box()
    fill(g, M.WATER, 1, 40, 26, 29)
    fill(g, M.STONE, 40, 59, 26, 29)
    g.set(39, 25, M.GUNPOWDER)
    const { charged } = electrify(g, 5, 25)
    expect(charged.length).toBe(39 * 3)
    expect(g.blasts.length).toBeGreaterThan(0) // the charge reached it
  })

  test('fuses sand to glass where it strikes', () => {
    const g = box()
    fill(g, M.SAND, 1, 59, 25, 29)
    electrify(g, 30, 25)
    expect(count(g, M.GLASS)).toBeGreaterThan(0)
  })

})
