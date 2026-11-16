import { expect, test } from 'vitest'
import { Squash } from './squash.ts'

test('a jump stretches the body, then it springs back to normal', () => {
  const s = new Squash()
  s.jump()
  expect(s.sx).toBeLessThan(1)
  expect(s.sy).toBeGreaterThan(1)
  expect(s.sx * s.sy).toBeCloseTo(0.95, 1) // roughly the same area
  for (let i = 0; i < 60; i++) s.update(1 / 60)
  expect(s.sx).toBeCloseTo(1, 2)
  expect(s.sy).toBeCloseTo(1, 2)
})

test('a harder landing squashes more', () => {
  const soft = new Squash(), hard = new Squash()
  soft.land(0.2)
  hard.land(1)
  expect(hard.sx).toBeGreaterThan(soft.sx)
  expect(hard.sy).toBeLessThan(soft.sy)
  expect(hard.sx).toBeCloseTo(1.4, 5)
})
