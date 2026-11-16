import { describe, expect, test } from 'vitest'
import { boxHits, createPlayer, stepPlayer, type PlayerInput, type PlayerState, type SolidAt } from './movement.ts'
import { PLAYER } from './tuning.ts'

// A flat floor at y = 100 (cells at y >= 100 are solid), plus optional extras.
const flat = (extra: SolidAt = () => false): SolidAt => (x, y) => y >= 100 || extra(x, y)
// A tall wall to the right, from x = 80.
const withWall = flat((x) => x >= 80)
const DT = 1 / 60
const input = (i: Partial<PlayerInput> = {}): PlayerInput => ({ move: 0, climb: 0, jump: false, ...i })
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

  test('a jump pressed just before landing still happens (with the double jump used up)', () => {
    const s = createPlayer(50, 40)
    s.airJumps = 0
    while (s.y < 100 - 5) stepPlayer(s, idle, DT, flat())
    let jumped = false
    for (let t = 0; t < 0.5 && !jumped; t += DT) jumped = stepPlayer(s, input({ jump: true }), DT, flat()).jumped
    expect(jumped).toBe(true)
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

  test('clinging to a wall gives it back', () => {
    const s = standing(50, withWall) // far enough from the wall that a jump isn't a wall jump
    run(s, input({ jump: true }), 0.15, withWall)
    run(s, idle, 0.03, withWall)
    expect(stepPlayer(s, input({ jump: true }), DT, withWall).doubleJumped).toBe(true)
    expect(s.airJumps).toBe(0)
    s.x = 80 - PLAYER.size / 2 // now beside the wall, still in the air
    while (s.vy <= 0) stepPlayer(s, idle, DT, withWall)
    run(s, input({ move: 1 }), 0.2, withWall)
    expect(s.climbing).toBe(1)
    expect(s.airJumps).toBe(PLAYER.airJumps)
  })
})

describe('walls (auto grab)', () => {
  // Beside the wall, in the air, well above the floor.
  function nextToWall() {
    const s = createPlayer(80 - PLAYER.size / 2, 60)
    s.airJumps = 0
    return s
  }
  function clinging() {
    const s = nextToWall()
    run(s, input({ move: 1 }), 0.2, withWall)
    expect(s.climbing).toBe(1)
    return s
  }

  test('pushing into a wall while falling clings after a moment, and stays as long as you keep pushing', () => {
    const s = nextToWall()
    run(s, input({ move: 1 }), PLAYER.clingDelay * 0.5, withWall)
    expect(s.climbing).toBe(0) // brushing past doesn't grab
    const ev = run(s, input({ move: 1 }), PLAYER.clingDelay, withWall)
    expect(ev.some((e) => e.grabbed)).toBe(true)
    const y = s.y
    run(s, input({ move: 1 }), 5, withWall)
    expect(s.climbing).toBe(1)
    expect(s.y).toBeCloseTo(y, 5)
    run(s, idle, DT, withWall)
    expect(s.climbing).toBe(0) // let go of the stick and you drop off
  })

  test('bumps at the feet are never walls: no cling, no climb, no wall jump, just stepped over', () => {
    // A floor of 1–3 cell bumps every 9 cells, like the test room's.
    const bumpy: SolidAt = (x, y) => y >= 100 || (x % 9 < 3 && y >= 100 - 1 - (x % 3))
    const s = standing(20, bumpy)
    for (let t = 0; t < 3; t += DT) {
      // Walking right with the stick angled up a little, hopping now and then.
      const ev = stepPlayer(s, input({ move: 1, climb: -1, jump: Math.floor(t * 3) % 2 === 1 }), DT, bumpy)
      expect(s.climbing).toBe(0)
      expect(ev.wallJumped).toBe(0)
      expect(ev.ledgeHopped).toBe(false)
    }
    expect(s.x).toBeGreaterThan(20 + PLAYER.walkSpeed * 2.5)
  })

  test('a jump rising alongside a wall is not cut short by a cling', () => {
    const s = standing(80 - PLAYER.size / 2, withWall)
    stepPlayer(s, input({ move: 1, jump: true }), DT, withWall)
    run(s, input({ move: 1, jump: true }), 0.2, withWall)
    expect(s.climbing).toBe(0)
    expect(s.vy).toBeLessThan(0)
  })

  test('pushing up into a wall on the ground starts a climb, but up alone does not', () => {
    const s = standing(80 - PLAYER.size / 2, withWall)
    run(s, input({ climb: -1 }), 0.2, withWall)
    expect(s.climbing).toBe(0)
    run(s, input({ climb: -1, move: 1 }), 0.3, withWall)
    expect(s.climbing).toBe(1)
    expect(s.y).toBeLessThan(100 - 5)
  })

  test('climbs up and down while pushing in; climbing down is the slide; pushing away lets go', () => {
    const s = clinging()
    const y0 = s.y
    run(s, input({ move: 1, climb: -1 }), 0.5, withWall)
    expect(s.y).toBeCloseTo(y0 - PLAYER.climbUpSpeed * 0.5, 0)
    const ev = run(s, input({ move: 1, climb: 1 }), 0.25, withWall)
    expect(ev.at(-1)!.wallSliding).toBe(1)
    expect(s.y).toBeGreaterThan(y0 - PLAYER.climbUpSpeed * 0.5)
    run(s, input({ move: -1 }), DT, withWall)
    expect(s.climbing).toBe(0)
  })

  test('climbing down to the floor lets go', () => {
    const s = clinging()
    run(s, input({ move: 1, climb: 1 }), 1.5, withWall)
    expect(s.grounded).toBe(true)
    expect(s.climbing).toBe(0)
  })

  test('jumping away from a wall kicks off, and input cannot pull straight back for a moment', () => {
    const s = clinging()
    const ev = stepPlayer(s, input({ move: -1, jump: true }), DT, withWall)
    expect(ev.wallJumped).toBe(1)
    expect(s.vx).toBeLessThan(0)
    expect(s.vy).toBeLessThan(0)
    const x = s.x
    run(s, input({ move: 1, jump: true }), PLAYER.wallJumpLock * 0.8, withWall)
    expect(s.x).toBeLessThan(x)
  })

  test('jumping off a wall with no direction held is a wall jump', () => {
    const s = clinging()
    expect(stepPlayer(s, input({ jump: true }), DT, withWall).wallJumped).toBe(1)
    expect(s.vx).toBeLessThan(0)
  })

  test('a wall jump also works from a cell or two away', () => {
    const s = nextToWall()
    s.x -= 1.5
    run(s, idle, 0.05, withWall)
    expect(stepPlayer(s, input({ jump: true }), DT, withWall).wallJumped).toBe(1)
  })

  test('jumping while pushing into the wall hops straight up it', () => {
    const s = clinging()
    const x = s.x
    const ev = stepPlayer(s, input({ move: 1, jump: true }), DT, withWall)
    expect(ev.climbJumped).toBe(true)
    expect(s.vy).toBeLessThan(-PLAYER.climbJumpSpeed * 0.9)
    expect(s.x).toBeCloseTo(x, 5)
  })

  test('climbing past the top of a wall pops up onto it', () => {
    const ledge = flat((x, y) => x >= 80 && y >= 70)
    const s = createPlayer(80 - PLAYER.size / 2, 90)
    run(s, input({ move: 1 }), 0.2, ledge)
    expect(s.climbing).toBe(1)
    let hopped = false
    for (let t = 0; t < 2 && !hopped; t += DT) hopped = stepPlayer(s, input({ climb: -1, move: 1 }), DT, ledge).ledgeHopped
    expect(hopped).toBe(true)
    run(s, input({ move: 1 }), 1, ledge)
    expect(s.grounded).toBe(true)
    expect(s.y).toBeCloseTo(70, 5)
    expect(s.x).toBeGreaterThan(80)
  })
})
