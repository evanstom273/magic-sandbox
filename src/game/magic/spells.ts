import type { ElementId } from '../world/elements.ts'

// The spell model (#17, #29–#32, #80): a spell is elements + a shape + a casting type, with an
// optional trigger that sets off a follow-up spell (its own elements and shape).

export const ELEMENTS: { id: ElementId; name: string; colour: number; cost: number }[] = [
  { id: 'water', name: 'Water', colour: 0x3a86ee, cost: 4 },
  { id: 'sand', name: 'Sand', colour: 0xe0bf6e, cost: 4 },
  { id: 'heat', name: 'Heat', colour: 0xff8a2a, cost: 5 },
  { id: 'cold', name: 'Cold', colour: 0xbfeaff, cost: 5 },
  { id: 'force', name: 'Force', colour: 0xd6d6e6, cost: 5 },
  { id: 'life', name: 'Life', colour: 0x4fdc6a, cost: 7 },
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
  if (spell.trigger) cost += spell.trigger.then.elements.reduce((n, e) => n + elementInfo(e).cost, 0) * shapeInfo(spell.trigger.then.shape).cost
  return cost
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
