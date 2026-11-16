import { describe, expect, test } from 'vitest'
import { boxHits, createPlayer, stepPlayer, type PlayerInput, type PlayerState, type SolidAt } from './movement.ts'
import { PLAYER } from './tuning.ts'

// A flat floor at y = 100 (cells at y >= 100 are solid), plus optional extras.
const flat = (extra: SolidAt = () => false): SolidAt => (x, y) => y >= 100 || extra(x, y)
// A tall wall to the right, from x = 80.
const withWall = flat((x) => x >= 80)
const DT = 1 / 60
const input = (i: Partial<PlayerInput> = {}): PlayerInput => ({ move: 0, climb: 0, jump: false, grab: false, ...i })
const idle = input()

function run(s: PlayerState, inp: PlayerInput, seconds: number, solid: SolidAt = flat()) {
  const events = []
  for (let t = 0; t < seconds - 1e-9; t += DT) events.push(stepPlayer(s, inp, DT, solid))
  return events
}
function standing(x = 50, solid: SolidAt = flat()) {
  const s = createPlayer(x, 100)
  run(s, idle, 0.1, solid)
  return s
}

describe('walking and jumping', () => {
  test('settles onto the floor and stands there', () => {
    const s = createPlayer(50, 90)
    run(s, idle, 1)
    expect(s.grounded).toBe(true)
    expect(s.y).toBeCloseTo(100, 5)
    expect(boxHits(flat(), s.x, s.y)).toBe(false)
  })

  test('walks right at walking speed', () => {
    const s = standing()
    run(s, input({ move: 1 }), 1)
    expect(s.vx).toBeCloseTo(PLAYER.walkSpeed, 5)
    expect(s.x).toBeGreaterThan(50 + PLAYER.walkSpeed * 0.9)
  })

  test('a held jump rises about three body heights, a tapped one much less', () => {
    const peak = (holdFor: number) => {
      const s = standing()
      let top = s.y
      for (let t = 0; t < 1.5; t += DT) {
        stepPlayer(s, input({ jump: t < holdFor }), DT, flat())
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
    const ledge: SolidAt = (x, y) => (y >= 100 && x < 60) || y >= 200
    const s = standing(50, ledge)
    while (s.grounded) stepPlayer(s, input({ move: 1 }), DT, ledge)
    expect(stepPlayer(s, input({ move: 1, jump: true }), DT, ledge).jumped).toBe(true)
  })

  test('steps up a small bump without jumping, but stops flush at a wall', () => {
    const bump = flat((x, y) => x >= 70 && y >= 98)
    const s = standing(50, bump)
    run(s, input({ move: 1 }), 1, bump)
    expect(s.x).toBeGreaterThan(80)
    expect(s.y).toBeCloseTo(98, 5)

    const w = standing(50, withWall)
    run(w, input({ move: 1 }), 1, withWall)
    expect(w.x).toBeCloseTo(80 - PLAYER.size / 2, 5)
  })

  test('reports a landing with an impact that grows with the fall', () => {
    const landing = (fromY: number) => run(createPlayer(50, fromY), idle, 2).find((e) => e.landed >= 0)?.landed ?? -1
    const small = landing(80), big = landing(10)
    expect(small).toBeGreaterThanOrEqual(0)
    expect(big).toBeGreaterThan(small)
  })
})

describe('double jump', () => {
  test('one extra jump in the air, then no more until landing', () => {
    const s = standing()
    run(s, input({ jump: true }), 0.2)
    run(s, idle, 0.05)
    const second = stepPlayer(s, input({ jump: true }), DT, flat())
    expect(second.doubleJumped).toBe(true)
    expect(s.vy).toBeLessThan(0)
    run(s, idle, 0.05)
    expect(stepPlayer(s, input({ jump: true }), DT, flat()).doubleJumped).toBe(false)
    run(s, idle, 2)
    expect(s.grounded).toBe(true)
    expect(s.airJumps).toBe(PLAYER.airJumps)
  })

  test('grabbing a wall gives it back', () => {
    const s = standing(50, withWall) // far enough from the wall that a jump isn't a wall jump
    run(s, input({ jump: true }), 0.15, withWall)
    run(s, idle, 0.03, withWall)
    expect(stepPlayer(s, input({ jump: true }), DT, withWall).doubleJumped).toBe(true)
    expect(s.airJumps).toBe(0)
    s.x = 80 - PLAYER.size / 2 // now beside the wall, still in the air
    run(s, input({ grab: true }), 0.1, withWall)
    expect(s.climbing).toBe(1)
    expect(s.airJumps).toBe(PLAYER.airJumps)
  })
})

describe('walls', () => {
  // Hanging beside the wall, in the air, well above the floor.
  function onWall() {
    const s = createPlayer(80 - PLAYER.size / 2, 60)
    s.airJumps = 0
    return s
  }

  test('pushing into a wall in the air slides down it slowly', () => {
    const s = onWall()
    const ev = run(s, input({ move: 1 }), 0.5, withWall)
    expect(ev.at(-1)!.wallSliding).toBe(1)
    expect(s.vy).toBeLessThanOrEqual(PLAYER.wallSlideMax)
  })

  test('holding Grab clings with no time limit, and climbs up and down', () => {
    const s = onWall()
    run(s, input({ grab: true }), 5, withWall)
    expect(s.climbing).toBe(1)
    expect(s.y).toBeCloseTo(60, 0)
    run(s, input({ grab: true, climb: -1 }), 0.5, withWall)
    expect(s.y).toBeCloseTo(60 - PLAYER.climbUpSpeed * 0.5, 0)
    run(s, input({ grab: true, climb: 1 }), 0.25, withWall)
    expect(s.y).toBeGreaterThan(60 - PLAYER.climbUpSpeed * 0.5)
    run(s, idle, 0.05, withWall)
    expect(s.climbing).toBe(0)
  })

  test('jumping off a wall kicks away, and input cannot pull straight back for a moment', () => {
    const s = onWall()
    run(s, input({ grab: true }), 0.1, withWall)
    const ev = stepPlayer(s, input({ grab: true, move: -1, jump: true }), DT, withWall)
    expect(ev.wallJumped).toBe(1)
    expect(s.vx).toBeLessThan(0)
    expect(s.vy).toBeLessThan(0)
    const x = s.x
    run(s, input({ move: 1, jump: true }), PLAYER.wallJumpLock * 0.8, withWall)
    expect(s.x).toBeLessThan(x)
  })

  test('a wall jump also works without grabbing, from a cell or two away', () => {
    const s = onWall()
    s.x -= 1.5
    run(s, idle, 0.05, withWall)
    expect(stepPlayer(s, input({ jump: true }), DT, withWall).wallJumped).toBe(1)
  })

  test('jumping while grabbing with no direction hops straight up the wall', () => {
    const s = onWall()
    run(s, input({ grab: true }), 0.1, withWall)
    const x = s.x
    const ev = stepPlayer(s, input({ grab: true, jump: true }), DT, withWall)
    expect(ev.climbJumped).toBe(true)
    expect(s.vy).toBeLessThan(-PLAYER.climbJumpSpeed * 0.9)
    expect(s.x).toBeCloseTo(x, 5)
  })

  test('climbing past the top of a wall pops up onto it', () => {
    const ledge = flat((x, y) => x >= 80 && y >= 70)
    const s = createPlayer(80 - PLAYER.size / 2, 90)
    run(s, input({ grab: true }), 0.05, ledge)
    expect(s.climbing).toBe(1)
    let hopped = false
    for (let t = 0; t < 2 && !hopped; t += DT) hopped = stepPlayer(s, input({ grab: true, climb: -1, move: 1 }), DT, ledge).ledgeHopped
    expect(hopped).toBe(true)
    run(s, input({ move: 1 }), 1, ledge)
    expect(s.grounded).toBe(true)
    expect(s.y).toBeCloseTo(70, 5)
    expect(s.x).toBeGreaterThan(80)
  })
})
