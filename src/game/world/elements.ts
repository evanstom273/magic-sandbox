import { CellGrid, HEAT, Kind, KIND, Material as M } from './grid.ts'
import { BURNS, EXPLODES, explode, FREEZES, GOLD, ignite, lifeFor, lifeSteps, lightThermite, melt, MELTS, salted, voidBurst } from './reactions.ts'

// How elements act on the world's cells (Element Codex). Substances make material; forces change
// what's there. Creatures are handled by the magic itself.

export type ElementId =
  // Forces (Lightning, Light and Shadow still to come)
  | 'life' | 'heat' | 'cold' | 'force' | 'decay' | 'gravity' | 'void' | 'magnetism' | 'sound' | 'time'
  // Liquids
  | 'water' | 'oil' | 'lava' | 'acid' | 'slime' | 'mercury' | 'blood' | 'honey' | 'tar' | 'spirits' | 'mana'
  // Gases
  | 'swampgas' | 'mist'
  // Solids and powders
  | 'sand' | 'stone' | 'gunpowder' | 'metal' | 'dirt' | 'clay' | 'salt' | 'snow' | 'coal' | 'crystal' | 'gold'
  | 'bone' | 'fungus' | 'seeds' | 'thermite' | 'quicksand'
  // Made by reactions (castable once drawn in; drawing in isn't built, so they're open for now)
  | 'steam' | 'smoke' | 'ice' | 'obsidian' | 'glass' | 'rubble' | 'molten' | 'plants' | 'rot' | 'mud'
  | 'spores' | 'plasma' | 'brick' | 'ash' | 'ectoplasm' | 'amber'

/** The material each substance makes. Fire isn't here: the codex says it can't be cast. */
export const SUBSTANCE: Partial<Record<ElementId, M>> = {
  water: M.WATER, oil: M.OIL, lava: M.LAVA, acid: M.ACID, slime: M.SLIME, mercury: M.MERCURY, blood: M.BLOOD,
  honey: M.HONEY, tar: M.TAR, spirits: M.SPIRITS, mana: M.MANA,
  swampgas: M.SWAMP_GAS, mist: M.MIST,
  sand: M.SAND, stone: M.STONE, gunpowder: M.GUNPOWDER, metal: M.METAL, dirt: M.DIRT, clay: M.CLAY, salt: M.SALT,
  snow: M.SNOW, coal: M.COAL, crystal: M.CRYSTAL, gold: M.GOLD, bone: M.BONE, fungus: M.FUNGUS, seeds: M.SEEDS,
  thermite: M.THERMITE, quicksand: M.QUICKSAND,
  steam: M.STEAM, smoke: M.SMOKE, ice: M.ICE, obsidian: M.OBSIDIAN, glass: M.GLASS, rubble: M.RUBBLE,
  molten: M.MOLTEN, plants: M.WOOD, rot: M.MIASMA, mud: M.MUD, spores: M.SPORES, plasma: M.PLASMA,
  brick: M.BRICK, ash: M.ASH, ectoplasm: M.ECTOPLASM, amber: M.AMBER,
}

const rnd = Math.random

/** Forces that work as a field where they land (a well, a magnet, a time bubble): the magic makes those, not the cells. */
export const FIELD_FORCES: readonly ElementId[] = ['gravity', 'magnetism', 'time']

/** What mixing does before anything is cast (Element Codex): Life and Decay cancel where they meet, so a spell of both does neither. */
export function mix(els: readonly ElementId[]): ElementId[] {
  if (els.includes('life') && els.includes('decay')) return els.filter((e) => e !== 'life' && e !== 'decay')
  return [...els]
}

/** How an element feels to a creature it touches, for the stand-in dummies: burning, freezing, wetting, poisoning, stunning. */
export function feel(el: ElementId): 'hot' | 'cold' | 'wet' | 'poison' | 'stun' | undefined {
  if (el === 'heat') return 'hot'
  if (el === 'cold') return 'cold'
  if (el === 'decay') return 'poison'
  if (el === 'sound') return 'stun'
  const s = SUBSTANCE[el]
  if (s === undefined) return undefined
  if (HEAT[s] > 0) return 'hot'
  if (s === M.ICE || s === M.SNOW) return 'cold'
  if (KIND[s] === Kind.LIQUID) return 'wet'
  return undefined
}

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

/**
 * Heat on one cell. `sustained` is a held spell (beam, channelled cone): hotter, enough to turn
 * sand to glass, metal to molten metal and stone to lava, and to light thermite.
 */
export function heat(g: CellGrid, x: number, y: number, sustained = false): void {
  if (!g.inside(x, y)) return
  const m = g.get(x, y), p = y * g.width + x, level = sustained ? 3 : 1.5
  if (m === M.WATER) { if (rnd() < 0.7) g.set(x, y, M.STEAM, lifeFor(M.STEAM)); return }
  if (m === M.SALT_WATER) {
    // Boils off, leaving the salt behind.
    if (rnd() < 0.7) { if (rnd() < 0.3) g.set(x, y, M.SALT); else g.set(x, y, M.STEAM, lifeFor(M.STEAM)) }
    return
  }
  if (m === M.EMPTY) { if (rnd() < 0.3) g.set(x, y, M.FIRE, lifeSteps(0.15 + rnd() * 0.25)); return }
  const ex = EXPLODES[m]
  if (ex) { explode(g, x, y, ex.r); return }
  if (m === M.THERMITE) { if (sustained && rnd() < 0.1) lightThermite(g, x, y); return }
  if (BURNS[m]) { ignite(g, x, y, m); return }
  if (m === M.MOLTEN) { g.life[p] = (g.life[p] & GOLD) | lifeFor(M.MOLTEN); return } // kept molten
  const mt = MELTS[m]
  if (mt && level >= mt.level && rnd() < mt.cast) melt(g, x, y, m, mt.into)
}

/** Cold on one cell: freezes water, sets lava to obsidian and molten metal back to metal, puts fire out. */
export function cold(g: CellGrid, x: number, y: number): void {
  if (!g.inside(x, y)) return
  const m = g.get(x, y)
  if (m === M.MOLTEN) { g.set(x, y, g.life[y * g.width + x] & GOLD ? M.GOLD : M.METAL); return }
  const into = FREEZES[m]
  if (into !== undefined) g.set(x, y, into, lifeFor(into))
}

/** Life on one cell: plants grow on surfaces and spread; rot heals back to wood, miasma clears, seeds sprout. */
export function life(g: CellGrid, x: number, y: number): void {
  const m = g.get(x, y)
  if (!g.inside(x, y)) return
  if (m === M.ROT) g.set(x, y, M.WOOD)
  else if (m === M.MIASMA) g.set(x, y, M.EMPTY)
  else if (m === M.SEEDS) g.set(x, y, M.PLANT)
  else if (m === M.PLANT) {
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

/** Decay on one cell: withers plants and rots wood (then to dust), corrodes metal slowly, feeds fungus. Salt stops it; gold doesn't rot. */
export function decay(g: CellGrid, x: number, y: number): void {
  if (!g.inside(x, y) || salted(g, x, y)) return
  const m = g.get(x, y)
  if (m === M.PLANT) { if (rnd() < 0.6) g.set(x, y, M.ROT, lifeFor(M.ROT)) }
  else if (m === M.WOOD) { if (rnd() < 0.4) g.set(x, y, M.ROT, lifeFor(M.ROT)) }
  else if (m === M.ROT) { if (rnd() < 0.15) g.set(x, y, M.DIRT) }
  else if (m === M.METAL) { if (rnd() < 0.03) g.set(x, y, M.RUBBLE) }
  else if (m === M.SEEDS) { if (rnd() < 0.5) g.set(x, y, M.EMPTY) }
  else if (m === M.FUNGUS) {
    // Decay feeds fungus rather than killing it.
    const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][(rnd() * 4) | 0]
    if (rnd() < 0.3 && g.get(x + dx, y + dy) === M.EMPTY) g.set(x + dx, y + dy, M.FUNGUS)
  } else if (m === M.EMPTY && rnd() < 0.04) g.set(x, y, M.MIASMA, lifeFor(M.MIASMA))
}

/** Void on one cell: unmade, clean away; only obsidian holds. Meeting liquid mana, it bursts. */
export function unmake(g: CellGrid, x: number, y: number): void {
  if (!g.inside(x, y)) return
  const m = g.get(x, y)
  if (m === M.EMPTY || m === M.OBSIDIAN) return
  if (m === M.MANA) { voidBurst(g, x, y, 8); return }
  g.set(x, y, M.EMPTY)
}

const BRITTLE: Partial<Record<number, number>> = { [M.GLASS]: M.SAND, [M.ICE]: M.SNOW, [M.CRYSTAL]: M.EMPTY, [M.BONE]: M.EMPTY }

/** Sound on one cell: shatters glass, ice, crystal and bone; shakes bits loose from ceilings; slumps loose stuff. */
export function sound(g: CellGrid, x: number, y: number): void {
  if (!g.inside(x, y)) return
  const m = g.get(x, y)
  const into = BRITTLE[m]
  if (into !== undefined) { if (rnd() < 0.5) g.set(x, y, into); return }
  if (m === M.STONE) { if (g.get(x, y + 1) === M.EMPTY && rnd() < 0.08) g.set(x, y, M.RUBBLE); return }
  if (KIND[m] === Kind.POWDER) {
    const d = rnd() < 0.5 ? 1 : -1
    if (g.inside(x + d, y + 1) && g.get(x + d, y + 1) === M.EMPTY) {
      const p = y * g.width + x, q = (y + 1) * g.width + x + d
      g.cells[q] = g.cells[p]; g.life[q] = g.life[p]; g.stamp[q] = g.step
      g.cells[p] = M.EMPTY; g.life[p] = 0
    }
  }
}

/** What a strong enough push breaks: the strength it takes, and what it leaves. */
const BREAKS: Partial<Record<number, { at: number; into: number; chance: (s: number) => number }>> = {
  [M.STONE]: { at: 0.7, into: M.RUBBLE, chance: (s) => (s - 0.6) * 0.8 },
  [M.GLASS]: { at: 0.5, into: M.SAND, chance: (s) => s * 0.6 },
  [M.ICE]: { at: 0.5, into: M.SNOW, chance: (s) => s * 0.6 }, // shatters
  [M.BONE]: { at: 0.5, into: M.EMPTY, chance: (s) => s * 0.4 }, // brittle
  [M.BRICK]: { at: 0.95, into: M.RUBBLE, chance: (s) => (s - 0.9) * 0.8 }, // only strong Force
}

/**
 * Force over a disc: pushes loose cells (powders, liquids, gases, fire) away from (ox, oy), or along
 * (dx, dy) if given. Strong enough (strength 0–1), it breaks stone to rubble, shatters glass to sand
 * and ice to snow, crushes bone and, very strong, breaks brick. Metal is too heavy to move.
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
    const br = BREAKS[m]
    if (br && strength >= br.at) { if (rnd() < br.chance(strength)) g.set(x, y, br.into); if (k !== Kind.POWDER) continue }
    if (!(k === Kind.POWDER || k === Kind.LIQUID || k === Kind.GAS || k === Kind.FIRE)) continue
    if (g.get(x, y) === M.EMPTY) continue
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
  else if (el === 'decay') decay(g, x, y)
  else if (el === 'void') unmake(g, x, y)
  else if (el === 'sound') sound(g, x, y)
}

/** Elements over a disc: substances fill it (mostly), forces act on every cell in it. */
export function applyDisc(g: CellGrid, els: readonly ElementId[], cx: number, cy: number, r: number, strength = 1, sustained = false): void {
  for (const el of els) {
    if (el === 'force') { push(g, cx, cy, r, strength); continue }
    if (FIELD_FORCES.includes(el)) continue
    const fill = SUBSTANCE[el] !== undefined ? 0.75 : el === 'void' ? 1 : 0.9 // Void digs clean holes
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 > r * r || rnd() > fill) continue
        applyToCell(g, el, x, y, sustained)
      }
    }
  }
}
