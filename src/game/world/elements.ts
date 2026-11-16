import { CellGrid, Kind, KIND, Material as M } from './grid.ts'
import { FUEL, lifeFor, lifeSteps } from './simulate.ts'

// How the six test elements act on the world's cells (Element Codex). Substances make material;
// forces change what's there. Creatures are handled by the magic itself.

export const ElementId = { WATER: 'water', SAND: 'sand', HEAT: 'heat', COLD: 'cold', FORCE: 'force', LIFE: 'life' } as const
export type ElementId = (typeof ElementId)[keyof typeof ElementId]

export const SUBSTANCE: Partial<Record<ElementId, M>> = { water: M.WATER, sand: M.SAND }

const rnd = Math.random

/** Puts a substance into a cell if there's room (empty, gas or fire). */
export function place(g: CellGrid, x: number, y: number, m: M): boolean {
  const cur = g.get(x, y)
  if (!g.inside(x, y)) return false
  if (cur === M.EMPTY || KIND[cur] === Kind.GAS || KIND[cur] === Kind.FIRE) {
    g.set(x, y, m, lifeFor(m))
    return true
  }
  return false
}

/** Heat on one cell. `sustained` is a held spell (beam, channelled cone), which can turn sand to glass. */
export function heat(g: CellGrid, x: number, y: number, sustained = false): void {
  const m = g.get(x, y)
  if (!g.inside(x, y)) return
  if (m === M.WATER) { if (rnd() < 0.7) g.set(x, y, M.STEAM, lifeFor(M.STEAM)) }
  else if (m === M.ICE) g.set(x, y, M.WATER)
  else if (m === M.WOOD) g.set(x, y, M.FIRE, FUEL | lifeSteps(0.9 + rnd() * 1.2))
  else if (m === M.PLANT) g.set(x, y, M.FIRE, FUEL | lifeSteps(0.4 + rnd() * 0.4))
  else if (m === M.EMPTY && rnd() < 0.3) g.set(x, y, M.FIRE, lifeSteps(0.15 + rnd() * 0.25))
  else if (m === M.SAND && sustained && rnd() < 0.04) g.set(x, y, M.GLASS)
}

export function cold(g: CellGrid, x: number, y: number): void {
  const m = g.get(x, y)
  if (!g.inside(x, y)) return
  if (m === M.WATER) g.set(x, y, M.ICE)
  else if (m === M.STEAM) g.set(x, y, M.WATER)
  else if (m === M.FIRE) g.set(x, y, M.EMPTY)
}

/** Life on one cell: plants grow on surfaces and spread. */
export function life(g: CellGrid, x: number, y: number): void {
  const m = g.get(x, y)
  if (!g.inside(x, y)) return
  if (m === M.PLANT) {
    const dirs = [[1, 0], [-1, 0], [0, -1], [0, 1]]
    const [dx, dy] = dirs[(rnd() * 4) | 0]
    if (g.get(x + dx, y + dy) === M.EMPTY && supported(g, x + dx, y + dy)) g.set(x + dx, y + dy, M.PLANT)
  } else if (m === M.EMPTY && supported(g, x, y) && rnd() < 0.5) g.set(x, y, M.PLANT)
}

/** Something for a plant to grow from: a solid or powder (not a liquid) beside or below, or another plant. */
function supported(g: CellGrid, x: number, y: number): boolean {
  for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
    const n = g.get(x + dx, y + dy), k = KIND[n]
    if (k === Kind.SOLID || k === Kind.POWDER || n === M.PLANT) return true
  }
  return false
}

/**
 * Force over a disc: pushes loose cells (powders, liquids, gases, fire) away from (ox, oy), or along
 * (dx, dy) if given. Strong enough (strength 0–1), it breaks stone to rubble and shatters glass to sand.
 */
export function push(g: CellGrid, cx: number, cy: number, r: number, strength: number, ox = cx, oy = cy, dx = 0, dy = 0): void {
  const cells: { x: number; y: number; d: number }[] = []
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if (!g.inside(x, y) || (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 > r * r) continue
      cells.push({ x, y, d: (x - ox) ** 2 + (y - oy) ** 2 })
    }
  }
  // Furthest first, so cells nearer the origin have somewhere to go.
  cells.sort((a, b) => b.d - a.d)
  const reach = Math.max(1, Math.round(strength * 4))
  for (const { x, y } of cells) {
    const m = g.get(x, y), k = KIND[m]
    if (m === M.STONE && strength >= 0.7 && rnd() < (strength - 0.6) * 0.8) { g.set(x, y, M.RUBBLE); continue }
    if (m === M.GLASS && strength >= 0.5 && rnd() < strength * 0.6) { g.set(x, y, M.SAND); continue }
    if (!(k === Kind.POWDER || k === Kind.LIQUID || k === Kind.GAS || k === Kind.FIRE)) continue
    let vx = dx, vy = dy
    if (vx === 0 && vy === 0) { vx = x - ox; vy = y - oy; const l = Math.hypot(vx, vy) || 1; vx /= l; vy /= l }
    let px = x, py = y
    for (let s = 1; s <= reach; s++) {
      const nx = Math.round(x + vx * s), ny = Math.round(y + vy * s)
      if (!g.inside(nx, ny) || g.get(nx, ny) !== M.EMPTY) break
      px = nx; py = ny
    }
    if (px !== x || py !== y) {
      const p = y * g.width + x, q = py * g.width + px
      g.cells[q] = g.cells[p]; g.life[q] = g.life[p]; g.stamp[q] = g.step
      g.cells[p] = M.EMPTY; g.life[p] = 0
    }
  }
}

/** One element on one cell (the push for Force is done over a region, by `push`). */
export function applyToCell(g: CellGrid, el: ElementId, x: number, y: number, sustained = false): void {
  const sub = SUBSTANCE[el]
  if (sub !== undefined) { place(g, x, y, sub); return }
  if (el === 'heat') heat(g, x, y, sustained)
  else if (el === 'cold') cold(g, x, y)
  else if (el === 'life') life(g, x, y)
}

/** Elements over a disc: substances fill it (mostly), forces act on every cell in it. */
export function applyDisc(g: CellGrid, els: readonly ElementId[], cx: number, cy: number, r: number, strength = 1, sustained = false): void {
  for (const el of els) {
    if (el === 'force') { push(g, cx, cy, r, strength); continue }
    const fill = SUBSTANCE[el] !== undefined ? 0.75 : 0.9
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 > r * r || rnd() > fill) continue
        applyToCell(g, el, x, y, sustained)
      }
    }
  }
}
