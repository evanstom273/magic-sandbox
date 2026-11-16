import { expect, test } from 'vitest'
import { Dust } from './dust.ts'

test('dust puffs drift up and fade away', () => {
  const d = new Dust(() => 0.5)
  d.puff(10, 20, 6, 30)
  expect(d.motes).toHaveLength(6)
  d.update(0.1)
  expect(d.motes.every((m) => m.y < 20)).toBe(true)
  for (let i = 0; i < 60; i++) d.update(1 / 60)
  expect(d.motes).toHaveLength(0)
})
