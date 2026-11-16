import { CellGrid, Material } from './grid.ts'

// A test room in Fine cells: a bumpy floor, two ledges, a wall and a low step.
export const ROOM_W = 320
export const ROOM_H = 180
export const SPAWN = { x: 30, y: 150 }

export function buildTestRoom(): CellGrid {
  const g = new CellGrid(ROOM_W, ROOM_H)
  for (let y = 0; y < ROOM_H; y++) {
    for (let x = 0; x < ROOM_W; x++) {
      const floor = 160 + Math.round(1.5 * Math.sin(x / 11) + Math.sin(x / 4.3))
      const ceiling = 6 + Math.round(3 * Math.sin(x / 17) + 2 * Math.sin(x / 7))
      const solid =
        x < 4 || x >= ROOM_W - 4 || y >= floor || y < ceiling ||
        (x >= 60 && x < 120 && y >= 122 && y < 128) || // low ledge
        (x >= 150 && x < 205 && y >= 92 && y < 98) || // high ledge
        (x >= 238 && x < 250 && y >= 104) || // wall
        (x >= 275 && x < 300 && y >= 156) // low step
      if (solid) g.set(x, y, Material.ROCK)
    }
  }
  return g
}
