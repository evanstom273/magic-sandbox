// The world as a grid of cells, each holding a material. The world is fully destructive (#78): the
// simulation (simulate.ts) moves and changes cells every step, and magic acts on them (elements.ts).

export const Material = {
  EMPTY: 0,
  STONE: 1,
  RUBBLE: 2,
  SAND: 3,
  GLASS: 4,
  WATER: 5,
  ICE: 6,
  STEAM: 7,
  WOOD: 8,
  PLANT: 9,
  FIRE: 10,
  SMOKE: 11,
  ASH: 12,
} as const
export type Material = (typeof Material)[keyof typeof Material]

export const Kind = { EMPTY: 0, SOLID: 1, POWDER: 2, LIQUID: 3, GAS: 4, FIRE: 5, PLANT: 6 } as const
export type Kind = (typeof Kind)[keyof typeof Kind]

export interface MaterialInfo {
  name: string
  kind: Kind
  density: number // heavier sinks through lighter
  colour: [number, number, number]
  spread?: number // liquids: how far they flow sideways per step
}

// Colours from the Element Codex, except stone, which keeps the test room's darker rock.
export const MATERIALS: Record<Material, MaterialInfo> = {
  [Material.EMPTY]: { name: 'empty', kind: Kind.EMPTY, density: -1, colour: [20, 20, 28] },
  [Material.STONE]: { name: 'stone', kind: Kind.SOLID, density: 9, colour: [74, 72, 88] },
  [Material.RUBBLE]: { name: 'rubble', kind: Kind.POWDER, density: 6, colour: [106, 100, 116] },
  [Material.SAND]: { name: 'sand', kind: Kind.POWDER, density: 5, colour: [224, 191, 110] },
  [Material.GLASS]: { name: 'glass', kind: Kind.SOLID, density: 9, colour: [207, 232, 239] },
  [Material.WATER]: { name: 'water', kind: Kind.LIQUID, density: 2, colour: [58, 134, 238], spread: 4 },
  [Material.ICE]: { name: 'ice', kind: Kind.SOLID, density: 9, colour: [168, 220, 240] },
  [Material.STEAM]: { name: 'steam', kind: Kind.GAS, density: 0, colour: [200, 208, 220] },
  [Material.WOOD]: { name: 'wood', kind: Kind.SOLID, density: 9, colour: [138, 90, 50] },
  [Material.PLANT]: { name: 'plant', kind: Kind.PLANT, density: 9, colour: [79, 174, 74] },
  [Material.FIRE]: { name: 'fire', kind: Kind.FIRE, density: 0, colour: [255, 176, 58] },
  [Material.SMOKE]: { name: 'smoke', kind: Kind.GAS, density: 0, colour: [74, 74, 86] },
  [Material.ASH]: { name: 'ash', kind: Kind.POWDER, density: 3, colour: [138, 138, 144] },
}
export const KIND = Object.values(MATERIALS).map((m) => m.kind)
export const DENSITY = Object.values(MATERIALS).map((m) => m.density)

export class CellGrid {
  readonly width: number
  readonly height: number
  readonly cells: Uint8Array // material
  readonly life: Uint16Array // timers: how long fire, steam and smoke have left
  readonly seed: Uint8Array // per-cell variation for colour
  readonly stamp: Uint32Array // the step a cell last moved in, so nothing moves twice in one step
  step = 0

  constructor(width: number, height: number) {
    this.width = width
    this.height = height
    this.cells = new Uint8Array(width * height)
    this.life = new Uint16Array(width * height)
    this.seed = new Uint8Array(width * height)
    this.stamp = new Uint32Array(width * height)
    let s = 12345
    for (let i = 0; i < this.seed.length; i++) this.seed[i] = (s = (s * 1103515245 + 12345) >>> 0) >>> 24
  }

  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height
  }

  /** Outside the grid counts as stone: the world's edge is the one thing that can't be destroyed. */
  get(x: number, y: number): Material {
    if (!this.inside(x, y)) return Material.STONE
    return this.cells[y * this.width + x] as Material
  }

  set(x: number, y: number, m: Material, life = 0): void {
    if (!this.inside(x, y)) return
    const p = y * this.width + x
    this.cells[p] = m
    this.life[p] = life
    this.stamp[p] = this.step
  }

  /** Solid for creatures: solids and powders hold you up; liquids, gases, fire and plants don't. */
  isSolid = (x: number, y: number): boolean => {
    const k = KIND[this.get(x, y)]
    return k === Kind.SOLID || k === Kind.POWDER
  }

  is(x: number, y: number, m: Material): boolean {
    return this.get(x, y) === m
  }
}
