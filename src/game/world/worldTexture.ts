import { CellGrid, Material as M, MATERIALS } from './grid.ts'

const LIT = [130, 128, 150]
const COLOURS = Object.values(MATERIALS).map((m) => m.colour)

/** Paints the grid into an ImageData, one pixel per cell, with a little per-cell variation. */
export function paintGrid(g: CellGrid, img: ImageData): void {
  const d = img.data, cells = g.cells, seed = g.seed, life = g.life, W = g.width
  for (let p = 0, i = 0; p < cells.length; p++, i += 4) {
    const m = cells[p]
    let c: readonly number[] = COLOURS[m]
    let f = 1 + (seed[p] - 128) / 128 * (m === M.EMPTY ? 0.08 : 0.07)
    if (m === M.FIRE) {
      const l = Math.min(1, (life[p] & 0x7fff) / 70)
      d[i] = 255; d[i + 1] = 90 + 140 * l; d[i + 2] = 30 + 60 * l * l; d[i + 3] = 255
      continue
    }
    // A lighter top edge on stone and wood that's open above, so ledges read in the dark.
    if ((m === M.STONE || m === M.WOOD) && p >= W && cells[p - W] === M.EMPTY) { c = m === M.STONE ? LIT : [176, 124, 80]; f = 1 }
    if (m === M.WATER) f = 1 + (seed[p] - 128) / 128 * 0.04
    d[i] = Math.min(255, c[0] * f)
    d[i + 1] = Math.min(255, c[1] * f)
    d[i + 2] = Math.min(255, c[2] * f)
    d[i + 3] = 255
  }
}
