import { expect, test } from 'vitest'
import { BodyCell } from './body.ts'
import { FIG, figureBody } from './figure.ts'
import { PLAYER } from './tuning.ts'

test('the figure fills the hitbox: head and body, a gap, then the feet', () => {
  expect(FIG.bodyH + FIG.feetGap + FIG.footH).toBe(PLAYER.height)
  expect(FIG.bodyW).toBe(PLAYER.width)
})

test('the face: two eyes with highlights and a mouth, each clear of the outline', () => {
  const b = figureBody('open')
  for (const ex of [2, 6]) {
    expect(b.get(ex, 2)).toBe(BodyCell.INK) // eye
    expect(b.get(ex + 1, 1)).toBe(BodyCell.HERO) // highlight
    expect(b.get(ex - 1, 2)).toBe(BodyCell.HERO) // a white cell between the eye and whatever's beside it
  }
  expect(b.get(4, 5)).toBe(BodyCell.INK) // mouth
  expect(b.get(5, 5)).toBe(BodyCell.INK)
  const shut = figureBody('blink')
  expect(shut.get(2, 1)).toBe(BodyCell.HERO)
  expect(shut.get(2, 2)).toBe(BodyCell.INK)
})

test('a seam of ink runs between the head and the body', () => {
  const b = figureBody('open')
  for (let x = 2; x <= 7; x++) expect(b.get(x, 7)).toBe(BodyCell.INK)
  expect(b.get(4, 9)).toBe(BodyCell.HERO)
})
