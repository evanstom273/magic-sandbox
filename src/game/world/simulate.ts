import { CellGrid, DENSITY, Kind, KIND, Material as M, MATERIALS } from './grid.ts'

// The falling-sand rules. One step moves powders down, liquids down and sideways, gases up, and
// runs the reactions that happen on contact (Element Codex, "When materials meet").

export const STEPS_PER_SECOND = 120
const rnd = Math.random
/** A per-second chance as a per-step chance. */
const perSec = (n: number) => n / STEPS_PER_SECOND
export const lifeSteps = (seconds: number) => Math.max(1, Math.round(seconds * STEPS_PER_SECOND))
/** Marks a fire as burning fuel (wood, plants): it stays put for its whole life. Loose flames rise. */
export const FUEL = 0x8000
const LIFE = 0x7fff

export function lifeFor(m: number): number {
  if (m === M.STEAM) return lifeSteps(2 + rnd() * 2)
  if (m === M.SMOKE) return lifeSteps(0.8 + rnd() * 0.8)
  if (m === M.FIRE) return lifeSteps(0.4 + rnd() * 0.5)
  return 0
}

const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const

export function step(g: CellGrid): void {
  g.step++
  const W = g.width, H = g.height, c = g.cells, stamp = g.stamp, now = g.step
  for (let y = H - 1; y >= 0; y--) {
    const dir = ((y + now) & 1) ? 1 : -1
    for (let i = 0; i < W; i++) {
      const x = dir > 0 ? i : W - 1 - i
      const p = y * W + x
      const m = c[p]
      if (m === M.EMPTY || stamp[p] === now) continue
      const k = KIND[m]
      if (k === Kind.SOLID) continue
      if (k === Kind.FIRE) { fire(g, x, y, p); continue }
      if (k === Kind.GAS) { gas(g, x, y, p, m, dir); continue }
      if (k === Kind.PLANT) { plant(g, x, y); continue }
      if (k === Kind.POWDER) { powder(g, x, y, p, m, dir); continue }
      if (k === Kind.LIQUID) liquid(g, x, y, p, m, dir)
    }
  }
}

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
    else c[p] = c[p] === M.STEAM && rnd() < 0.3 ? M.WATER : M.EMPTY // its time ran out while being shoved
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
  const b = p + g.width
  if (canEnter(g, m, b)) return swap(g, p, b)
  for (const d of [dir, -dir]) if (g.inside(x + d, y + 1) && canEnter(g, m, b + d)) return swap(g, p, b + d)
}

function liquid(g: CellGrid, x: number, y: number, p: number, m: number, dir: number): void {
  if (y + 1 < g.height) {
    const b = p + g.width
    if (canEnter(g, m, b)) return swap(g, p, b)
    for (const d of [dir, -dir]) if (g.inside(x + d, y + 1) && canEnter(g, m, b + d)) return swap(g, p, b + d)
  }
  const spread = MATERIALS[m as M].spread ?? 2
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
  if (g.life[p] <= 1) {
    // Steam partly condenses back to water; smoke just thins away.
    g.set(x, y, m === M.STEAM && rnd() < 0.3 ? M.WATER : M.EMPTY)
    return
  }
  g.life[p]--
  if (rnd() < 0.25) return
  if (y > 0) {
    const u = p - g.width, mu = g.cells[u], ku = KIND[mu]
    if (mu === M.EMPTY || ku === Kind.LIQUID || ku === Kind.POWDER) return swap(g, p, u)
    const d = rnd() < 0.5 ? dir : -dir
    if (g.inside(x + d, y - 1) && g.cells[u + d] === M.EMPTY) return swap(g, p, u + d)
  }
  const d = rnd() < 0.5 ? 1 : -1
  if (g.inside(x + d, y) && g.cells[p + d] === M.EMPTY) swap(g, p, p + d)
}

function fire(g: CellGrid, x: number, y: number, p: number): void {
  const fuel = (g.life[p] & FUEL) !== 0
  if ((g.life[p] & LIFE) <= 1) {
    // Burnt-out fuel leaves smoke and sometimes ash; a loose flame just leaves a little smoke.
    const r = rnd()
    if (r < (fuel ? 0.35 : 0.15)) g.set(x, y, M.SMOKE, lifeFor(M.SMOKE))
    else if (fuel && r < 0.5) g.set(x, y, M.ASH)
    else g.set(x, y, M.EMPTY)
    return
  }
  g.life[p]--
  for (const [dx, dy] of N4) {
    const nx = x + dx, ny = y + dy
    if (!g.inside(nx, ny)) continue
    const mq = g.get(nx, ny)
    if (mq === M.WOOD && rnd() < perSec(9)) g.set(nx, ny, M.FIRE, FUEL | lifeSteps(0.9 + rnd() * 1.2))
    else if (mq === M.PLANT && rnd() < perSec(12)) g.set(nx, ny, M.FIRE, FUEL | lifeSteps(0.4 + rnd() * 0.4))
    else if (mq === M.WATER && rnd() < perSec(25)) {
      g.set(x, y, M.EMPTY)
      if (rnd() < 0.5) g.set(nx, ny, M.STEAM, lifeFor(M.STEAM))
      return
    } else if (mq === M.ICE && rnd() < perSec(3)) g.set(nx, ny, M.WATER)
  }
  // Burning fuel stays put and sends small flames up; loose flames lick upwards.
  if (fuel) {
    if (y > 0 && g.cells[p - g.width] === M.EMPTY && rnd() < perSec(8)) g.set(x, y - 1, M.FIRE, lifeSteps(0.15 + rnd() * 0.2))
    return
  }
  if (y > 0 && rnd() < 0.45) {
    const u = p - g.width
    if (g.cells[u] === M.EMPTY) return swap(g, p, u)
    const d = rnd() < 0.5 ? 1 : -1
    if (g.inside(x + d, y - 1) && g.cells[u + d] === M.EMPTY) swap(g, p, u + d)
  }
}

function plant(g: CellGrid, x: number, y: number): void {
  // Plants beside water slowly spread into open space next to them.
  if (rnd() > perSec(0.05)) return
  let wet = false
  for (const [dx, dy] of N4) if (g.get(x + dx, y + dy) === M.WATER) wet = true
  if (!wet) return
  const [dx, dy] = N4[(rnd() * 4) | 0]
  if (g.get(x + dx, y + dy) === M.EMPTY) g.set(x + dx, y + dy, M.PLANT)
}
