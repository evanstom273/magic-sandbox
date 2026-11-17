import type { ElementId } from '../world/elements.ts'

// The spell model (#17, #29–#32, #80): a spell is elements + a shape + a casting type, with an
// optional trigger that sets off a follow-up spell (its own elements and shape).

/** The codex's groups: forces, liquids, gases, solids and powders, and things made by reactions. */
export type ElementKind = 'force' | 'liquid' | 'gas' | 'solid' | 'made'
export interface ElementInfo { id: ElementId; name: string; kind: ElementKind; colour: number; cost: number }

// Every castable element so far (#79 the first six; the rest from the codex). Fire isn't castable
// (the codex: Heat on anything flammable makes it). Costs are Claude's, to tune: common stuff is
// cheap, dangerous or rare stuff dear (obsidian, plasma, thermite, gold, and liquid mana, which
// gives back less than it costs).
const el = (id: ElementId, name: string, kind: ElementKind, colour: number, cost: number): ElementInfo => ({ id, name, kind, colour, cost })
export const ELEMENTS: ElementInfo[] = [
  el('life', 'Life', 'force', 0x4fdc6a, 7),
  el('heat', 'Heat', 'force', 0xff8a2a, 5),
  el('cold', 'Cold', 'force', 0xbfeaff, 5),
  el('lightning', 'Lightning', 'force', 0xfff27a, 6),
  el('force', 'Force', 'force', 0xd6d6e6, 5),
  el('decay', 'Decay', 'force', 0x9aa63a, 6),
  el('light', 'Light', 'force', 0xfff6c8, 5),
  el('gravity', 'Gravity', 'force', 0x8a6cff, 7),
  el('void', 'Void', 'force', 0xc03aff, 9),
  el('shadow', 'Shadow', 'force', 0x3b3355, 6),
  el('magnetism', 'Magnetism', 'force', 0xff7ab8, 6),
  el('sound', 'Sound', 'force', 0x9ad8c8, 5),
  el('time', 'Time', 'force', 0xcbb27a, 10),
  el('water', 'Water', 'liquid', 0x3a86ee, 4),
  el('oil', 'Oil', 'liquid', 0x5a4428, 4),
  el('lava', 'Lava', 'liquid', 0xff6a1e, 7),
  el('acid', 'Acid', 'liquid', 0xc8ff3a, 6),
  el('slime', 'Slime', 'liquid', 0x5fd8b0, 5),
  el('mercury', 'Mercury', 'liquid', 0xd8dce8, 6),
  el('blood', 'Blood', 'liquid', 0x8a1f2a, 4),
  el('honey', 'Honey (sap)', 'liquid', 0xe8a23a, 5),
  el('tar', 'Tar', 'liquid', 0x221d1d, 5),
  el('spirits', 'Spirits', 'liquid', 0xe6e0ff, 4),
  el('mana', 'Liquid mana', 'liquid', 0x57c8ff, 12),
  el('swampgas', 'Swamp gas', 'gas', 0x8aa07a, 5),
  el('mist', 'Mist', 'gas', 0xb8c0cc, 3),
  el('sand', 'Sand', 'solid', 0xe0bf6e, 4),
  el('stone', 'Stone', 'solid', 0x7a7486, 5),
  el('gunpowder', 'Gunpowder', 'solid', 0x4a4652, 6),
  el('metal', 'Metal', 'solid', 0x9aa4b0, 6),
  el('dirt', 'Dirt', 'solid', 0x6e4a2e, 4),
  el('clay', 'Clay', 'solid', 0xb0705a, 4),
  el('salt', 'Salt', 'solid', 0xe8e4dc, 4),
  el('snow', 'Snow', 'solid', 0xe2ecfa, 4),
  el('coal', 'Coal', 'solid', 0x2a2a30, 5),
  el('crystal', 'Crystal', 'solid', 0x9fe8f0, 7),
  el('gold', 'Gold', 'solid', 0xffcf4a, 8),
  el('bone', 'Bone', 'solid', 0xe6dcc4, 4),
  el('fungus', 'Fungus', 'solid', 0xc87ad8, 5),
  el('seeds', 'Seeds', 'solid', 0xa08a4a, 4),
  el('thermite', 'Thermite', 'solid', 0x8a3a3a, 8),
  el('quicksand', 'Quicksand', 'solid', 0xd0a860, 5),
  el('steam', 'Steam', 'made', 0xc8d0dc, 4),
  el('smoke', 'Smoke', 'made', 0x4a4a56, 3),
  el('ice', 'Ice', 'made', 0xa8dcf0, 5),
  el('obsidian', 'Obsidian', 'made', 0x2e2040, 9),
  el('glass', 'Glass', 'made', 0xcfe8ef, 5),
  el('rubble', 'Rubble', 'made', 0x6a6474, 4),
  el('molten', 'Molten metal', 'made', 0xffd27a, 7),
  el('plants', 'Plants and wood', 'made', 0x4fae4a, 5),
  el('rot', 'Rot and miasma', 'made', 0x7a8a3a, 5),
  el('mud', 'Mud', 'made', 0x6a4e36, 4),
  el('spores', 'Spores', 'made', 0xc8b88a, 5),
  el('plasma', 'Plasma', 'made', 0xff9aff, 9),
  el('brick', 'Brick', 'made', 0xa0523a, 6),
  el('ash', 'Ash', 'made', 0x8a8a90, 3),
  el('ectoplasm', 'Ectoplasm', 'made', 0x9affd8, 6),
  el('amber', 'Amber', 'made', 0xe0901a, 7),
]
export const elementInfo = (id: ElementId) => ELEMENTS.find((e) => e.id === id)!

export type CastType = 'instant' | 'charged' | 'channeled' | 'burst' | 'continuous'
export type ShapeId = 'projectile' | 'beam' | 'aoe' | 'rune' | 'self' | 'target' | 'summon' | 'orbit' | 'wave' | 'cone' | 'enchant'
export type TriggerKind = 'impact' | 'delay' | 'near' | 'recast'

export const SHAPES: { id: ShapeId; name: string; types: CastType[]; cost: number; perSecond?: number }[] = [
  { id: 'projectile', name: 'Projectile', types: ['instant', 'charged', 'burst', 'continuous'], cost: 1 },
  { id: 'beam', name: 'Beam', types: ['channeled'], cost: 1, perSecond: 3 },
  { id: 'aoe', name: 'AoE', types: ['instant', 'charged'], cost: 2 },
  { id: 'rune', name: 'Rune', types: ['instant', 'charged'], cost: 1.5 },
  { id: 'self', name: 'Self', types: ['instant', 'channeled'], cost: 1.5, perSecond: 2 },
  { id: 'target', name: 'Target', types: ['instant', 'charged', 'channeled'], cost: 1.2, perSecond: 2 },
  { id: 'summon', name: 'Summon', types: ['instant', 'charged'], cost: 3 },
  { id: 'orbit', name: 'Orbit', types: ['instant', 'charged'], cost: 2.5 },
  { id: 'wave', name: 'Wave', types: ['instant', 'charged', 'channeled'], cost: 2.5, perSecond: 2.5 },
  { id: 'cone', name: 'Cone', types: ['instant', 'charged', 'channeled', 'continuous'], cost: 1.2, perSecond: 3 },
  { id: 'enchant', name: 'Weapon enchantment', types: [], cost: 1 }, // waits for weapons (#33)
]
export const shapeInfo = (id: ShapeId) => SHAPES.find((s) => s.id === id)!

export const CAST_TYPES: { id: CastType; name: string }[] = [
  { id: 'instant', name: 'Instant' },
  { id: 'charged', name: 'Charged' },
  { id: 'channeled', name: 'Channeled' },
  { id: 'burst', name: 'Burst' },
  { id: 'continuous', name: 'Continuous' },
]

export const TRIGGERS: { id: TriggerKind; name: string }[] = [
  { id: 'impact', name: 'On impact' },
  { id: 'delay', name: 'After a delay' },
  { id: 'near', name: 'When something comes near' },
  { id: 'recast', name: 'On recast' },
]
/** Shapes a trigger can set off from where the first spell got to. */
export const FOLLOW_UP_SHAPES: ShapeId[] = ['projectile', 'aoe', 'rune', 'wave', 'summon', 'cone']

export interface FollowUp {
  elements: ElementId[]
  shape: ShapeId
}
export interface Spell {
  elements: ElementId[] // one or more; the world decides what mixing them does (#19)
  shape: ShapeId
  cast: CastType
  trigger?: { kind: TriggerKind; then: FollowUp }
}

/** Elements a spell can mix, from the catalyst (#27). The stand-in catalyst holds two. */
export const STAND_IN_CAPACITY = 2

/** A spell's mana for one cast at a given strength (charged spells scale), follow-up included. */
export function castCost(spell: Spell, strength = 1): number {
  const els = spell.elements.reduce((n, e) => n + elementInfo(e).cost, 0)
  const scale = Math.max(0.5, strength)
  let cost = els * shapeInfo(spell.shape).cost * scale
  if (spell.cast === 'burst') cost *= 0.6 // each of the three shots
  if (spell.cast === 'continuous') cost *= 0.5 // each shot
  return cost + followUpCost(spell)
}

/** The follow-up's mana: part of each cast, or paid when a held spell is let go. */
export function followUpCost(spell: Spell): number {
  if (!spell.trigger) return 0
  return spell.trigger.then.elements.reduce((n, e) => n + elementInfo(e).cost, 0) * shapeInfo(spell.trigger.then.shape).cost
}

/** Mana a second for channelled spells. */
export function channelCost(spell: Spell): number {
  const els = spell.elements.reduce((n, e) => n + elementInfo(e).cost, 0)
  return els * (shapeInfo(spell.shape).perSecond ?? 2)
}

/** Toggles an element in or out; at capacity, a new one replaces the oldest. A spell keeps at least one. */
export function toggleElement(spell: Spell, el: ElementId, capacity = STAND_IN_CAPACITY): Spell {
  if (spell.elements.includes(el)) {
    return spell.elements.length > 1 ? { ...spell, elements: spell.elements.filter((e) => e !== el) } : spell
  }
  const elements = [...spell.elements, el]
  return { ...spell, elements: elements.length > capacity ? elements.slice(elements.length - capacity) : elements }
}

/** Sets or clears a trigger. A new trigger's follow-up starts as the same elements in an AoE. */
export function withTrigger(spell: Spell, kind: TriggerKind | null): Spell {
  if (!kind) { const rest = { ...spell }; delete rest.trigger; return rest }
  return { ...spell, trigger: { kind, then: spell.trigger?.then ?? { elements: [...spell.elements], shape: 'aoe' } } }
}

export function withFollowUp(spell: Spell, then: FollowUp): Spell {
  return spell.trigger ? { ...spell, trigger: { ...spell.trigger, then } } : spell
}

/** Changes the shape, keeping the casting type if the new shape allows it, otherwise its first type. */
export function withShape(spell: Spell, shape: ShapeId): Spell {
  const types = shapeInfo(shape).types
  if (!types.length) return spell
  return { ...spell, shape, cast: types.includes(spell.cast) ? spell.cast : types[0] }
}

export const SHAPE_HELP: Record<ShapeId, string> = {
  projectile: 'A bolt that arcs from the catalyst and bursts its elements where it hits.',
  beam: 'A held line to the first thing it meets; forces act where it lands, Force drills, substances pour out.',
  aoe: 'A disc of its elements at the aimed point.',
  rune: 'Placed on the first surface you aim at; goes off when something comes near (you, once you\'ve left it).',
  self: 'On you: Force launches you (held, you fly), Life heals, held Cold freezes water underfoot, the rest ring around you.',
  target: 'Straight onto the aimed point or the first thing in the way: small and precise.',
  summon: 'A stand-in wisp at the aimed point that drifts after targets giving off its elements; a Life wisp follows and heals you.',
  orbit: 'Motes circle you and burst on the first thing they touch.',
  wave: 'A ring spreading out from you, acting on everything its edge crosses.',
  cone: 'A spray from the catalyst; substances land where the spray stops.',
  enchant: 'Enchants a weapon. There are no weapons yet.',
}
export const TRIGGER_HELP: Record<TriggerKind, string> = {
  impact: 'When it hits something (for instant shapes, straight away where they land).',
  delay: 'A second after casting, wherever the spell has got to.',
  near: 'When something comes near: a creature, or you once you\'ve moved away.',
  recast: 'When you cast this slot again (that press doesn\'t cast it anew).',
}
export const CAST_HELP: Record<CastType, string> = {
  instant: 'Casts once, the moment you press.',
  charged: 'Hold to build it up (up to 1.2 s), release to cast: bigger the longer you held.',
  channeled: 'Keeps going while you hold, costing mana a second.',
  burst: 'Three quick shots from one press.',
  continuous: 'Keeps firing shots while you hold.',
}

export function isValid(spell: Spell): boolean {
  return spell.elements.length > 0 && spell.elements.length <= STAND_IN_CAPACITY && shapeInfo(spell.shape).types.includes(spell.cast)
}

export class Mana {
  max = 100
  value = 100
  regen = 12 // a second (#22: one pool that refills over time), but not while casting (#83)
  infinite = false

  spend(n: number): boolean {
    if (this.infinite) return true
    if (this.value < n) return false
    this.value -= n
    return true
  }

  /** Refills over time, except while casting (holding cast, charging, channelling, a burst going). */
  update(dt: number, casting = false): void {
    if (casting) return
    this.value = Math.min(this.max, this.value + this.regen * dt)
  }
}
