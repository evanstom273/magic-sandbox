import { describe, expect, test } from 'vitest'
import { Caster, BURST_SHOTS, CHARGE_TIME, CONTINUOUS_GAP } from './caster.ts'
import { castCost, channelCost, isValid, Mana, SHAPES, type CastType, type Spell } from './spells.ts'

const DT = 1 / 60
const spell = (cast: CastType, shape: Spell['shape'] = 'projectile'): Spell => ({ elements: ['water'], shape, cast })
/** Holds cast for `hold` seconds, then releases and waits `after`; returns every cast made. */
function play(c: Caster, s: Spell, hold: number, after = 0.5, mana = new Mana()) {
  const out = []
  for (let t = 0; t < hold; t += DT) out.push(...c.update(s, true, DT, mana))
  for (let t = 0; t < after; t += DT) out.push(...c.update(s, false, DT, mana))
  return out
}

describe('casting types', () => {
  test('Instant casts once per press, the moment it\'s pressed (a tap is enough)', () => {
    const c = new Caster(), mana = new Mana()
    expect(c.update(spell('instant'), true, DT, mana)).toHaveLength(1)
    expect(c.update(spell('instant'), true, DT, mana)).toHaveLength(0)
    expect(c.update(spell('instant'), false, DT, mana)).toHaveLength(0)
  })

  test('Charged builds while held and fires on release, stronger the longer it was held', () => {
    const quick = play(new Caster(), spell('charged'), 0.1)
    const full = play(new Caster(), spell('charged'), CHARGE_TIME + 0.5)
    expect(quick).toHaveLength(1)
    expect(full).toHaveLength(1)
    expect(full[0].strength).toBeCloseTo(1.6, 5)
    expect(quick[0].strength).toBeLessThan(0.6)
  })

  test('Charged stops building at what mana can pay for', () => {
    const mana = new Mana()
    mana.value = castCost(spell('charged'), 0.8)
    const out = play(new Caster(), spell('charged'), CHARGE_TIME + 0.5, 0.1, mana)
    expect(out[0].strength).toBeLessThan(0.85)
  })

  test('Channeled sustains every frame while held and drains mana a second', () => {
    const mana = new Mana()
    const s = spell('channeled', 'beam')
    const out = play(new Caster(), s, 1, 0.2, mana)
    expect(out.length).toBeGreaterThan(55)
    expect(out.every((e) => e.sustained)).toBe(true)
    expect(mana.value).toBeCloseTo(100 - channelCost(s) * 1, 0)
  })

  test('Burst fires three shots from one press', () => {
    expect(play(new Caster(), spell('burst'), 0.05)).toHaveLength(BURST_SHOTS)
  })

  test('Continuous repeats shots while held', () => {
    const out = play(new Caster(), spell('continuous'), 1, 0.3)
    expect(out.length).toBeGreaterThanOrEqual(Math.floor(1 / CONTINUOUS_GAP))
    expect(out.length).toBeLessThanOrEqual(Math.ceil(1 / CONTINUOUS_GAP) + 1)
  })

  test('mana doesn\'t refill while casting, only once cast is let go', () => {
    const mana = new Mana()
    mana.value = 50
    const c = new Caster()
    const s = spell('charged')
    for (let t = 0; t < 1; t += DT) { c.update(s, true, DT, mana); mana.update(DT, c.casting) }
    expect(mana.value).toBe(50) // a second of charging: no refill
    for (let t = 0; t < 1; t += DT) { c.update(s, false, DT, mana); mana.update(DT, c.casting) }
    expect(mana.value).toBeGreaterThan(50 - 10) // after the cast's cost, it refills again
    const before = mana.value
    for (let t = 0; t < 1; t += DT) { c.update(s, false, DT, mana); mana.update(DT, c.casting) }
    expect(mana.value).toBeCloseTo(before + mana.regen, 0)
  })

  test('nothing casts without the mana for it', () => {
    const mana = new Mana()
    mana.value = 1
    expect(play(new Caster(), spell('instant'), 0.1, 0.1, mana)).toHaveLength(0)
  })
})

describe('the spell model', () => {
  test('each shape allows the casting types decided (#80), and Weapon enchantment waits for weapons', () => {
    const types = Object.fromEntries(SHAPES.map((s) => [s.id, s.types]))
    expect(types.projectile).toEqual(['instant', 'charged', 'burst', 'continuous'])
    expect(types.beam).toEqual(['channeled'])
    expect(types.rune).toEqual(['instant', 'charged'])
    expect(types.cone).toEqual(['instant', 'charged', 'channeled', 'continuous'])
    expect(types.enchant).toEqual([])
    expect(isValid({ elements: ['heat'], shape: 'beam', cast: 'instant' })).toBe(false)
    expect(isValid({ elements: ['heat', 'water', 'sand'], shape: 'aoe', cast: 'instant' })).toBe(false) // the stand-in catalyst mixes two
  })

  test('more elements and stronger casts cost more', () => {
    const one: Spell = { elements: ['water'], shape: 'aoe', cast: 'instant' }
    const two: Spell = { elements: ['water', 'heat'], shape: 'aoe', cast: 'instant' }
    expect(castCost(two)).toBeGreaterThan(castCost(one))
    expect(castCost(one, 1.6)).toBeGreaterThan(castCost(one, 1))
  })
})

describe('building spells', () => {
  test('elements toggle in and out, a third replaces the oldest, and a spell keeps at least one', async () => {
    const { toggleElement } = await import('./spells.ts')
    let s: Spell = { elements: ['water'], shape: 'projectile', cast: 'instant' }
    s = toggleElement(s, 'heat')
    expect(s.elements).toEqual(['water', 'heat'])
    s = toggleElement(s, 'cold')
    expect(s.elements).toEqual(['heat', 'cold'])
    s = toggleElement(s, 'heat')
    expect(s.elements).toEqual(['cold'])
    expect(toggleElement(s, 'cold').elements).toEqual(['cold'])
  })

  test('changing shape keeps the casting type if it can, otherwise takes the shape\'s first', async () => {
    const { withShape } = await import('./spells.ts')
    const charged: Spell = { elements: ['water'], shape: 'projectile', cast: 'charged' }
    expect(withShape(charged, 'aoe').cast).toBe('charged')
    expect(withShape(charged, 'beam').cast).toBe('channeled')
    expect(withShape(charged, 'enchant')).toBe(charged) // can't pick Weapon enchantment yet
  })
})
