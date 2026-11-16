import { describe, expect, test } from 'vitest'
import { BodyCell, CellBody } from './body.ts'
import { fallDamage, Health, HEALTH } from './health.ts'
import { createPlayer, stepPlayer, type PlayerInput, type SolidAt } from './movement.ts'
import { PLAYER } from './tuning.ts'

const S = PLAYER.height
const DT = 1 / 60

describe('fall damage', () => {
  test('safe up to 72 cells, then 1 a cell, capped so one fall cannot kill from full', () => {
    expect(fallDamage(72)).toBe(0)
    expect(fallDamage(84)).toBe(12)
    expect(fallDamage(108)).toBe(36)
    expect(fallDamage(1000)).toBe(HEALTH.fallCap)
    expect(HEALTH.fallCap).toBeLessThan(HEALTH.max)
  })
})

describe('measuring a fall', () => {
  const floor: SolidAt = (_x, y) => y >= 200
  const input = (i: Partial<PlayerInput> = {}): PlayerInput => ({ move: 0, jump: false, ...i })

  test('a jump plus a double jump from the ground is safe', () => {
    const s = createPlayer(50, 200)
    for (let i = 0; i < 6; i++) stepPlayer(s, input(), DT, floor)
    let fell = -1
    for (let t = 0; t < 3 && fell < 0; t += DT) {
      const jump = t < 0.4 || (t > 0.5 && t < 0.8)
      const ev = stepPlayer(s, input({ jump }), DT, floor)
      if (ev.landed >= 0 || (ev.fell > 0 && s.grounded)) fell = ev.fell
    }
    expect(fell).toBeGreaterThan(48)
    expect(fallDamage(fell)).toBe(0)
  })

  test('a double jump just before landing does not save you', () => {
    const s = createPlayer(50, 20) // about 15 body heights up
    let fell = 0, doubled = false
    for (let t = 0; t < 5 && !s.grounded; t += DT) {
      const jump = !doubled && s.y > 200 - S * 1.5
      const ev = stepPlayer(s, input({ jump }), DT, floor)
      if (ev.doubleJumped) doubled = true
      if (s.grounded) fell = ev.fell
    }
    expect(doubled).toBe(true)
    expect(fallDamage(fell)).toBeGreaterThan(0)
  })

  test('catching a wall resets the fall', () => {
    const shaft: SolidAt = (x, y) => y >= 200 || x >= 80
    const s = createPlayer(80 - PLAYER.width / 2, 20)
    let fell = -1
    for (let t = 0; t < 8 && fell < 0; t += DT) {
      const ev = stepPlayer(s, input({ move: t < 0.25 ? 1 : 0 }), DT, shaft) // catch the wall, then let go and slide down
      if (s.grounded) fell = ev.fell
    }
    expect(fell).toBeGreaterThanOrEqual(0)
    expect(fallDamage(fell)).toBe(0)
  })
})

describe('health and marks', () => {
  test('hurting leaves a mark; healing mends it; zero is the end', () => {
    const h = new Health()
    expect(h.hurt(30, 'dent', 0.5)).toBe(false)
    expect(h.value).toBe(70)
    expect(h.marks).toHaveLength(1)
    h.heal(20)
    expect(h.value).toBe(90)
    expect(h.marks[0].amount).toBeCloseTo(10)
    h.heal(50)
    expect(h.value).toBe(100)
    expect(h.marks).toHaveLength(0)
    h.hurt(85, 'dent', 0.5)
    expect(h.hurt(85, 'dent', 0.5)).toBe(true)
    expect(h.value).toBe(0)
  })

  test('a dent bites into the bottom of the body, deeper for more damage, and the outline follows it', () => {
    const square = CellBody.square(12)
    const emptyCells = (b: CellBody) => b.cells.filter((c) => c === BodyCell.EMPTY).length
    const small = square.withMarks([{ kind: 'dent', at: 0.5, amount: 15, seed: 1 }])
    const big = square.withMarks([{ kind: 'dent', at: 0.5, amount: 80, seed: 1 }])
    expect(emptyCells(small)).toBeGreaterThan(0)
    expect(emptyCells(big)).toBeGreaterThan(emptyCells(small))
    expect(big.get(6, 11)).toBe(BodyCell.EMPTY) // bitten out of the bottom
    expect(big.get(6, 0)).toBe(BodyCell.INK) // the top is untouched
    // Every white cell is inside the outline: none of them touches the outside.
    for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) {
      if (big.get(x, y) !== BodyCell.HERO) continue
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy
        expect(nx >= 0 && ny >= 0 && nx < 12 && ny < 12 && big.get(nx, ny) !== BodyCell.EMPTY).toBe(true)
      }
    }
  })
})
