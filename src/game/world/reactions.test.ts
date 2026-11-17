import { describe, expect, test } from 'vitest'
import { applyDisc, cold, heat, life, push } from './elements.ts'
import { CellGrid, Material as M } from './grid.ts'
import { GOLD, lifeFor } from './reactions.ts'
import { step, STEPS_PER_SECOND } from './simulate.ts'

/** A small box: stone floor and walls around an empty inside. */
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

describe('when materials meet (Element Codex)', () => {
  test('lava meeting water makes obsidian and a burst of steam', () => {
    const g = box()
    fill(g, M.WATER, 1, 39, 25, 29)
    fill(g, M.LAVA, 15, 25, 18, 22)
    run(g, 3)
    expect(count(g, M.OBSIDIAN)).toBeGreaterThan(5)
    expect(count(g, M.STEAM) + count(g, M.WATER)).toBeGreaterThan(0)
  })

  test('acid eats stone, giving off smoke, but obsidian, glass and gold hold it', () => {
    const g = box(40, 30)
    fill(g, M.STONE, 5, 10, 20, 29)
    fill(g, M.OBSIDIAN, 15, 20, 20, 29)
    fill(g, M.GLASS, 22, 27, 20, 29)
    fill(g, M.GOLD, 29, 34, 20, 29)
    const stone = count(g, M.STONE)
    fill(g, M.ACID, 5, 34, 16, 20)
    run(g, 4)
    expect(count(g, M.STONE)).toBeLessThan(stone)
    expect(count(g, M.OBSIDIAN)).toBe(45)
    expect(count(g, M.GLASS)).toBe(45)
    expect(count(g, M.GOLD)).toBe(45)
  })

  test('acid is diluted by water', () => {
    const g = box()
    fill(g, M.WATER, 1, 39, 20, 29)
    fill(g, M.ACID, 18, 22, 10, 14)
    run(g, 20)
    expect(count(g, M.ACID)).toBeLessThan(8)
  })

  test('a gunpowder trail lit at one end burns along and blows the stone apart; metal holds', () => {
    const g = box(60, 30)
    fill(g, M.STONE, 1, 59, 20, 29)
    fill(g, M.METAL, 40, 50, 20, 29)
    for (let x = 5; x < 45; x++) g.set(x, 19, M.GUNPOWDER)
    heat(g, 5, 19)
    run(g, 2)
    expect(count(g, M.GUNPOWDER)).toBe(0) // all of it went off
    expect(g.blasts.length).toBeGreaterThan(3)
    expect(count(g, M.RUBBLE)).toBeGreaterThan(5)
    expect(count(g, M.METAL)).toBe(90)
  })

  test('swamp gas explodes with a flame', () => {
    const g = box()
    fill(g, M.SWAMP_GAS, 15, 25, 10, 15)
    heat(g, 15, 12)
    run(g, 0.5)
    expect(g.blasts.length).toBeGreaterThan(1)
  })

  test('oil floats on water; mercury sinks beneath it', () => {
    const g = box()
    fill(g, M.OIL, 1, 39, 22, 25)
    fill(g, M.WATER, 1, 39, 25, 29)
    fill(g, M.MERCURY, 18, 22, 10, 12)
    run(g, 4)
    expect(g.get(20, 28)).toBe(M.MERCURY) // at the bottom
    expect(count(g, M.OIL)).toBe(114)
    let oilTop = 99, waterTop = 99
    for (let y = 0; y < 29; y++) for (let x = 1; x < 39; x++) {
      if (g.get(x, y) === M.OIL) oilTop = Math.min(oilTop, y)
      if (g.get(x, y) === M.WATER) waterTop = Math.min(waterTop, y)
    }
    expect(oilTop).toBeLessThan(waterTop)
  })

  test('water and dirt make mud; heat dries mud back to dirt', () => {
    const g = box()
    fill(g, M.DIRT, 1, 39, 25, 29)
    fill(g, M.WATER, 1, 39, 20, 25)
    run(g, 3)
    expect(count(g, M.MUD)).toBeGreaterThan(10)
    const mud = count(g, M.MUD)
    applyDisc(g, ['heat'], 20, 26, 8)
    expect(count(g, M.MUD)).toBeLessThan(mud)
  })

  test('salt dissolves into water; salty water won\'t freeze, and boiling it leaves the salt', () => {
    const g = box()
    fill(g, M.WATER, 1, 39, 24, 29)
    fill(g, M.SALT, 1, 39, 20, 22)
    run(g, 5)
    expect(count(g, M.SALT_WATER)).toBeGreaterThan(30)
    const x = g.cells.indexOf(M.SALT_WATER) % 40, y = Math.floor(g.cells.indexOf(M.SALT_WATER) / 40)
    cold(g, x, y)
    expect(g.get(x, y)).toBe(M.SALT_WATER)
    const h = box()
    fill(h, M.SALT_WATER, 1, 39, 28, 29)
    for (let i = 0; i < 10; i++) for (let x = 1; x < 39; x++) heat(h, x, 28)
    expect(count(h, M.SALT)).toBeGreaterThan(0)
    expect(count(h, M.SALT_WATER)).toBeLessThan(10)
  })

  test('molten metal sets back into metal, and molten gold into gold; water sets it at once', () => {
    const g = box()
    g.set(10, 28, M.MOLTEN, 30)
    g.set(20, 28, M.MOLTEN, GOLD | 30)
    run(g, 1)
    expect(count(g, M.METAL)).toBe(1)
    expect(count(g, M.GOLD)).toBe(1)
    const h = box()
    fill(h, M.WATER, 1, 39, 26, 29)
    fill(h, M.MOLTEN, 18, 22, 20, 22)
    run(h, 1)
    expect(count(h, M.METAL)).toBeGreaterThan(0)
  })

  test('heat melts gold, fires clay to brick; cold sets lava to obsidian, tar hard and mist to snow', () => {
    const g = box()
    fill(g, M.GOLD, 5, 10, 25, 29)
    for (let i = 0; i < 10; i++) applyDisc(g, ['heat'], 7, 27, 3)
    expect(count(g, M.MOLTEN)).toBeGreaterThan(0)
    fill(g, M.CLAY, 20, 25, 25, 29)
    for (let i = 0; i < 20; i++) applyDisc(g, ['heat'], 22, 27, 3)
    expect(count(g, M.BRICK)).toBeGreaterThan(5)
    const c = box()
    c.set(5, 20, M.LAVA); c.set(6, 20, M.TAR); c.set(7, 20, M.MIST, 1000); c.set(8, 20, M.QUICKSAND)
    for (let x = 5; x < 9; x++) cold(c, x, 20)
    expect([c.get(5, 20), c.get(6, 20), c.get(7, 20), c.get(8, 20)]).toEqual([M.OBSIDIAN, M.HARD_TAR, M.SNOW, M.FROZEN_QUICKSAND])
  })

  test('thermite, lit by sustained heat, burns down through metal', () => {
    const g = box(40, 40)
    fill(g, M.METAL, 1, 39, 20, 39)
    fill(g, M.THERMITE, 15, 25, 16, 20)
    for (let i = 0; i < 30; i++) applyDisc(g, ['heat'], 20, 17, 3, 1, true)
    run(g, 4)
    expect(count(g, M.METAL)).toBeLessThan(38 * 19 - 10)
  })

  test('wood buried with no air chars to coal beside lava instead of burning', () => {
    const g = box()
    fill(g, M.SAND, 1, 39, 20, 29)
    fill(g, M.WOOD, 10, 30, 24, 26)
    fill(g, M.LAVA, 10, 30, 26, 27)
    run(g, 20)
    expect(count(g, M.COAL)).toBeGreaterThan(0)
  })

  test('slime clings to a ceiling instead of dripping off', () => {
    const g = box()
    fill(g, M.STONE, 1, 39, 5, 8)
    fill(g, M.SLIME, 15, 25, 8, 9)
    run(g, 1)
    expect(count(g, M.SLIME)).toBe(10)
    expect(g.get(20, 8)).toBe(M.SLIME)
  })

  test('rot creeps along wood and crumbles to dirt; salt stops it; life heals it', () => {
    const g = box()
    fill(g, M.WOOD, 5, 35, 20, 21)
    g.set(5, 20, M.ROT, lifeFor(M.ROT))
    run(g, 40)
    expect(count(g, M.ROT) + count(g, M.DIRT)).toBeGreaterThan(3)
    const h = box()
    fill(h, M.WOOD, 5, 35, 20, 21)
    h.set(20, 20, M.ROT, 60000) // a long-lived rot, so it doesn't crumble during the test
    h.set(19, 19, M.SALT); h.set(20, 19, M.SALT); h.set(21, 19, M.SALT)
    run(h, 20)
    expect(count(h, M.ROT)).toBe(1)
    life(h, 20, 20)
    expect(h.get(20, 20)).toBe(M.WOOD)
  })

  test('seeds on dirt beside water sprout', () => {
    const g = box()
    fill(g, M.DIRT, 1, 39, 26, 29)
    fill(g, M.WATER, 1, 10, 21, 26) // a pond deep enough not to soak away first
    for (let x = 10; x < 14; x++) g.set(x, 25, M.SEEDS)
    run(g, 15)
    expect(count(g, M.PLANT)).toBeGreaterThan(0)
  })

  test('spirits burn fast with a pale blue flame; honey burns, then hardens to amber', () => {
    const g = box()
    fill(g, M.SPIRITS, 1, 39, 26, 29)
    heat(g, 20, 26)
    run(g, 0.2)
    expect(g.cells.some((c, p) => c === M.FIRE && (g.life[p] & 0x4000) !== 0)).toBe(true)
    run(g, 4)
    expect(count(g, M.SPIRITS)).toBe(0)
    const h = box()
    fill(h, M.HONEY, 1, 39, 27, 29)
    applyDisc(h, ['heat'], 20, 28, 6) // once: more heat would melt the amber back to honey (and burn it)
    expect(count(h, M.AMBER)).toBeGreaterThan(0)
  })

  test('dirt holds a slope where sand slumps flat', () => {
    const tall = (m: number) => {
      const g = box()
      fill(g, m, 18, 22, 5, 29)
      run(g, 4)
      let top = 99
      for (let p = 0; p < g.cells.length; p++) if (g.cells[p] === m) top = Math.min(top, Math.floor(p / 40))
      return 29 - top
    }
    expect(tall(M.DIRT)).toBeGreaterThan(tall(M.SAND) + 3)
  })

  test('salt melts ice; Force shatters ice to snow, and snow melts with heat', () => {
    const g = box()
    fill(g, M.ICE, 10, 30, 25, 29)
    for (let x = 10; x < 30; x++) g.set(x, 24, M.SALT)
    run(g, 3)
    expect(count(g, M.WATER)).toBeGreaterThan(3)
    const h = box()
    fill(h, M.ICE, 15, 25, 15, 20)
    push(h, 20, 17, 6, 1)
    const snow = count(h, M.SNOW)
    expect(snow).toBeGreaterThan(5)
    run(h, 2) // settles on the floor
    for (let i = 0; i < 3; i++) applyDisc(h, ['heat'], 20, 26, 12)
    expect(count(h, M.SNOW)).toBeLessThan(snow / 4)
  })

  test('mist rains out slowly into water', () => {
    const g = box()
    fill(g, M.MIST, 5, 35, 10, 14)
    run(g, 20)
    expect(count(g, M.WATER)).toBeGreaterThan(5)
  })
})

test('cast Fire is loose flames: they rise, burn out, and set alight what they touch', () => {
  const g = new CellGrid(40, 30)
  for (let y = 0; y < 30; y++) for (let x = 0; x < 40; x++) if (x === 0 || x === 39 || y === 29) g.set(x, y, M.STONE)
  for (let x = 5; x < 35; x++) g.set(x, 28, M.WOOD)
  applyDisc(g, ['fire'], 20, 26, 3)
  expect(g.cells.filter((c) => c === M.FIRE).length).toBeGreaterThan(5)
  for (let i = 0; i < 20 * STEPS_PER_SECOND; i++) step(g)
  expect(g.cells.filter((c) => c === M.WOOD).length).toBe(0) // the flames caught the wood, and it all burned
  expect(g.cells.filter((c) => c === M.FIRE).length).toBe(0)
})
