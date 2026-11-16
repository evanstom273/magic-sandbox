import { CellGrid, Material } from './grid.ts'

// Placeholder colours from the reference sheets until the game has a world palette.
const BACKDROP: [number, number, number] = [20, 20, 28]
const ROCK: [number, number, number] = [74, 72, 88]
const LIT_EDGE: [number, number, number] = [112, 112, 140]

/** Paints the grid into an ImageData, one pixel per cell, with a little per-cell variation. */
export function paintGrid(grid: CellGrid, img: ImageData, seed = 1): void {
  let s = seed >>> 0
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
  const d = img.data
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const m = grid.get(x, y)
      const litEdge = m === Material.ROCK && grid.get(x, y - 1) === Material.EMPTY && y > 0
      const base = m === Material.EMPTY ? BACKDROP : litEdge ? LIT_EDGE : ROCK
      const f = 1 + (rand() - 0.5) * (m === Material.EMPTY ? 0.16 : 0.12)
      const i = (y * grid.width + x) * 4
      d[i] = Math.min(255, base[0] * f)
      d[i + 1] = Math.min(255, base[1] * f)
      d[i + 2] = Math.min(255, base[2] * f)
      d[i + 3] = 255
    }
  }
}
