import { CellGrid, Kind, Material as M, MATERIALS } from './grid.ts'
import { BLUE, GLOW, LIT } from './reactions.ts'

// The world is dark; light is precious (Element Codex, Light). Light spreads from glowing cells and
// lights (the player's own, cast Light, spells in flight) cell by cell, fading through open air and
// quickly through anything solid, so rock throws shadows and only its surface is lit. Shadow's pools
// darken everything in them. The world is drawn multiplied by this; characters and spells are drawn
// on top, undarkened (the style guide: darkness above the world, below characters and effects).

/** Claude's numbers, to tune: how bright the unlit dark is, and the player's own light. */
export const LIGHTING = {
  ambient: 0.3, // the darkest anything gets (0 is black)
  player: { r: 1, g: 0.94, b: 0.82, power: 1.7 }, // a soft pool of light around the player
}
const AIR = 0.945 // light kept per cell through air (and glass, ice and crystal, which let it through)
const LIQUID = 0.86
const SOLID = 0.6
const AIR_D = AIR ** Math.SQRT2, LIQUID_D = LIQUID ** Math.SQRT2, SOLID_D = SOLID ** Math.SQRT2

/** Light a cell gives off by itself: [r, g, b] at full strength. */
const EMITS: Partial<Record<number, [number, number, number]>> = {
  [M.FIRE]: [1, 0.6, 0.25],
  [M.LAVA]: [1, 0.45, 0.15],
  [M.MOLTEN]: [1, 0.75, 0.4],
  [M.PLASMA]: [1, 0.6, 1],
  [M.BURNING_THERMITE]: [1, 0.95, 0.8],
  [M.MANA]: [0.3, 0.7, 1],
  [M.FUNGUS]: [0.35, 0.18, 0.4], // faintly
  [M.ECTOPLASM]: [0.3, 0.55, 0.45],
}

export interface LightSource { x: number; y: number; r: number; g: number; b: number }
export interface DarkPool { x: number; y: number; radius: number; strength: number }

export class LightMap {
  readonly width: number
  readonly height: number
  /** How lit each cell is, per channel: the ambient dark plus everything reaching it (about 0–1.3). */
  readonly r: Float32Array
  readonly g: Float32Array
  readonly b: Float32Array
  private keep: Float32Array
  private keepD: Float32Array // the same across a diagonal step (√2 cells)

  constructor(width: number, height: number) {
    this.width = width
    this.height = height
    const n = width * height
    this.r = new Float32Array(n)
    this.g = new Float32Array(n)
    this.b = new Float32Array(n)
    this.keep = new Float32Array(n)
    this.keepD = new Float32Array(n)
  }

  compute(grid: CellGrid, sources: readonly LightSource[], darks: readonly DarkPool[] = []): void {
    const W = this.width, H = this.height, N = W * H
    const R = this.r, G = this.g, B = this.b, keep = this.keep, keepD = this.keepD, cells = grid.cells, life = grid.life
    // What each cell gives off, and how much light it lets through.
    for (let p = 0; p < N; p++) {
      const m = cells[p], k = KIND_OF[m]
      const open = k === Kind.EMPTY || k === Kind.GAS || k === Kind.FIRE || k === Kind.PLANT || CLEAR[m]
      keep[p] = open ? AIR : k === Kind.LIQUID ? LIQUID : SOLID
      keepD[p] = open ? AIR_D : k === Kind.LIQUID ? LIQUID_D : SOLID_D
      let e = EMITS[m]
      if (m === M.FIRE && life[p] & BLUE) e = BLUE_FLAME
      else if (m === M.GUNPOWDER && life[p] & LIT) e = FUSE
      else if (CLEAR[m] && life[p] & 0x3fff) e = m === M.CRYSTAL ? CRYSTAL_GLOW : PALE_GLOW // lit by Light: glows a while
      else if (m === M.PLANT && life[p] & GLOW) e = MOSS_GLOW
      if (e) { R[p] = e[0]; G[p] = e[1]; B[p] = e[2] } else { R[p] = 0; G[p] = 0; B[p] = 0 }
    }
    // Shadow snuffs light: nothing in its pools gives off any (fire still burns, but lights nothing).
    for (const d of darks) this.eachIn(d.x, d.y, d.radius, (p) => { R[p] = 0; G[p] = 0; B[p] = 0 })
    for (const s of sources) {
      const x = Math.floor(s.x), y = Math.floor(s.y)
      if (x < 0 || y < 0 || x >= W || y >= H) continue
      const p = y * W + x
      R[p] = Math.max(R[p], s.r); G[p] = Math.max(G[p], s.g); B[p] = Math.max(B[p], s.b)
    }
    // Spread it in two sweeps over all eight neighbours: forwards (from the left and the row above),
    // then back (from the right and the row below), so it reaches every direction.
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const p = y * W + x, k = keep[p], kd = keepD[p]
        if (x > 0) spread(R, G, B, p, p - 1, k)
        if (y > 0) {
          spread(R, G, B, p, p - W, k)
          if (x > 0) spread(R, G, B, p, p - W - 1, kd)
          if (x < W - 1) spread(R, G, B, p, p - W + 1, kd)
        }
      }
    }
    for (let y = H - 1; y >= 0; y--) {
      for (let x = W - 1; x >= 0; x--) {
        const p = y * W + x, k = keep[p], kd = keepD[p]
        if (x < W - 1) spread(R, G, B, p, p + 1, k)
        if (y < H - 1) {
          spread(R, G, B, p, p + W, k)
          if (x < W - 1) spread(R, G, B, p, p + W + 1, kd)
          if (x > 0) spread(R, G, B, p, p + W - 1, kd)
        }
      }
    }
    const a = LIGHTING.ambient
    for (let p = 0; p < N; p++) { R[p] += a; G[p] += a; B[p] += a }
    // Shadow's pools: dark you can hide in, darkest in the middle.
    for (const d of darks) {
      this.eachIn(d.x, d.y, d.radius, (p, t) => {
        const f = 1 - d.strength * Math.sqrt(1 - t)
        R[p] *= f; G[p] *= f; B[p] *= f
      })
    }
  }

  /** Calls f for each cell within radius of (cx, cy), with how far out it is (0 middle, 1 edge). */
  private eachIn(cx: number, cy: number, radius: number, f: (p: number, t: number) => void): void {
    const W = this.width, H = this.height
    for (let y = Math.max(0, Math.floor(cy - radius)); y <= Math.min(H - 1, Math.ceil(cy + radius)); y++) {
      for (let x = Math.max(0, Math.floor(cx - radius)); x <= Math.min(W - 1, Math.ceil(cx + radius)); x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy)
        if (d <= radius) f(y * W + x, d / radius)
      }
    }
  }
}

const KIND_OF = Object.values(MATERIALS).map((m) => m.kind)
/** Glass, ice and crystal let light through, and glow for a while when Light falls on them. */
const CLEAR = Object.values(MATERIALS).map((_, i) => i === M.GLASS || i === M.ICE || i === M.CRYSTAL)
const BLUE_FLAME: [number, number, number] = [0.45, 0.6, 1]
const FUSE: [number, number, number] = [0.8, 0.45, 0.15]
const PALE_GLOW: [number, number, number] = [0.6, 0.72, 0.8]
const CRYSTAL_GLOW: [number, number, number] = [0.55, 0.9, 1]
const MOSS_GLOW: [number, number, number] = [0.35, 0.7, 0.35]

function spread(R: Float32Array, G: Float32Array, B: Float32Array, p: number, q: number, k: number): void {
  const r = R[q] * k, g = G[q] * k, b = B[q] * k
  if (r > R[p]) R[p] = r
  if (g > G[p]) G[p] = g
  if (b > B[p]) B[p] = b
}
