import { CellGrid, DENSITY, HEAT, Kind, KIND, Material as M, MATERIALS } from './grid.ts'
import { airy, BLUE, EXPLODES, explode, FUEL, GOLD, heatTouch, LIFE, lifeFor, lifeSteps, LIT, perSec, RICH, rnd, salted, STEPS_PER_SECOND } from './reactions.ts'
import type { Field } from './grid.ts'

export { FUEL, lifeFor, lifeSteps, STEPS_PER_SECOND } from './reactions.ts'

// The falling-sand rules. One step moves powders down, liquids down and sideways, gases up (or
// low), and runs the reactions that happen on contact (Element Codex, "When materials meet").

const INFO = Object.values(MATERIALS)
const FLOW = INFO.map((m) => m.flow ?? 1)
const SPREAD = INFO.map((m) => m.spread ?? 2)
const SLOPE = INFO.map((m) => m.slope ?? 1)
const LIFT = INFO.map((m) => m.lift ?? 1)
const STICKY = INFO.map((m) => !!m.sticky)

/** Materials that do something besides moving: react with what they touch, grow, age. */
const ACTIVE = new Uint8Array(INFO.length)
for (const m of [
  M.WATER, M.SALT_WATER, M.ACID, M.LAVA, M.MOLTEN, M.PLASMA, M.BURNING_THERMITE, M.ROT, M.PLANT, M.FUNGUS,
  M.SPORES, M.SEEDS, M.SALT, M.MUD, M.SPIRITS, M.MIST, M.STEAM, M.ASH, M.BLOOD, M.GUNPOWDER,
]) ACTIVE[m] = 1

/** What acid eats, and how fast (a second, touching). Obsidian, glass and gold hold it. */
const EATS: Partial<Record<number, number>> = {
  [M.STONE]: 1.5, [M.RUBBLE]: 2, [M.SAND]: 2, [M.METAL]: 0.4, [M.WOOD]: 2, [M.PLANT]: 4, [M.DIRT]: 2,
  [M.CLAY]: 1.5, [M.BRICK]: 0.3, [M.BONE]: 2, [M.COAL]: 1.5, [M.CRYSTAL]: 0.3, [M.SALT]: 3, [M.SNOW]: 4,
  [M.ICE]: 2, [M.FUNGUS]: 4, [M.SEEDS]: 4, [M.ROT]: 4, [M.AMBER]: 1, [M.HARD_TAR]: 1, [M.QUICKSAND]: 2,
  [M.FROZEN_QUICKSAND]: 2, [M.ASH]: 3, [M.GUNPOWDER]: 2, [M.THERMITE]: 1,
}

const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const
/** A per-second chance for something touching one particular neighbour, when a cell checks one neighbour a step. */
const touch = (n: number) => perSec(n * 4)

export function step(g: CellGrid): void {
  g.step++
  const W = g.width, H = g.height, c = g.cells, stamp = g.stamp, now = g.step
  for (let y = H - 1; y >= 0; y--) {
    const dir = ((y + now) & 1) ? 1 : -1
    for (let i = 0; i < W; i++) {
      const x = dir > 0 ? i : W - 1 - i
      const p = y * W + x
      if (c[p] === M.EMPTY || stamp[p] === now) continue
      cell(g, x, y, p, dir)
    }
  }
  // Sped-up time: the cells in a fast bubble get extra turns, and age.
  for (let f = 0; f < g.fields.length; f++) if (g.fields[f].kind === 'fast') fastPasses(g, f)
}

/** One cell's turn. */
function cell(g: CellGrid, x: number, y: number, p: number, dir: number): void {
  const m = g.cells[p]
  const fi = g.field[p]
  if (fi) {
    const f = g.fields[fi - 1]
    if (f.kind === 'slow') { if (rnd() > 0.1) return } // slowed time: a turn now and then
    else if (f.kind === 'pull') { if (pulled(g, x, y, p, m, f)) return }
    else if (f.kind === 'magnet' && m === M.METAL) { pulled(g, x, y, p, m, f); return }
  }
  const k = KIND[m]
  if (k === Kind.FIRE) { fire(g, x, y, p); return }
  if (ACTIVE[m] && react(g, x, y, p, m)) return
  if (k === Kind.GAS) gas(g, x, y, p, m, dir)
  else if (k === Kind.POWDER) powder(g, x, y, p, m, dir)
  else if (k === Kind.LIQUID) liquid(g, x, y, p, m, dir)
}

/**
 * A cell in a gravity well (or metal in a magnet's) moves towards the middle and is held there
 * instead of falling: water gathers into a floating ball, sand into a heap. Packed tight near the
 * middle, enough sand turns to stone, and snow to ice. Returns false for cells it doesn't move.
 */
function pulled(g: CellGrid, x: number, y: number, p: number, m: number, f: Field): boolean {
  const k = KIND[m]
  if (m !== M.METAL && !(k === Kind.POWDER || k === Kind.LIQUID || k === Kind.GAS)) return false
  const ox = f.x - (x + 0.5), oy = f.y - (y + 0.5), d = Math.hypot(ox, oy)
  if (d > 1.2 && rnd() < 0.6) {
    const sx = Math.abs(ox) > 0.5 ? Math.sign(ox) : 0, sy = Math.abs(oy) > 0.5 ? Math.sign(oy) : 0
    // Mostly along the way to the middle, so what gathers there is round rather than square.
    const alongX = rnd() < Math.abs(ox) / (Math.abs(ox) + Math.abs(oy))
    for (const [ax, ay] of alongX ? [[sx, 0], [sx, sy], [0, sy]] : [[0, sy], [sx, sy], [sx, 0]]) {
      if (ax === 0 && ay === 0) continue
      const nx = x + ax, ny = y + ay
      if (!g.inside(nx, ny)) continue
      const q = ny * g.width + nx, mq = g.cells[q]
      if (mq === M.EMPTY || (KIND[mq] === Kind.GAS && k !== Kind.GAS)) { swap(g, p, q); return true }
    }
  }
  if ((m === M.SAND || m === M.SNOW) && d < f.r * 0.5 && rnd() < perSec(0.6) && packed(g, x, y)) g.set(x, y, m === M.SAND ? M.STONE : M.ICE)
  return true
}

/** Surrounded: at least seven of its eight neighbours are something (not empty, not gas). */
function packed(g: CellGrid, x: number, y: number): boolean {
  let n = 0
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (dx === 0 && dy === 0) continue
    const m = g.get(x + dx, y + dy)
    if (m !== M.EMPTY && KIND[m] !== Kind.GAS) n++
  }
  return n >= 7
}

const FAST_PASSES = 2
/** What sped-up time does besides hurrying everything along: the codex's ageing (a second, in the bubble). */
const AGES: Partial<Record<number, [number, number]>> = {
  [M.WATER]: [M.EMPTY, 0.2], // evaporates
  [M.SALT_WATER]: [M.SALT, 0.2],
  [M.LAVA]: [M.STONE, 0.3], // cools
  [M.STONE]: [M.SAND, 0.05], // weathers, where it's open to the air
  [M.METAL]: [M.RUBBLE, 0.05], // corrodes, where it's open to the air
  [M.WOOD]: [M.ROT, 0.05], // ages
  [M.PLANT]: [M.ROT, 0.03], // grows (faster, by its own rules), blooms and rots
  [M.ICE]: [M.WATER, 0.5],
  [M.SNOW]: [M.WATER, 0.5],
  [M.STEAM]: [M.WATER, 1], // condenses
  [M.HONEY]: [M.AMBER, 0.3],
  [M.MUD]: [M.DIRT, 0.3], // dries
}

/** Extra turns for the cells in a sped-up bubble, and their ageing. */
function fastPasses(g: CellGrid, fi: number): void {
  const f = g.fields[fi], W = g.width
  const x0 = Math.max(0, Math.floor(f.x - f.r)), x1 = Math.min(W - 1, Math.ceil(f.x + f.r))
  const y0 = Math.max(0, Math.floor(f.y - f.r)), y1 = Math.min(g.height - 1, Math.ceil(f.y + f.r))
  for (let pass = 0; pass < FAST_PASSES; pass++) {
    g.step++
    const now = g.step
    for (let y = y1; y >= y0; y--) {
      const dir = ((y + now) & 1) ? 1 : -1
      for (let i = x0; i <= x1; i++) {
        const x = dir > 0 ? i : x1 - (i - x0)
        const p = y * W + x
        const m = g.cells[p]
        if (g.field[p] !== fi + 1 || m === M.EMPTY || g.stamp[p] === now) continue
        if (age(g, x, y, m)) continue
        cell(g, x, y, p, dir)
      }
    }
  }
}

function age(g: CellGrid, x: number, y: number, m: number): boolean {
  if (m === M.CRYSTAL) {
    // Crystal grows, slowly, into open space beside it.
    if (rnd() < 0.05 / (STEPS_PER_SECOND * FAST_PASSES)) {
      const [nx, ny, n] = neighbour(g, x, y)
      if (n === M.EMPTY) g.set(nx, ny, M.CRYSTAL)
    }
    return false
  }
  const a = AGES[m]
  if (!a || rnd() > a[1] / (STEPS_PER_SECOND * FAST_PASSES)) return false
  if ((m === M.STONE || m === M.METAL) && !airy(g, x, y)) return false
  g.set(x, y, a[0], lifeFor(a[0]))
  return true
}

/** What a gas leaves when its time runs out: steam partly rains back; the rest just thin away. */
const gasEnd = (m: number) => (m === M.STEAM && rnd() < 0.3 ? M.WATER : M.EMPTY)

/** Swaps the cell at p (the one moving) with q. */
function swap(g: CellGrid, p: number, q: number): void {
  const c = g.cells, l = g.life
  const m = c[p], lf = l[p]
  c[p] = c[q]; l[p] = l[q]
  c[q] = m; l[q] = lf
  g.stamp[p] = g.stamp[q] = g.step
  // A gas shoved aside by a falling or flowing cell misses its own turn this step, so it ages here;
  // otherwise steam caught in water's surface could be shoved about for ever and never fade.
  const kp = KIND[c[p]]
  if (kp === Kind.GAS || kp === Kind.FIRE) {
    if ((l[p] & LIFE) > 1) l[p]--
    else { c[p] = kp === Kind.GAS ? gasEnd(c[p]) : M.EMPTY; l[p] = 0 } // its time ran out while being shoved
  }
}

/** Can material m move into cell q (falling or flowing)? Not into fire: it sits on top (and water puts it out). */
function canEnter(g: CellGrid, m: number, q: number): boolean {
  const mq = g.cells[q]
  if (mq === M.EMPTY) return true
  const kq = KIND[mq]
  if (kq === Kind.GAS) return true
  return kq === Kind.LIQUID && DENSITY[mq] < DENSITY[m]
}

function powder(g: CellGrid, x: number, y: number, p: number, m: number, dir: number): void {
  if (y + 1 >= g.height) return
  if (FLOW[m] < 1 && rnd() > FLOW[m]) return // light powders (snow, ash, seeds) drift down slower
  const W = g.width, b = p + W
  if (canEnter(g, m, b)) return swap(g, p, b)
  if (SLOPE[m] === 2) {
    // Holds a slope: slides only off a steep drop (two open cells down the diagonal), and reluctantly.
    if (rnd() > 0.1) return
    for (const d of [dir, -dir]) {
      if (g.inside(x + d, y + 2) && canEnter(g, m, b + d) && canEnter(g, m, b + W + d)) return swap(g, p, b + d)
    }
    return
  }
  for (const d of [dir, -dir]) if (g.inside(x + d, y + 1) && canEnter(g, m, b + d)) return swap(g, p, b + d)
}

/** Clinging to a wall or ceiling beside or above it. */
function clings(g: CellGrid, x: number, y: number): boolean {
  return KIND[g.get(x - 1, y)] === Kind.SOLID || KIND[g.get(x + 1, y)] === Kind.SOLID || KIND[g.get(x, y - 1)] === Kind.SOLID
}

function liquid(g: CellGrid, x: number, y: number, p: number, m: number, dir: number): void {
  if (FLOW[m] < 1 && rnd() > FLOW[m]) return // thick liquids (lava, mud, honey, tar) move slowly
  if (STICKY[m] && clings(g, x, y)) return
  if (y + 1 < g.height) {
    const b = p + g.width
    if (canEnter(g, m, b)) return swap(g, p, b)
    for (const d of [dir, -dir]) if (g.inside(x + d, y + 1) && canEnter(g, m, b + d)) return swap(g, p, b + d)
  }
  const spread = SPREAD[m]
  for (const d of [dir, -dir]) {
    let t = -1
    for (let s = 1; s <= spread; s++) {
      if (!g.inside(x + d * s, y)) break
      const q = p + d * s, mq = g.cells[q]
      if (mq === M.EMPTY || KIND[mq] === Kind.GAS) t = q
      else break
    }
    if (t >= 0) return swap(g, p, t)
  }
}

function gas(g: CellGrid, x: number, y: number, p: number, m: number, dir: number): void {
  if ((g.life[p] & LIFE) <= 1) { g.set(x, y, gasEnd(m)); return }
  g.life[p]--
  if (rnd() < 0.25) return
  const W = g.width, lift = LIFT[m]
  if (lift > 0 && y > 0 && rnd() < lift) {
    // Rising: up through anything loose (bubbling up through water), or up and aside into the open.
    const u = p - W, mu = g.cells[u], ku = KIND[mu]
    if (mu === M.EMPTY || ku === Kind.LIQUID || ku === Kind.POWDER) return swap(g, p, u)
    const d = rnd() < 0.5 ? dir : -dir
    if (g.inside(x + d, y - 1) && g.cells[u + d] === M.EMPTY) return swap(g, p, u + d)
  } else if (lift < 0 && y + 1 < g.height && rnd() < -lift) {
    // Sinking low (miasma, spores): down into the open only.
    const b = p + W
    if (g.cells[b] === M.EMPTY) return swap(g, p, b)
    const d = rnd() < 0.5 ? dir : -dir
    if (g.inside(x + d, y + 1) && g.cells[b + d] === M.EMPTY) return swap(g, p, b + d)
  }
  const d = rnd() < 0.5 ? 1 : -1
  if (g.inside(x + d, y) && g.cells[p + d] === M.EMPTY) swap(g, p, p + d)
}

function fire(g: CellGrid, x: number, y: number, p: number): void {
  const l = g.life[p], fuel = (l & FUEL) !== 0
  if ((l & LIFE) <= 1) {
    // Burnt-out fuel leaves smoke and sometimes ash; a loose flame (or spirits) just a little smoke.
    const r = rnd()
    if (r < (fuel ? 0.35 : 0.15)) g.set(x, y, M.SMOKE, lifeFor(M.SMOKE))
    else if (fuel && !(l & BLUE) && r < 0.5) g.set(x, y, M.ASH)
    else g.set(x, y, M.EMPTY)
    return
  }
  g.life[p] = l - 1
  for (const [dx, dy] of N4) {
    const nx = x + dx, ny = y + dy
    if (!g.inside(nx, ny)) continue
    const n = g.cells[ny * g.width + nx]
    if (n === M.WATER || n === M.SALT_WATER) {
      // Water puts it out, with a puff of steam.
      if (rnd() < perSec(25)) {
        g.set(x, y, M.EMPTY)
        if (rnd() < 0.5) g.set(nx, ny, M.STEAM, lifeFor(M.STEAM))
        return
      }
      continue
    }
    if (n === M.ASH && rnd() < perSec(2)) { g.set(x, y, M.SMOKE, lifeFor(M.SMOKE)); return } // smothered
    heatTouch(g, nx, ny, 1)
  }
  // Burning fuel stays put and sends small flames up; loose flames lick upwards.
  if (fuel) {
    if (y > 0 && g.cells[p - g.width] === M.EMPTY && rnd() < perSec(8)) g.set(x, y - 1, M.FIRE, (l & BLUE) | lifeSteps(0.15 + rnd() * 0.2))
    return
  }
  if (y > 0 && rnd() < 0.45) {
    const u = p - g.width
    if (g.cells[u] === M.EMPTY) return swap(g, p, u)
    const d = rnd() < 0.5 ? 1 : -1
    if (g.inside(x + d, y - 1) && g.cells[u + d] === M.EMPTY) swap(g, p, u + d)
  }
}

/** One random neighbour: its position and material (or -1 outside the world). */
function neighbour(g: CellGrid, x: number, y: number): [number, number, number] {
  const [dx, dy] = N4[(rnd() * 4) | 0]
  const nx = x + dx, ny = y + dy
  return [nx, ny, g.inside(nx, ny) ? g.cells[ny * g.width + nx] : -1]
}

/** Reactions for the materials that have them. Returns true if the cell itself changed (so it doesn't move this step). */
function react(g: CellGrid, x: number, y: number, p: number, m: number): boolean {
  switch (m) {
    case M.WATER:
    case M.SALT_WATER: {
      const [nx, ny, n] = neighbour(g, x, y)
      if (n === M.DIRT && rnd() < touch(0.6)) {
        g.set(nx, ny, M.MUD) // soaks in
        if (rnd() < 0.5) { g.set(x, y, M.EMPTY); return true }
      } else if (n === M.CLAY && rnd() < touch(0.05)) g.set(nx, ny, M.MUD) // softens, slowly
      else if (n === M.SALT && m === M.WATER && rnd() < touch(2)) {
        g.set(nx, ny, M.EMPTY) // dissolves: salty water won't freeze, and plants won't grow in it
        g.set(x, y, M.SALT_WATER)
        return true
      }
      return false
    }
    case M.ACID: {
      const [nx, ny, n] = neighbour(g, x, y)
      if (n === M.WATER || n === M.SALT_WATER) {
        if (rnd() < touch(0.3)) { g.set(x, y, M.WATER); return true } // diluted
        return false
      }
      const rate = EATS[n]
      if (rate && rnd() < touch(rate)) {
        // Eaten cell by cell, giving off smoke; the acid is used up as it goes.
        if (rnd() < 0.3) g.set(nx, ny, M.SMOKE, lifeFor(M.SMOKE))
        else g.set(nx, ny, M.EMPTY)
        if (rnd() < 0.35) { g.set(x, y, M.SMOKE, lifeFor(M.SMOKE)); return true }
      }
      return false
    }
    case M.GUNPOWDER: {
      const l = g.life[p]
      if (!(l & LIT)) return false
      if ((l & LIFE) <= 1) { explode(g, x, y, EXPLODES[M.GUNPOWDER]!.r); return true }
      g.life[p] = l - 1
      return true // a lit grain fizzes where it is for its moment, rather than falling into the crater
    }
    case M.LAVA:
    case M.MOLTEN:
    case M.PLASMA:
    case M.BURNING_THERMITE:
      return hot(g, x, y, p, m)
    case M.ROT: {
      const l = g.life[p]
      if (l <= 1) { g.set(x, y, M.DIRT); return true } // crumbles to soil
      g.life[p] = l - 1
      const [nx, ny, n] = neighbour(g, x, y)
      if ((n === M.WOOD || n === M.PLANT) && rnd() < touch(0.3) && !salted(g, x, y)) g.set(nx, ny, M.ROT, lifeFor(M.ROT))
      else if (n === M.EMPTY && rnd() < touch(0.02)) {
        const gas = rnd() < 0.7 ? M.MIASMA : M.SWAMP_GAS
        g.set(nx, ny, gas, lifeFor(gas))
      }
      return false
    }
    case M.PLANT: plant(g, x, y); return false
    case M.FUNGUS: {
      const [nx, ny, n] = neighbour(g, x, y)
      if ((n === M.ROT || n === M.WOOD) && rnd() < touch(0.05)) g.set(nx, ny, M.FUNGUS) // spreads over rot and wood
      else if (n === M.EMPTY && rnd() < touch(0.02)) g.set(nx, ny, M.SPORES, lifeFor(M.SPORES)) // puffs spores
      return false
    }
    case M.SPORES: {
      const [, , n] = neighbour(g, x, y)
      if ((n === M.WOOD || n === M.ROT || n === M.DIRT) && rnd() < touch(0.5)) { g.set(x, y, M.FUNGUS); return true }
      return false
    }
    case M.SEEDS: {
      // Sprout with dirt (or mud) under them and water about.
      if (rnd() > perSec(0.3)) return false
      const below = g.get(x, y + 1)
      if (below !== M.DIRT && below !== M.MUD) return false
      let wet = below === M.MUD
      for (const [dx, dy] of N4) {
        const a = g.get(x + dx, y + dy), b = g.get(x + dx, y + 1 + dy)
        if (a === M.WATER || a === M.MUD || b === M.WATER || b === M.MUD) wet = true
      }
      if (!wet) return false
      g.set(x, y, M.PLANT)
      if (g.get(x, y - 1) === M.EMPTY) g.set(x, y - 1, M.PLANT)
      return true
    }
    case M.SALT: {
      const [nx, ny, n] = neighbour(g, x, y)
      if ((n === M.ICE || n === M.SNOW) && rnd() < touch(1)) {
        g.set(nx, ny, M.WATER) // melts them
        if (rnd() < 0.3) { g.set(x, y, M.EMPTY); return true }
      } else if (n === M.SLIME && rnd() < touch(3)) g.set(nx, ny, M.EMPTY) // shrivels it
      return false
    }
    case M.MUD:
      // Now and then a bubble of swamp gas.
      if (y > 0 && g.cells[p - g.width] === M.EMPTY && rnd() < perSec(0.003)) g.set(x, y - 1, M.SWAMP_GAS, lifeFor(M.SWAMP_GAS))
      return false
    case M.SPIRITS: {
      if (y > 0 && g.cells[p - g.width] === M.EMPTY && rnd() < perSec(0.05)) { g.set(x, y, M.EMPTY); return true } // evaporates
      const [nx, ny, n] = neighbour(g, x, y)
      if ((n === M.ROT || n === M.SLIME) && rnd() < touch(2)) {
        g.set(nx, ny, M.EMPTY) // washed away
        if (rnd() < 0.3) { g.set(x, y, M.EMPTY); return true }
      }
      return false
    }
    case M.MIST:
      if (rnd() < perSec(0.03)) { g.set(x, y, M.WATER); return true } // rains out, slowly
      return false
    case M.STEAM:
      // Condenses on a ceiling into drops: rain.
      if (y > 0 && KIND[g.cells[p - g.width]] === Kind.SOLID && rnd() < perSec(0.4)) { g.set(x, y, M.WATER); return true }
      return false
    case M.ASH:
    case M.BLOOD: {
      // Worked into dirt, it makes richer soil.
      const [nx, ny, n] = neighbour(g, x, y)
      const q = ny * g.width + nx
      if (n === M.DIRT && !(g.life[q] & RICH) && rnd() < touch(m === M.ASH ? 0.1 : 0.5)) {
        g.life[q] |= RICH
        g.set(x, y, M.EMPTY)
        return true
      }
      return false
    }
  }
  return false
}

/** Something hot: it heats what it touches, and water quenches it (lava to obsidian, molten metal sets). */
function hot(g: CellGrid, x: number, y: number, p: number, m: number): boolean {
  if (m === M.MOLTEN || m === M.BURNING_THERMITE) {
    const l = g.life[p]
    if ((l & LIFE) <= 1) {
      // Molten metal sets back into whichever metal it was; thermite burns out to a little slag.
      if (m === M.MOLTEN) g.set(x, y, l & GOLD ? M.GOLD : M.METAL)
      else g.set(x, y, rnd() < 0.3 ? M.RUBBLE : M.EMPTY)
      return true
    }
    g.life[p] = l - 1
  }
  const level = HEAT[m], scale = m === M.BURNING_THERMITE ? 4 : 1
  for (const [dx, dy] of N4) {
    const nx = x + dx, ny = y + dy
    if (!g.inside(nx, ny)) continue
    const n = g.cells[ny * g.width + nx]
    if (n === M.WATER || n === M.SALT_WATER) {
      if (rnd() < perSec(30)) {
        if (n === M.SALT_WATER && rnd() < 0.3) g.set(nx, ny, M.SALT) // the salt's left behind
        else g.set(nx, ny, M.STEAM, lifeFor(M.STEAM))
        if (m === M.LAVA) { g.set(x, y, M.OBSIDIAN); return true }
        if (m === M.MOLTEN) { g.set(x, y, g.life[p] & GOLD ? M.GOLD : M.METAL); return true }
      }
      continue
    }
    heatTouch(g, nx, ny, level, scale)
  }
  return false
}

function plant(g: CellGrid, x: number, y: number): void {
  // Plants beside water (or mud) slowly spread into open space next to them; faster on rich soil.
  if (rnd() > perSec(0.15)) return
  let wet = false, rich = false
  for (const [dx, dy] of N4) {
    const n = g.get(x + dx, y + dy)
    if (n === M.WATER || n === M.MUD) wet = true
    else if (n === M.DIRT && g.life[(y + dy) * g.width + x + dx] & RICH) rich = true
  }
  if (!wet || (!rich && rnd() > 1 / 3)) return
  const [dx, dy] = N4[(rnd() * 4) | 0]
  if (g.get(x + dx, y + dy) === M.EMPTY) g.set(x + dx, y + dy, M.PLANT)
}
