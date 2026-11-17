import { CellGrid, Kind, KIND, Material as M, MATERIALS } from './grid.ts'
import type { LightMap } from './light.ts'
import { BLUE, GOLD, LIT as FUSE, RICH } from './reactions.ts'

const LIT = [130, 128, 150]
const COLOURS = Object.values(MATERIALS).map((m) => m.colour)
// Solid materials open above get a lighter top edge so ledges read in the dark (pale ones don't need it).
const EDGE = Object.values(MATERIALS).map((m, i) =>
  i === M.STONE ? LIT : i === M.WOOD ? [176, 124, 80] : m.kind === Kind.SOLID && m.colour[0] + m.colour[1] + m.colour[2] < 420 ? m.colour.map((v) => Math.min(255, v * 1.3 + 12)) : null)
const LIQUID = Object.values(MATERIALS).map((m) => m.kind === Kind.LIQUID)

/**
 * Paints the grid into an ImageData, one pixel per cell, with a little per-cell variation, lit by
 * the light map if there is one (the world is dark; light is precious).
 */
export function paintGrid(g: CellGrid, img: ImageData, light?: LightMap): void {
  const d = img.data, cells = g.cells, seed = g.seed, life = g.life, W = g.width, t = g.step
  const LR = light?.r, LG = light?.g, LB = light?.b
  for (let p = 0, i = 0; p < cells.length; p++, i += 4) {
    const m = cells[p]
    let r: number, gr: number, b: number
    if (m === M.FIRE) {
      const l = Math.min(1, (life[p] & 0x3fff) / 70)
      if (life[p] & BLUE) { r = 110 + 90 * l; gr = 150 + 80 * l; b = 255 }
      else { r = 255; gr = 90 + 140 * l; b = 30 + 60 * l * l }
    } else if (m === M.LAVA || m === M.MOLTEN || m === M.MANA || m === M.PLASMA || m === M.BURNING_THERMITE) {
      // Hot and magical liquids shimmer.
      const w = ((seed[p] * 3 + (t >> 2)) & 127) / 127, tri = Math.abs(2 * w - 1)
      if (m === M.LAVA) { r = 255; gr = 96 + 90 * tri; b = 24 + 34 * tri }
      else if (m === M.MOLTEN) { const gold = life[p] & GOLD; r = 255; gr = (gold ? 196 : 176) + 50 * tri; b = (gold ? 40 : 96) + 60 * tri }
      else if (m === M.MANA) { r = 70 + 70 * tri; gr = 180 + 60 * tri; b = 255 }
      else if (m === M.PLASMA) { r = 255; gr = 140 + 115 * tri; b = 255 }
      else { r = 255; gr = 200 + 55 * tri; b = 120 + 135 * tri }
    } else if (m === M.GUNPOWDER && life[p] & FUSE) {
      r = 255; gr = 150 + (seed[p] & 63); b = 40 // a lit fuse
    } else {
      let c: readonly number[] = COLOURS[m]
      let f = 1 + (seed[p] - 128) / 128 * (m === M.EMPTY ? 0.08 : 0.07)
      if (EDGE[m] && p >= W && cells[p - W] === M.EMPTY) { c = EDGE[m]!; f = 1 }
      else if (LIQUID[m]) f = 1 + (seed[p] - 128) / 128 * 0.04
      else if ((m === M.GUNPOWDER || m === M.THERMITE) && seed[p] < 60) f = 0.6 // speckled
      else if (m === M.DIRT && life[p] & RICH) f *= 0.8 // richer soil is darker
      else if (KIND[m] === Kind.GAS) f = 1 + (seed[p] - 128) / 128 * 0.12
      r = c[0] * f; gr = c[1] * f; b = c[2] * f
    }
    if (LR) { r *= Math.min(1.15, LR[p]); gr *= Math.min(1.15, LG![p]); b *= Math.min(1.15, LB![p]) }
    d[i] = Math.min(255, r)
    d[i + 1] = Math.min(255, gr)
    d[i + 2] = Math.min(255, b)
    d[i + 3] = 255
  }
}
