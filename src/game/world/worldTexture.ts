import { CellGrid, Kind, KIND, Material as M, MATERIALS } from './grid.ts'
import { BLUE, GOLD, LIT as FUSE, RICH } from './reactions.ts'

const LIT = [130, 128, 150]
const COLOURS = Object.values(MATERIALS).map((m) => m.colour)
// Solid materials open above get a lighter top edge so ledges read in the dark (pale ones don't need it).
const EDGE = Object.values(MATERIALS).map((m, i) =>
  i === M.STONE ? LIT : i === M.WOOD ? [176, 124, 80] : m.kind === Kind.SOLID && m.colour[0] + m.colour[1] + m.colour[2] < 420 ? m.colour.map((v) => Math.min(255, v * 1.3 + 12)) : null)
const LIQUID = Object.values(MATERIALS).map((m) => m.kind === Kind.LIQUID)

/** Paints the grid into an ImageData, one pixel per cell, with a little per-cell variation. */
export function paintGrid(g: CellGrid, img: ImageData): void {
  const d = img.data, cells = g.cells, seed = g.seed, life = g.life, W = g.width, t = g.step
  for (let p = 0, i = 0; p < cells.length; p++, i += 4) {
    const m = cells[p]
    let c: readonly number[] = COLOURS[m]
    let f = 1 + (seed[p] - 128) / 128 * (m === M.EMPTY ? 0.08 : 0.07)
    d[i + 3] = 255
    if (m === M.FIRE) {
      const l = Math.min(1, (life[p] & 0x3fff) / 70)
      if (life[p] & BLUE) { d[i] = 110 + 90 * l; d[i + 1] = 150 + 80 * l; d[i + 2] = 255 }
      else { d[i] = 255; d[i + 1] = 90 + 140 * l; d[i + 2] = 30 + 60 * l * l }
      continue
    }
    // Hot and magical liquids shimmer.
    if (m === M.LAVA || m === M.MOLTEN || m === M.MANA || m === M.PLASMA || m === M.BURNING_THERMITE) {
      const w = ((seed[p] * 3 + (t >> 2)) & 127) / 127, tri = Math.abs(2 * w - 1)
      if (m === M.LAVA) { d[i] = 255; d[i + 1] = 96 + 90 * tri; d[i + 2] = 24 + 34 * tri }
      else if (m === M.MOLTEN) { const gold = life[p] & GOLD; d[i] = 255; d[i + 1] = (gold ? 196 : 176) + 50 * tri; d[i + 2] = (gold ? 40 : 96) + 60 * tri }
      else if (m === M.MANA) { d[i] = 70 + 70 * tri; d[i + 1] = 180 + 60 * tri; d[i + 2] = 255 }
      else if (m === M.PLASMA) { d[i] = 255; d[i + 1] = 140 + 115 * tri; d[i + 2] = 255 }
      else { d[i] = 255; d[i + 1] = 200 + 55 * tri; d[i + 2] = 120 + 135 * tri }
      continue
    }
    if (m === M.GUNPOWDER && life[p] & FUSE) { d[i] = 255; d[i + 1] = 150 + (seed[p] & 63); d[i + 2] = 40; continue } // a lit fuse
    if (EDGE[m] && p >= W && cells[p - W] === M.EMPTY) { c = EDGE[m]!; f = 1 }
    else if (LIQUID[m]) f = 1 + (seed[p] - 128) / 128 * 0.04
    else if ((m === M.GUNPOWDER || m === M.THERMITE) && seed[p] < 60) f = 0.6 // speckled
    else if (m === M.DIRT && life[p] & RICH) f *= 0.8 // richer soil is darker
    else if (KIND[m] === Kind.GAS) f = 1 + (seed[p] - 128) / 128 * 0.12
    d[i] = Math.min(255, c[0] * f)
    d[i + 1] = Math.min(255, c[1] * f)
    d[i + 2] = Math.min(255, c[2] * f)
  }
}
