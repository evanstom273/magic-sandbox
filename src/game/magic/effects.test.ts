import { describe, expect, test } from 'vitest'
import { CellGrid, Material as M } from '../world/grid.ts'
import { Magic, type Body } from './effects.ts'
import type { Spell } from './spells.ts'

/** A room: stone floor at y = 60, open above. */
function room() {
  const g = new CellGrid(160, 70)
  for (let y = 60; y < 70; y++) for (let x = 0; x < 160; x++) g.set(x, y, M.STONE)
  return g
}
function body(x: number, y: number, isCaster = false) {
  const b: Body & { healed: number; pushed: { x: number; y: number }; touched: string[] } = {
    x, y, w: 10, h: 14, isCaster, healed: 0, pushed: { x: 0, y: 0 }, touched: [],
    heal(n) { this.healed += n },
    impulse(vx, vy) { this.pushed.x += vx; this.pushed.y += vy },
    thrust(ax, ay, dt) { this.pushed.x += ax * dt; this.pushed.y += ay * dt },
    affect(el) { this.touched.push(el) },
  }
  return b
}
const DT = 1 / 60
const once = { strength: 1, sustained: false, dt: DT }
const run = (m: Magic, s: number) => { for (let t = 0; t < s; t += DT) m.update(DT) }

describe('the shapes', () => {
  test('a Rune waits on the floor and goes off when a body comes near, not at the caster who placed it', () => {
    const m = new Magic(room())
    const me = body(20, 60, true), dummy = body(120, 60)
    m.bodies = [me, dummy]
    const spell: Spell = { elements: ['heat'], shape: 'rune', cast: 'instant' }
    m.cast(spell, once, { x: 24, y: 50 }, { x: 60, y: 70 }, me) // aimed down at the floor ahead
    expect(m.runes).toHaveLength(1)
    expect(m.runes[0].y).toBeGreaterThan(55)
    run(m, 0.5)
    expect(m.runes).toHaveLength(1) // nothing near yet
    dummy.x = m.runes[0].x
    run(m, 0.1)
    expect(m.runes).toHaveLength(0)
    expect(dummy.touched).toContain('heat')
  })

  test('Target lands on the body at the aim point', () => {
    const m = new Magic(room())
    const me = body(20, 60, true), dummy = body(70, 60)
    m.bodies = [me, dummy]
    m.cast({ elements: ['cold'], shape: 'target', cast: 'instant' }, once, { x: 24, y: 50 }, { x: 70, y: 53 }, me)
    expect(dummy.touched).toContain('cold')
  })

  test('a held Beam reaches the first body in its path and heals it with Life', () => {
    const m = new Magic(room())
    const me = body(20, 60, true), dummy = body(80, 60)
    m.bodies = [me, dummy]
    for (let i = 0; i < 30; i++) m.cast({ elements: ['life'], shape: 'beam', cast: 'channeled' }, { strength: 1, sustained: true, dt: DT }, { x: 26, y: 53 }, { x: 80, y: 53 }, me)
    expect(dummy.healed).toBeGreaterThan(0)
  })

  test('a Wave shoves bodies it crosses away from the caster, but not the caster', () => {
    const m = new Magic(room())
    const me = body(40, 60, true), dummy = body(60, 60)
    m.bodies = [me, dummy]
    m.cast({ elements: ['force'], shape: 'wave', cast: 'instant' }, once, { x: 45, y: 53 }, { x: 80, y: 53 }, me)
    run(m, 0.6)
    expect(dummy.pushed.x).toBeGreaterThan(50)
    expect(me.pushed.x).toBe(0)
  })

  test('Orbit motes circle the caster and burst on the first body they touch', () => {
    const m = new Magic(room())
    const me = body(40, 60, true), dummy = body(56, 60)
    m.bodies = [me, dummy]
    m.cast({ elements: ['water'], shape: 'orbit', cast: 'instant' }, once, { x: 45, y: 53 }, { x: 80, y: 53 }, me)
    const n = m.motes.length
    expect(n).toBeGreaterThanOrEqual(4)
    run(m, 3)
    expect(m.motes.length).toBeLessThan(n)
    expect(dummy.touched).toContain('water')
  })

  test('a Summoned wisp drifts after a body and gives off its elements; a Life wisp heals the caster', () => {
    const m = new Magic(room())
    const me = body(20, 60, true), dummy = body(90, 60)
    m.bodies = [me, dummy]
    m.cast({ elements: ['cold'], shape: 'summon', cast: 'instant' }, once, { x: 24, y: 50 }, { x: 60, y: 40 }, me)
    run(m, 4)
    expect(dummy.touched).toContain('cold')
    me.healed = 0
    m.cast({ elements: ['life'], shape: 'summon', cast: 'instant' }, once, { x: 24, y: 50 }, { x: 30, y: 40 }, me)
    run(m, 3)
    expect(me.healed).toBeGreaterThan(0)
  })
})
