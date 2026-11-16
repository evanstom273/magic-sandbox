import { CellGrid, Material } from './grid.ts'

// A test room in Fine cells: a bumpy floor, two ledges, a wall, a low step, a high ledge to fall
// from, and things for magic to play with: a pool, a heap of sand, a wooden platform, grass. Some
// of the rock holds other things to find (soil under the grass, a coal seam, gold, a metal vein,
// crystals in the ceiling); they're all in what was stone, so the room's shape is unchanged.
export const ROOM_W = 320
export const ROOM_H = 180
export const SPAWN = { x: 30, y: 150 }
// A stand-in rest spot on the floor that heals while you stand on it (not a design for resting).
export const REST_SPOT = { x0: 128, x1: 146 }
export const POOL = { x0: 160, x1: 230, floor: 174, surface: 164 }

export function buildTestRoom(): CellGrid {
  const g = new CellGrid(ROOM_W, ROOM_H)
  for (let y = 0; y < ROOM_H; y++) {
    for (let x = 0; x < ROOM_W; x++) {
      let floor = 160 + Math.round(1.5 * Math.sin(x / 11) + Math.sin(x / 4.3))
      const inPool = x >= POOL.x0 && x < POOL.x1
      if (inPool) floor = POOL.floor
      const ceiling = 6 + Math.round(3 * Math.sin(x / 17) + 2 * Math.sin(x / 7))
      const stone =
        x < 4 || x >= ROOM_W - 4 || y >= floor || y < ceiling ||
        (x >= 60 && x < 120 && y >= 122 && y < 128) || // low ledge
        (x >= 150 && x < 205 && y >= 92 && y < 98) || // high ledge
        (x >= 238 && x < 250 && y >= 104) || // wall
        (x >= 275 && x < 300 && y >= 156) || // low step
        (x >= 250 && x < 290 && y >= 34 && y < 38) // the highest ledge: scale the right-hand wall, then kick off onto it
      if (stone) { g.set(x, y, rock(x, y, floor, ceiling)); continue }
      if (inPool && y >= POOL.surface) { g.set(x, y, Material.WATER); continue }
      // A heap of sand on the low ledge.
      if (x >= 66 && x < 114 && y < 122 && y >= 122 - Math.round(9 - Math.abs(x - 90) * 0.37)) { g.set(x, y, Material.SAND); continue }
      // A wooden platform over the right end of the pool, on two posts.
      if ((x >= 204 && x < 237 && y >= 134 && y < 137) || ((x >= 206 && x < 209) || (x >= 232 && x < 235)) && y >= 137) { g.set(x, y, Material.WOOD); continue }
    }
  }
  // Grass along the floor by the start.
  for (let x = 6; x < 56; x++) {
    for (let yy = ROOM_H - 1; yy > 0; yy--) {
      if (g.get(x, yy) === Material.EMPTY && g.isSolid(x, yy + 1)) {
        g.set(x, yy, Material.PLANT)
        if ((x * 7) % 3 === 0) g.set(x, yy - 1, Material.PLANT)
        break
      }
    }
  }
  return g
}

/** A steady 0–1 noise per cell, so ore looks scattered rather than patterned. */
function hash(x: number, y: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** What the rock is made of at (x, y): mostly stone. */
function rock(x: number, y: number, floor: number, ceiling: number): Material {
  const depth = y - floor // how far into the floor
  const n = hash(x, y)
  if (y >= floor && x >= 6 && x < 56 && depth < 3) return Material.DIRT // soil under the grass
  if (y >= floor && x >= 14 && x < 46 && depth >= 7 && depth < 9 + Math.round(Math.sin(x / 5) + n * 0.8)) return Material.COAL
  if (y >= floor && x >= 128 && x < 146 && depth >= 3 && depth < 8 && n < 0.07) return Material.GOLD // nuggets
  if (((x - 243) / 5) ** 2 + ((y - 131) / 3) ** 2 < 0.55 + 0.6 * n) return Material.METAL // an ore vein in the wall
  if (y < ceiling && y >= ceiling - 4 && x >= 96 && x < 108 && n < 0.75 - Math.abs(x - 102) * 0.1) return Material.CRYSTAL
  return Material.STONE
}
