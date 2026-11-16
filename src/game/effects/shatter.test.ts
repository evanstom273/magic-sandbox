import { expect, test } from 'vitest'
import { Gather, Shatter } from './shatter.ts'

const floor = (_x: number, y: number) => y >= 100

test('a shattered body flies apart, then every piece settles on the floor', () => {
  const s = new Shatter(() => 0.5)
  const cells = new Uint8Array(12 * 12).fill(2)
  s.burst(cells, 12, 12, 44, 88)
  expect(s.shards).toHaveLength(144)
  for (let i = 0; i < 60 * 6; i++) s.update(1 / 60, floor)
  expect(s.shards.every((p) => p.settled)).toBe(true)
  expect(s.shards.every((p) => p.y < 100 && p.y > 98)).toBe(true)
  const xs = s.shards.map((p) => p.x)
  expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(12) // scattered wider than the body was
})

test('gathering cells end exactly where the body is', () => {
  const g = new Gather()
  const cells = new Uint8Array(12 * 12).fill(2)
  g.start(cells, 12, 12, 20, 80)
  expect(g.done).toBe(false)
  for (let i = 0; i < 60; i++) g.update(1 / 60)
  expect(g.done).toBe(true)
  const pos = g.positions()
  expect(pos[0]).toMatchObject({ x: 20, y: 80 })
  expect(pos.at(-1)).toMatchObject({ x: 31, y: 91 })
})
