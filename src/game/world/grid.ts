// The world as a grid of cells, each holding a material. The world is fully destructive (#78): the
// simulation (simulate.ts) moves and changes cells every step, and magic acts on them (elements.ts).

// Every substance in the Element Codex, plus the few in-between states its reactions need (salty
// water, set tar, frozen quicksand, burning thermite). The forces aren't materials: they act on these.
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
  OIL: 13,
  LAVA: 14,
  ACID: 15,
  GUNPOWDER: 16,
  METAL: 17,
  OBSIDIAN: 18,
  MOLTEN: 19, // molten metal; molten gold carries the GOLD mark in its life, so it sets back into gold
  ROT: 20,
  MIASMA: 21,
  MUD: 22,
  SLIME: 23,
  MERCURY: 24,
  BLOOD: 25,
  HONEY: 26,
  TAR: 27,
  SPIRITS: 28,
  MANA: 29,
  SWAMP_GAS: 30,
  MIST: 31,
  SPORES: 32,
  PLASMA: 33,
  DIRT: 34,
  CLAY: 35,
  SALT: 36,
  SNOW: 37,
  COAL: 38,
  CRYSTAL: 39,
  BRICK: 40,
  GOLD: 41,
  BONE: 42,
  FUNGUS: 43,
  SEEDS: 44,
  THERMITE: 45,
  ECTOPLASM: 46,
  QUICKSAND: 47,
  AMBER: 48,
  SALT_WATER: 49,
  HARD_TAR: 50,
  FROZEN_QUICKSAND: 51,
  BURNING_THERMITE: 52,
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
  flow?: number // liquids and powders: the chance to move in a step (thick liquids, light powders); 1 if not given
  slope?: 1 | 2 // powders: 2 holds a slope, sliding only down a steep drop (dirt)
  lift?: number // gases: 1 rises, 0 hangs about, below 0 sinks low
  life?: [number, number] // seconds it lasts (gases, flames) or until it changes (molten metal sets, rot crumbles)
  heat?: number // hot: sets things alight and melts them. 1 a flame, 2 lava, 3 plasma and burning thermite
  sticky?: boolean // clings to walls and ceilings instead of falling (slime)
  sink?: boolean // a powder creatures sink into instead of standing on (quicksand)
  drag?: number // liquids (and quicksand): how freely you move in it, 1 like water
}

const S = Kind.SOLID, P = Kind.POWDER, L = Kind.LIQUID, G = Kind.GAS

// Colours from the Element Codex, except where a colour would vanish against the dark (stone keeps
// the test room's darker rock; tar, coal, obsidian and swamp gas are lifted a little).
export const MATERIALS: Record<Material, MaterialInfo> = {
  [Material.EMPTY]: { name: 'empty', kind: Kind.EMPTY, density: -1, colour: [20, 20, 28] },
  [Material.STONE]: { name: 'stone', kind: S, density: 9, colour: [74, 72, 88] },
  [Material.RUBBLE]: { name: 'rubble', kind: P, density: 6, colour: [106, 100, 116] },
  [Material.SAND]: { name: 'sand', kind: P, density: 5, colour: [224, 191, 110] },
  [Material.GLASS]: { name: 'glass', kind: S, density: 9, colour: [207, 232, 239] },
  [Material.WATER]: { name: 'water', kind: L, density: 2, colour: [58, 134, 238], spread: 4 },
  [Material.ICE]: { name: 'ice', kind: S, density: 9, colour: [168, 220, 240] },
  [Material.STEAM]: { name: 'steam', kind: G, density: 0, colour: [200, 208, 220], lift: 1, life: [2, 4] },
  [Material.WOOD]: { name: 'wood', kind: S, density: 9, colour: [138, 90, 50] },
  [Material.PLANT]: { name: 'plant', kind: Kind.PLANT, density: 9, colour: [79, 174, 74] },
  [Material.FIRE]: { name: 'fire', kind: Kind.FIRE, density: 0, colour: [255, 176, 58], life: [0.4, 0.9], heat: 1 },
  [Material.SMOKE]: { name: 'smoke', kind: G, density: 0, colour: [74, 74, 86], lift: 1, life: [0.8, 1.6] },
  [Material.ASH]: { name: 'ash', kind: P, density: 3, colour: [138, 138, 144], flow: 0.7 },
  [Material.OIL]: { name: 'oil', kind: L, density: 1.5, colour: [90, 68, 40], spread: 4, drag: 0.9 },
  [Material.LAVA]: { name: 'lava', kind: L, density: 3, colour: [255, 106, 30], spread: 1, flow: 0.35, heat: 2, drag: 0.4 },
  [Material.ACID]: { name: 'acid', kind: L, density: 2.15, colour: [200, 255, 58], spread: 3 },
  [Material.GUNPOWDER]: { name: 'gunpowder', kind: P, density: 4, colour: [74, 70, 82] },
  [Material.METAL]: { name: 'metal', kind: S, density: 9, colour: [154, 164, 176] },
  [Material.OBSIDIAN]: { name: 'obsidian', kind: S, density: 9, colour: [52, 36, 74] },
  [Material.MOLTEN]: { name: 'molten metal', kind: L, density: 7, colour: [255, 210, 122], spread: 2, flow: 0.5, heat: 2, life: [8, 14], drag: 0.4 },
  [Material.ROT]: { name: 'rot', kind: S, density: 9, colour: [122, 138, 58], life: [25, 45] },
  [Material.MIASMA]: { name: 'miasma', kind: G, density: 0, colour: [96, 110, 52], lift: -0.5, life: [10, 16] },
  [Material.MUD]: { name: 'mud', kind: L, density: 2.6, colour: [106, 78, 54], spread: 1, flow: 0.3, drag: 0.45 },
  [Material.SLIME]: { name: 'slime', kind: L, density: 1.8, colour: [95, 216, 176], spread: 1, flow: 0.35, sticky: true, drag: 0.4 },
  [Material.MERCURY]: { name: 'mercury', kind: L, density: 13, colour: [216, 220, 232], spread: 3, drag: 0.6 },
  [Material.BLOOD]: { name: 'blood', kind: L, density: 2.05, colour: [138, 31, 42], spread: 4 },
  [Material.HONEY]: { name: 'honey', kind: L, density: 2.4, colour: [232, 162, 58], spread: 1, flow: 0.15, drag: 0.3 },
  [Material.TAR]: { name: 'tar', kind: L, density: 2.3, colour: [44, 38, 40], spread: 1, flow: 0.12, drag: 0.3 },
  [Material.SPIRITS]: { name: 'spirits', kind: L, density: 1.4, colour: [230, 224, 255], spread: 5 },
  [Material.MANA]: { name: 'liquid mana', kind: L, density: 1.9, colour: [87, 200, 255], spread: 3 },
  [Material.SWAMP_GAS]: { name: 'swamp gas', kind: G, density: 0, colour: [70, 84, 64], lift: 0.5, life: [12, 20] },
  [Material.MIST]: { name: 'mist', kind: G, density: 0, colour: [184, 192, 204], lift: 0, life: [12, 24] },
  [Material.SPORES]: { name: 'spores', kind: G, density: 0, colour: [200, 184, 138], lift: -0.3, life: [5, 9] },
  [Material.PLASMA]: { name: 'plasma', kind: G, density: 0, colour: [255, 154, 255], lift: 1, life: [0.3, 0.6], heat: 3 },
  [Material.DIRT]: { name: 'dirt', kind: P, density: 5, colour: [110, 74, 46], slope: 2 },
  [Material.CLAY]: { name: 'clay', kind: S, density: 9, colour: [176, 112, 90] },
  [Material.SALT]: { name: 'salt', kind: P, density: 4, colour: [232, 228, 220] },
  [Material.SNOW]: { name: 'snow', kind: P, density: 1.5, colour: [226, 236, 250], flow: 0.5 },
  [Material.COAL]: { name: 'coal', kind: S, density: 9, colour: [46, 46, 54] },
  [Material.CRYSTAL]: { name: 'crystal', kind: S, density: 9, colour: [159, 232, 240] },
  [Material.BRICK]: { name: 'brick', kind: S, density: 9, colour: [160, 82, 58] },
  [Material.GOLD]: { name: 'gold', kind: S, density: 9, colour: [255, 207, 74] },
  [Material.BONE]: { name: 'bone', kind: P, density: 4, colour: [230, 220, 196] },
  [Material.FUNGUS]: { name: 'fungus', kind: Kind.PLANT, density: 9, colour: [200, 122, 216] },
  [Material.SEEDS]: { name: 'seeds', kind: P, density: 1.8, colour: [160, 138, 74], flow: 0.7 },
  [Material.THERMITE]: { name: 'thermite', kind: P, density: 6, colour: [138, 58, 58] },
  [Material.ECTOPLASM]: { name: 'ectoplasm', kind: G, density: 0, colour: [154, 255, 216], lift: 0.4, life: [8, 14] },
  [Material.QUICKSAND]: { name: 'quicksand', kind: P, density: 5.5, colour: [208, 168, 96], sink: true, drag: 0.3 },
  [Material.AMBER]: { name: 'amber', kind: S, density: 9, colour: [224, 144, 26] },
  [Material.SALT_WATER]: { name: 'salty water', kind: L, density: 2.1, colour: [84, 140, 214], spread: 4 },
  [Material.HARD_TAR]: { name: 'set tar', kind: S, density: 9, colour: [58, 50, 50] },
  [Material.FROZEN_QUICKSAND]: { name: 'frozen quicksand', kind: S, density: 9, colour: [196, 184, 158] },
  [Material.BURNING_THERMITE]: { name: 'burning thermite', kind: P, density: 6, colour: [255, 240, 200], life: [1.5, 2.5], heat: 3 },
}

const INFO = Object.values(MATERIALS)
export const KIND = INFO.map((m) => m.kind)
export const DENSITY = INFO.map((m) => m.density)
export const HEAT = INFO.map((m) => m.heat ?? 0)
/** Solid for creatures: solids and powders hold you up (bar quicksand); liquids, gases, fire and plants don't. */
export const HOLDS = INFO.map((m) => (m.kind === Kind.SOLID || m.kind === Kind.POWDER) && !m.sink)

export class CellGrid {
  readonly width: number
  readonly height: number
  readonly cells: Uint8Array // material
  readonly life: Uint16Array // timers (how long fire, gases, molten metal and rot have left) and marks
  readonly seed: Uint8Array // per-cell variation for colour
  readonly stamp: Uint32Array // the step a cell last moved in, so nothing moves twice in one step
  step = 0
  /** Explosions since the scene last looked: it hurts and shoves whatever's near, then clears this. */
  blasts: { x: number; y: number; r: number }[] = []

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

  set(x: number, y: number, m: Material | number, life = 0): void {
    if (!this.inside(x, y)) return
    const p = y * this.width + x
    this.cells[p] = m
    this.life[p] = life
    this.stamp[p] = this.step
  }

  /** Solid for creatures: solids and powders hold you up (bar quicksand); liquids, gases, fire and plants don't. */
  isSolid = (x: number, y: number): boolean => HOLDS[this.get(x, y)]

  is(x: number, y: number, m: Material): boolean {
    return this.get(x, y) === m
  }
}
