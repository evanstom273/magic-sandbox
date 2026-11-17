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

describe('triggers', () => {
  const me = () => body(20, 60, true)
  const withTrig = (kind: 'impact' | 'delay' | 'near' | 'recast', shape: Spell['shape'] = 'projectile'): Spell =>
    ({ elements: ['water'], shape, cast: 'instant', trigger: { kind, then: { elements: ['heat'], shape: 'aoe' } } })
  const heatAt = (m: Magic) => m.flashes.filter((f) => f.colour === 0xff8a2a).length

  test('on impact: a bolt sets off its follow-up where it hits', () => {
    const m = new Magic(room())
    const c = me(); m.bodies = [c]
    m.cast(withTrig('impact'), once, { x: 24, y: 50 }, { x: 60, y: 62 }, c, { slot: 0 })
    for (let t = 0; t < 2 && m.projectiles.length; t += DT) m.update(DT)
    expect(m.projectiles).toHaveLength(0)
    expect(heatAt(m)).toBeGreaterThan(0) // the heat AoE went off as the water bolt landed
  })

  test('after a delay: the follow-up goes off a second later, wherever the bolt has got to', () => {
    const m = new Magic(room())
    const c = me(); m.bodies = [c]
    m.cast(withTrig('delay'), once, { x: 24, y: 20 }, { x: 140, y: 20 }, c, { slot: 0 })
    run(m, 0.5)
    expect(m.projectiles[0].trig).toBeDefined()
    run(m, 0.6)
    expect(m.projectiles[0]?.trig).toBeUndefined()
  })

  test('when something comes near: an AoE\'s follow-up waits until a body arrives', () => {
    const m = new Magic(room())
    const c = me(), dummy = body(140, 60)
    m.bodies = [c, dummy]
    m.cast(withTrig('near', 'aoe'), once, { x: 24, y: 50 }, { x: 90, y: 55 }, c, { slot: 0 })
    run(m, 1)
    expect(m.anchors).toHaveLength(1)
    dummy.x = m.anchors[0].x
    run(m, 0.1)
    expect(m.anchors).toHaveLength(0)
  })

  test('on recast: the follow-up waits for the same slot to be cast again', () => {
    const m = new Magic(room())
    const c = me(); m.bodies = [c]
    m.cast(withTrig('recast', 'aoe'), once, { x: 24, y: 50 }, { x: 90, y: 55 }, c, { slot: 2 })
    run(m, 2)
    expect(m.hasRecast(2)).toBe(true)
    expect(m.hasRecast(1)).toBe(false)
    m.recast(2)
    expect(m.hasRecast(2)).toBe(false)
    expect(m.anchors).toHaveLength(0)
  })

  test('a rune with "after a delay" goes off by itself a second after it\'s placed', () => {
    const m = new Magic(room())
    const c = me(); m.bodies = [c]
    m.cast(withTrig('delay', 'rune'), once, { x: 24, y: 50 }, { x: 60, y: 70 }, c, { slot: 0 })
    expect(m.runes).toHaveLength(1)
    run(m, 1.2)
    expect(m.runes).toHaveLength(0)
  })

  test('a held spell sets its trigger where it ends when it\'s let go', () => {
    const m = new Magic(room())
    const c = me(); m.bodies = [c]
    const beam: Spell = { elements: ['heat'], shape: 'beam', cast: 'channeled', trigger: { kind: 'recast', then: { elements: ['water'], shape: 'aoe' } } }
    for (let i = 0; i < 10; i++) m.cast(beam, { strength: 1, sustained: true, dt: DT }, { x: 26, y: 53 }, { x: 140, y: 53 }, c, { slot: 1 })
    expect(m.anchors).toHaveLength(0)
    m.channelEnded(beam, 1, { x: 26, y: 53 }, { x: 140, y: 53 }, c)
    expect(m.hasRecast(1)).toBe(true)
  })
})

describe('the field forces', () => {
  test('Gravity leaves a well that pulls a body in, then wears off', () => {
    const m = new Magic(room())
    const me = body(20, 60, true), dummy = body(80, 60)
    m.bodies = [me, dummy]
    m.cast({ elements: ['gravity'], shape: 'aoe', cast: 'instant' }, once, { x: 24, y: 50 }, { x: 70, y: 45 }, me)
    expect(m.zones.map((z) => z.kind)).toEqual(['pull'])
    run(m, 0.2)
    expect(dummy.pushed.x).toBeLessThan(0) // towards the well
    run(m, 6)
    expect(m.zones).toHaveLength(0)
  })

  test('Time slows inside its bubble; mixed with Life it speeds things up', () => {
    const m = new Magic(room())
    const me = body(20, 60, true)
    m.bodies = [me]
    m.cast({ elements: ['time'], shape: 'aoe', cast: 'instant' }, once, { x: 24, y: 50 }, { x: 70, y: 45 }, me)
    expect(m.timeScaleAt(70, 45)).toBeLessThan(1)
    expect(m.timeScaleAt(20, 30)).toBe(1)
    m.cast({ elements: ['time', 'life'], shape: 'aoe', cast: 'instant' }, once, { x: 24, y: 50 }, { x: 120, y: 45 }, me)
    expect(m.timeScaleAt(120, 45)).toBeGreaterThan(1)
  })

  test('Void cast on yourself blinks you along the aim, stopping short of a wall', () => {
    const g = room()
    for (let y = 30; y < 60; y++) for (let x = 50; x < 54; x++) g.set(x, y, M.STONE)
    const m = new Magic(g)
    const me = body(20, 60, true)
    me.moveTo = (x: number, y: number) => { me.x = x; me.y = y }
    m.bodies = [me]
    m.cast({ elements: ['void'], shape: 'self', cast: 'instant' }, once, { x: 24, y: 52 }, { x: 100, y: 52 }, me)
    expect(me.x).toBeGreaterThan(40)
    expect(me.x).toBeLessThan(50 - 4) // stopped before the wall
  })

  test('Void eats the cells of whatever it lands on, the caster\'s too if careless', () => {
    const m = new Magic(room())
    let hurt = 0
    const me = Object.assign(body(60, 60, true), { hurt(n: number) { hurt += n } })
    m.bodies = [me]
    m.cast({ elements: ['void'], shape: 'aoe', cast: 'instant' }, once, { x: 64, y: 50 }, { x: 60, y: 54 }, me)
    expect(hurt).toBeGreaterThan(0)
  })

  test('a spell of Life and Decay fizzles', () => {
    const m = new Magic(room())
    const me = body(20, 60, true)
    m.bodies = [me]
    m.cast({ elements: ['life', 'decay'], shape: 'projectile', cast: 'instant' }, once, { x: 24, y: 50 }, { x: 100, y: 50 }, me)
    expect(m.projectiles).toHaveLength(0)
  })
})
