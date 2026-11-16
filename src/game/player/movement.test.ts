import { describe, expect, test } from 'vitest'
import { boxHits, createPlayer, stepPlayer, type PlayerInput, type PlayerState } from './movement.ts'
import { PLAYER } from './tuning.ts'

// A flat floor at y = 100 (cells at y >= 100 are solid), plus optional extras.
const flat = (extra: (x: number, y: number) => boolean = () => false) => (x: number, y: number) => y >= 100 || extra(x, y)
const DT = 1 / 60

function run(s: PlayerState, input: PlayerInput, seconds: number, solid = flat()) {
  const events = []
  for (let t = 0; t < seconds; t += DT) events.push(stepPlayer(s, input, DT, solid))
  return events
}
const idle: PlayerInput = { move: 0, jump: false }

describe('player movement', () => {
  test('settles onto the floor and stands there', () => {
    const s = createPlayer(50, 90)
    run(s, idle, 1)
    expect(s.grounded).toBe(true)
    expect(s.y).toBeCloseTo(100, 5)
    expect(boxHits(flat(), s.x, s.y)).toBe(false)
  })

  test('walks right at walking speed', () => {
    const s = createPlayer(50, 100)
    run(s, idle, 0.1)
    run(s, { move: 1, jump: false }, 1)
    expect(s.vx).toBeCloseTo(PLAYER.walkSpeed, 5)
    expect(s.x).toBeGreaterThan(50 + PLAYER.walkSpeed * 0.9)
  })

  test('a held jump rises about three body heights, a tapped one much less', () => {
    const peak = (holdFor: number) => {
      const s = createPlayer(50, 100)
      run(s, idle, 0.1)
      let top = s.y
      for (let t = 0; t < 1.5; t += DT) {
        stepPlayer(s, { move: 0, jump: t < holdFor }, DT, flat())
        top = Math.min(top, s.y)
      }
      return 100 - top
    }
    const full = peak(1), tap = peak(0.05)
    expect(full).toBeGreaterThan(PLAYER.size * 2.6)
    expect(full).toBeLessThan(PLAYER.size * 3.4)
    expect(tap).toBeLessThan(full * 0.5)
  })

  test('can still jump just after walking off a ledge', () => {
    const ledge = (x: number, y: number) => (y >= 100 && x < 60) || y >= 200
    const s = createPlayer(50, 100)
    run(s, idle, 0.1, ledge)
    // Walk until the player has just left the ledge, then jump.
    while (s.grounded) stepPlayer(s, { move: 1, jump: false }, DT, ledge)
    const ev = stepPlayer(s, { move: 1, jump: true }, DT, ledge)
    expect(ev.jumped).toBe(true)
  })

  test('a jump pressed just before landing still happens', () => {
    const s = createPlayer(50, 70)
    let jumped = false
    for (let t = 0; t < 1 && !jumped; t += DT) {
      const nearFloor = s.y > 100 - 4 && !s.grounded
      jumped = stepPlayer(s, { move: 0, jump: nearFloor || (s.jumpHeld && !s.grounded) }, DT, flat()).jumped
    }
    expect(jumped).toBe(true)
  })

  test('steps up a small bump without jumping, but stops at a wall', () => {
    const bump = flat((x, y) => x >= 70 && y >= 98) // 2 cells high
    const s = createPlayer(50, 100)
    run(s, idle, 0.1, bump)
    run(s, { move: 1, jump: false }, 1, bump)
    expect(s.x).toBeGreaterThan(80)
    expect(s.y).toBeCloseTo(98, 5)

    const wall = flat((x, y) => x >= 70 && y >= 80)
    const w = createPlayer(50, 100)
    run(w, idle, 0.1, wall)
    run(w, { move: 1, jump: false }, 1, wall)
    expect(w.x).toBeCloseTo(70 - PLAYER.size / 2, 5)
  })

  test('reports a landing with an impact that grows with the fall', () => {
    const landing = (fromY: number) => {
      const s = createPlayer(50, fromY)
      return run(s, idle, 2).find((e) => e.landed >= 0)?.landed ?? -1
    }
    const small = landing(80), big = landing(10)
    expect(small).toBeGreaterThanOrEqual(0)
    expect(big).toBeGreaterThan(small)
  })
})
