import { CellGrid, Kind, KIND, Material as M, MATERIALS } from './grid.ts'

// What happens when heat, cold and blasts meet each material (Element Codex, "When materials
// meet"). Shared by the simulation (hot cells touching their neighbours) and by magic (Heat, Cold).

export const STEPS_PER_SECOND = 120
export const rnd = Math.random
/** A per-second chance as a per-step chance. */
export const perSec = (n: number) => n / STEPS_PER_SECOND
export const lifeSteps = (seconds: number) => Math.max(1, Math.round(seconds * STEPS_PER_SECOND))

// Marks kept in a cell's life alongside its timer.
/** Fire: burning fuel (wood, oil, coal...), which stays put for its whole life. Loose flames rise. */
export const FUEL = 0x8000
/** Fire: the pale blue flame of burning spirits. */
export const BLUE = 0x4000
/** Molten metal: it's molten gold, and sets back into gold. */
export const GOLD = 0x4000
/** Gunpowder: lit by a blast, it fizzes for a moment, then goes off. */
export const LIT = 0x8000
/** Dirt: richer soil, with ash or blood worked into it. Plants grow faster on it. */
export const RICH = 1
/** The timer part of a cell's life. */
export const LIFE = 0x3fff

/** A fresh timer for a material that lasts a while (gases, flames, molten metal, rot); 0 for the rest. */
export function lifeFor(m: number): number {
  const l = MATERIALS[m as M].life
  return l ? lifeSteps(l[0] + rnd() * (l[1] - l[0])) : 0
}

interface Burn {
  rate: number // how readily it catches beside a flame, a second
  seconds: [number, number] // how long it burns
  loose?: boolean // burns off as a loose flame (gases) rather than burning in place
  blue?: boolean
}
/** Things that burn. */
export const BURNS: Partial<Record<number, Burn>> = {
  [M.WOOD]: { rate: 9, seconds: [0.9, 2.1] },
  [M.PLANT]: { rate: 12, seconds: [0.4, 0.8] },
  [M.OIL]: { rate: 8, seconds: [1.5, 3] }, // burns long, spreading across a pool
  [M.COAL]: { rate: 1.5, seconds: [4, 7] }, // slow to catch, the longest burn
  [M.TAR]: { rate: 2, seconds: [3, 5] },
  [M.SPIRITS]: { rate: 30, seconds: [0.2, 0.45], blue: true }, // fast, pale blue, quickly out
  [M.HONEY]: { rate: 1, seconds: [1, 2] }, // half of it hardens instead (see ignite)
  [M.FUNGUS]: { rate: 10, seconds: [0.4, 0.8] },
  [M.SEEDS]: { rate: 12, seconds: [0.2, 0.4] },
  [M.ROT]: { rate: 6, seconds: [0.5, 1] },
  [M.SPORES]: { rate: 30, seconds: [0.1, 0.2], loose: true },
  [M.MIASMA]: { rate: 30, seconds: [0.1, 0.2], loose: true }, // burns off
}

interface Melt {
  into: number
  level: number // the heat it takes: 1 a flame, 1.5 a cast of Heat, 2 lava, 3 sustained Heat, plasma or thermite
  rate: number // a second, beside something hot enough
  cast: number // the chance a cast of Heat changes it, each time it's applied
}
/** What heat turns things into. */
export const MELTS: Partial<Record<number, Melt>> = {
  [M.ICE]: { into: M.WATER, level: 1, rate: 3, cast: 1 },
  [M.SNOW]: { into: M.WATER, level: 1, rate: 6, cast: 1 },
  [M.SLIME]: { into: M.STEAM, level: 1, rate: 1, cast: 0.6 }, // dries out
  [M.MUD]: { into: M.DIRT, level: 1, rate: 0.5, cast: 0.5 },
  [M.CLAY]: { into: M.BRICK, level: 1, rate: 0.3, cast: 0.3 },
  [M.AMBER]: { into: M.HONEY, level: 1, rate: 1, cast: 0.6 },
  [M.HARD_TAR]: { into: M.TAR, level: 1, rate: 1, cast: 0.8 },
  [M.FROZEN_QUICKSAND]: { into: M.QUICKSAND, level: 1, rate: 2, cast: 0.8 },
  [M.GOLD]: { into: M.MOLTEN, level: 1.5, rate: 1.5, cast: 0.5 }, // melts easily
  [M.BONE]: { into: M.ASH, level: 2, rate: 0.5, cast: 0.05 },
  [M.SAND]: { into: M.GLASS, level: 2, rate: 0.6, cast: 0.04 },
  [M.METAL]: { into: M.MOLTEN, level: 2, rate: 0.3, cast: 0.03 },
  [M.STONE]: { into: M.LAVA, level: 3, rate: 0.8, cast: 0.015 },
  [M.RUBBLE]: { into: M.LAVA, level: 3, rate: 0.8, cast: 0.015 },
  [M.BRICK]: { into: M.LAVA, level: 3, rate: 0.4, cast: 0.01 },
}

/** What cold turns things into (molten metal sets into whichever metal it was). */
export const FREEZES: Partial<Record<number, number>> = {
  [M.WATER]: M.ICE,
  [M.STEAM]: M.WATER,
  [M.FIRE]: M.EMPTY,
  [M.PLASMA]: M.EMPTY,
  [M.LAVA]: M.OBSIDIAN,
  [M.MIST]: M.SNOW,
  [M.TAR]: M.HARD_TAR,
  [M.QUICKSAND]: M.FROZEN_QUICKSAND,
}

/** Things that explode with any flame or spark: how readily beside one (a second) and how big. */
export const EXPLODES: Partial<Record<number, { rate: number; r: number }>> = {
  [M.GUNPOWDER]: { rate: 60, r: 3.5 },
  [M.SWAMP_GAS]: { rate: 40, r: 2.5 },
}

/** What a blast or a strong push breaks things into. Metal, gold and obsidian don't break. */
export const SHATTERS: Partial<Record<number, number>> = {
  [M.STONE]: M.RUBBLE,
  [M.GLASS]: M.SAND,
  [M.ICE]: M.SNOW,
  [M.CRYSTAL]: M.EMPTY,
  [M.CLAY]: M.DIRT,
  [M.AMBER]: M.EMPTY,
  [M.HARD_TAR]: M.EMPTY,
  [M.FROZEN_QUICKSAND]: M.QUICKSAND,
  [M.BONE]: M.EMPTY,
  [M.BRICK]: M.RUBBLE, // only near the middle of a blast
}

/** Open to the air: something empty, gassy or already burning beside it. Nothing burns without air (wood chars to coal instead). */
export function airy(g: CellGrid, x: number, y: number): boolean {
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const n = g.get(x + dx, y + dy)
    if (n === M.EMPTY || KIND[n] === Kind.GAS || KIND[n] === Kind.FIRE) return true
  }
  return false
}

/** Sets a cell alight (if it burns). */
export function ignite(g: CellGrid, x: number, y: number, m: number = g.get(x, y)): void {
  const b = BURNS[m]
  if (!b) return
  // Nothing burns without air; buried wood smoulders to coal instead.
  if (!b.loose && !airy(g, x, y)) { if (m === M.WOOD && rnd() < 0.02) g.set(x, y, M.COAL); return }
  if (m === M.HONEY && rnd() < 0.5) { g.set(x, y, M.AMBER); return } // burns, then hardens
  const life = lifeSteps(b.seconds[0] + rnd() * (b.seconds[1] - b.seconds[0])) | (b.loose ? 0 : FUEL) | (b.blue ? BLUE : 0)
  g.set(x, y, M.FIRE, life)
}

export function melt(g: CellGrid, x: number, y: number, from: number, into: number): void {
  g.set(x, y, into, lifeFor(into) | (from === M.GOLD ? GOLD : 0))
}

export function lightThermite(g: CellGrid, x: number, y: number): void {
  g.set(x, y, M.BURNING_THERMITE, lifeFor(M.BURNING_THERMITE))
}

/**
 * Something hot (heat `level`) touching the cell at (x, y): flammables catch, explosives go off,
 * thermite lights if it's hot enough, and things melt. `scale` speeds it all up (thermite).
 */
export function heatTouch(g: CellGrid, x: number, y: number, level: number, scale = 1): void {
  if (!g.inside(x, y)) return
  const m = g.cells[y * g.width + x]
  if (m === M.EMPTY) return
  const ex = EXPLODES[m]
  if (ex) { if (rnd() < perSec(ex.rate)) explode(g, x, y, ex.r); return }
  if (m === M.THERMITE) { if (level >= 2 && rnd() < perSec(20)) lightThermite(g, x, y); return }
  const b = BURNS[m]
  if (b) { if (rnd() < perSec(b.rate * scale * level)) ignite(g, x, y, m); return }
  const mt = MELTS[m]
  if (mt && level >= mt.level && rnd() < perSec(mt.rate * scale * (1 + level - mt.level))) melt(g, x, y, m, mt.into)
}

const LOOSE = (m: number) => KIND[m] === Kind.POWDER

/**
 * An explosion at (cx, cy): the middle is blown open, stone breaks to rubble, glass and ice shatter,
 * flammables catch, other explosives in it go off in turn. Metal, gold and obsidian hold.
 * Recorded in `g.blasts` so the scene can hurt and shove whatever's near.
 */
export function explode(g: CellGrid, cx: number, cy: number, r: number): void {
  g.blasts.push({ x: cx + 0.5, y: cy + 0.5, r })
  g.set(cx, cy, M.FIRE, lifeSteps(0.15 + rnd() * 0.15))
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const d2 = (x - cx) ** 2 + (y - cy) ** 2
      if (d2 > r * r || !g.inside(x, y) || (x === cx && y === cy)) continue
      const d = Math.sqrt(d2) / r
      const m = g.get(x, y)
      // Other explosives catch and go off a moment later, so a trail burns along like a fuse.
      if (m === M.GUNPOWDER) { if (!(g.life[y * g.width + x] & LIT)) g.set(x, y, M.GUNPOWDER, LIT | lifeSteps(0.01 + d * 0.05 + rnd() * 0.03)); continue }
      if (EXPLODES[m]) { g.set(x, y, M.FIRE, lifeSteps(0.05 + rnd() * 0.1)); continue }
      if (m === M.THERMITE) { lightThermite(g, x, y); continue }
      if (m === M.EMPTY || KIND[m] === Kind.GAS) {
        if (rnd() < (1 - d) * 0.7) g.set(x, y, M.FIRE, lifeSteps(0.08 + rnd() * 0.2))
        else if (rnd() < 0.3) g.set(x, y, M.SMOKE, lifeFor(M.SMOKE))
        continue
      }
      if (BURNS[m]) { if (rnd() < 0.6) ignite(g, x, y, m); continue }
      if (rnd() > 1 - d * 0.5) continue // the edge of a blast does less
      const into = SHATTERS[m]
      if (into !== undefined) { if (m !== M.BRICK || d < 0.5) g.set(x, y, into); continue }
      if (LOOSE(m) && d < 0.6 && rnd() < 0.7) g.set(x, y, M.EMPTY) // loose stuff in the middle is blown away
    }
  }
}
