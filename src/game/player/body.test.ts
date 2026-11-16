import { expect, test } from 'vitest'
import { BodyCell, CellBody } from './body.ts'

test('the square has a one-cell ink outline around a white body', () => {
  const b = CellBody.square(12)
  expect(b.get(0, 0)).toBe(BodyCell.INK)
  expect(b.get(11, 5)).toBe(BodyCell.INK)
  expect(b.get(5, 5)).toBe(BodyCell.HERO)
})

test('squashed or stretched, the outline stays on all four sides', () => {
  const b = CellBody.square(12)
  for (const [w, h] of [[9, 16], [17, 7], [12, 12], [5, 5]]) {
    const out = b.resample(w, h)
    for (let x = 0; x < w; x++) {
      expect(out[x]).toBe(BodyCell.INK)
      expect(out[(h - 1) * w + x]).toBe(BodyCell.INK)
    }
    for (let y = 0; y < h; y++) {
      expect(out[y * w]).toBe(BodyCell.INK)
      expect(out[y * w + w - 1]).toBe(BodyCell.INK)
    }
  }
})
