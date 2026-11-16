import { expect, test } from 'vitest'
import { Gather, Shatter } from './shatter.ts'

const floor = (_x: number, y: number) => y >= 100

test('a shattered body flies apart, then every piece settles on the floor', () => {
  const s = new Shatter(() => 0.5)
  const pts = Array.from({ length: 144 }, (_, i) => ({ x: 44 + (i % 12), y: 88 + Math.floor(i / 12), cell: 2 }))
  s.burst(pts, 50, 94)
  expect(s.shards).toHaveLength(144)
  for (let i = 0; i < 60 * 6; i++) s.update(1 / 60, floor)
  expect(s.shards.every((p) => p.settled)).toBe(true)
  expect(s.shards.every((p) => p.y < 100 && p.y > 98)).toBe(true)
  const xs = s.shards.map((p) => p.x)
  expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(12) // scattered wider than the body was
})

test('gathering cells end exactly where the body is', () => {
  const g = new Gather()
  const pts = Array.from({ length: 144 }, (_, i) => ({ x: 20 + (i % 12), y: 80 + Math.floor(i / 12), cell: 2 }))
  g.start(pts)
  expect(g.done).toBe(false)
  for (let i = 0; i < 60; i++) g.update(1 / 60)
  expect(g.done).toBe(true)
  const pos = g.positions()
  expect(pos[0]).toMatchObject({ x: 20, y: 80 })
  expect(pos.at(-1)).toMatchObject({ x: 31, y: 91 })
})
