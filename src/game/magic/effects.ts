import { applyDisc, applyToCell, FIELD_FORCES, mix, push, SUBSTANCE, type ElementId } from '../world/elements.ts'
import { boxHits } from '../player/movement.ts'
import { CellGrid, Kind, KIND, Material as M } from '../world/grid.ts'
import { electrify } from '../world/reactions.ts'
import type { CastEvent } from './caster.ts'
import { elementInfo, sizeOf, type FollowUp, type Spell, type TriggerKind } from './spells.ts'

// What spells do once cast: each shape delivers its elements into the world and onto creatures.
// The world's own rules (simulate.ts) take it from there (#16, #19).

/** Anything magic can heal or shove: the player now; creatures later. */
export interface Body {
  x: number // centre
  y: number // feet
  w: number
  h: number
  isCaster: boolean
  heal(n: number): void
  impulse(vx: number, vy: number): void // a shove, in cells a second
  thrust(ax: number, ay: number, dt: number): void // a sustained push (flying)
  affect?(el: ElementId): void // other elements touching it (freezing, scorching, wetting)
  hurt?(n: number): void // magic that eats cells (Void, Decay)
  moveTo?(x: number, y: number): void // a blink
}

/**
 * A field a spell leaves where it lands, for a while: a gravity well, a magnet, or a bubble of
 * slowed or sped-up time. The simulation honours them (grid.fields); wells pull bodies in too.
 */
export interface Zone { kind: 'pull' | 'magnet' | 'slow' | 'fast' | 'light' | 'dark'; x: number; y: number; r: number; life: number; max: number; owner?: Body }
/** A lightning bolt as drawn: a jagged line, briefly. */
export interface Bolt { pts: number[]; life: number; max: number }

/** A trigger waiting to set off its follow-up spell (#17, #32), riding on something or sitting at a point. */
export interface Trig {
  kind: TriggerKind
  then: FollowUp
  slot: number // the hotbar slot it came from, for recasting
  dir: { x: number; y: number }
  strength: number
  caster: Body
  age: number
  armed: boolean // for "when something comes near": the caster only counts once it has moved away
  size?: number // the spell's size, which its follow-up takes too
}
export interface Anchor extends Trig { x: number; y: number }

export interface Projectile { x: number; y: number; vx: number; vy: number; els: ElementId[]; strength: number; age: number; trig?: Trig; size?: number }
export interface Spark { x: number; y: number; vx: number; vy: number; life: number; max: number; colour: number }
export interface Flash { x: number; y: number; r: number; life: number; max: number; colour: number }
export interface Beam { x0: number; y0: number; x1: number; y1: number; colour: number }
export interface Rune { x: number; y: number; els: ElementId[]; strength: number; armed: boolean; age: number; trig?: Trig; size?: number }
export interface Wisp { x: number; y: number; vx: number; vy: number; els: ElementId[]; strength: number; life: number; tick: number; home: { x: number; y: number }; trig?: Trig; size?: number }
export interface Mote { angle: number; els: ElementId[]; strength: number; life: number; x: number; y: number; trig?: Trig; size?: number }
export interface Wave { x: number; y: number; r: number; max: number; els: ElementId[]; strength: number; hit: Set<Body> }
/** Time in a bubble: slowed to about a third, or sped up by half again (for bodies; the world inside goes by its own rules). */
export const SLOW_TIME = 0.35
export const FAST_TIME = 1.6
const MAX_ZONES = 16
const BLINK = 40 // the furthest a Void blink goes, in cells

const MAX_RUNES = 6
const RUNE_REACH = 12
export const TRIGGER_DELAY = 1 // seconds, for "after a delay"
const NEAR_REACH = 12 // cells, for "when something comes near"
const ANCHOR_WAIT = 20 // seconds a "near" or "recast" trigger waits before it gives up

const rnd = Math.random
const RANGE = 95 // the furthest an aimed spell (AoE, Target, Rune) lands from the caster

export class Magic {
  readonly grid: CellGrid
  readonly projectiles: Projectile[] = []
  readonly sparks: Spark[] = []
  readonly flashes: Flash[] = []
  readonly beams: Beam[] = [] // drawn this frame
  readonly runes: Rune[] = []
  readonly wisps: Wisp[] = []
  readonly motes: Mote[] = []
  readonly waves: Wave[] = []
  readonly anchors: Anchor[] = []
  readonly zones: Zone[] = []
  readonly ripples: Flash[] = [] // Sound's shockwaves, drawn as rings spreading out
  readonly bolts: Bolt[] = []
  readonly charged: { p: number; life: number }[] = [] // cells lightning has just run through
  private beamEnds = new Map<number, { x: number; y: number; dir: { x: number; y: number } }>()
  private beamSlot = -1
  bodies: Body[] = []

  constructor(grid: CellGrid) {
    this.grid = grid
  }

  /**
   * One cast of a spell, from the catalyst's tip towards the aim point. `slot` is the hotbar slot (for
   * recasting); `origin` is set for a trigger's follow-up, which comes from where its trigger went off.
   */
  cast(spell: Spell, ev: CastEvent, tip: { x: number; y: number }, aim: { x: number; y: number }, caster: Body, opts: { slot?: number; origin?: { x: number; y: number } } = {}): void {
    const dx = aim.x - tip.x, dy = aim.y - tip.y
    const len = Math.hypot(dx, dy) || 1
    const dir = { x: dx / len, y: dy / len }
    const els = mix(spell.elements)
    const s = ev.strength
    const size = sizeOf(spell) // how big (#88): every shape's reach scales with it; the cost doesn't
    if (!els.length) {
      // Everything cancelled out (Life and Decay): a fizzle.
      this.flashes.push({ x: tip.x, y: tip.y, r: 3, life: 0.2, max: 0.2, colour: 0x8a8aa0 })
      return
    }
    const origin = opts.origin
    const counts = { p: this.projectiles.length, r: this.runes.length, w: this.wisps.length, m: this.motes.length }
    switch (spell.shape) {
      case 'projectile': {
        const spread = spell.cast === 'burst' || spell.cast === 'continuous' ? (rnd() - 0.5) * 0.12 : 0
        const a = Math.atan2(dir.y, dir.x) + spread
        const speed = 150 + 50 * Math.min(1.6, s)
        this.projectiles.push({ x: tip.x, y: tip.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, els: [...els], strength: s, age: 0, size })
        break
      }
      case 'cone': this.cone(els, tip, dir, s, ev, size); break
      case 'aoe': {
        const p = origin ?? this.clampToRange(caster, aim)
        const r = (5 + 5 * s) * size
        this.hit(els, p.x, p.y, r, 0.6 * s, false)
        this.flashes.push({ x: p.x, y: p.y, r, life: 0.3, max: 0.3, colour: elementInfo(els[0]).colour })
        break
      }
      case 'self': this.self(els, caster, dir, s, ev, size); break
      case 'beam': this.beamSlot = opts.slot ?? -1; this.beam(els, tip, dir, caster, ev.dt, size); break
      case 'rune': {
        const p = origin ? this.firstSurface(origin, { x: origin.x + dir.x * 30, y: origin.y + dir.y * 30 + 30 }) : this.firstSurface(tip, aim)
        this.runes.push({ x: p.x, y: p.y, els: [...els], strength: s, armed: false, age: 0, size })
        if (this.runes.length > MAX_RUNES) this.runes.shift()
        break
      }
      case 'target': this.target(els, caster, aim, s, ev, size); break
      case 'summon': {
        const p = origin ?? this.clampToRange(caster, aim)
        this.wisps.push({ x: p.x, y: p.y, vx: 0, vy: 0, els: [...els], strength: s, life: 6 + 4 * s, tick: 0.3, home: { x: p.x, y: p.y }, size })
        break
      }
      case 'orbit': {
        const n = Math.round(4 + 2 * s)
        for (let i = 0; i < n; i++) this.motes.push({ angle: (i / n) * Math.PI * 2, els: [...els], strength: s, life: 12, x: caster.x, y: caster.y, size })
        break
      }
      case 'wave': {
        const o = origin ?? { x: caster.x, y: caster.y - caster.h / 2 }
        this.waves.push({ x: o.x, y: o.y, r: 4, max: (ev.sustained ? 26 : 22 + 22 * s) * size, els: [...els], strength: ev.sustained ? 0.8 : s, hit: new Set([caster]) })
        break
      }
      default: break
    }

    // A trigger rides on what the spell made (bolts, runes, wisps, motes), or waits where it landed.
    // Held spells set theirs when they're let go (see channelEnded).
    if (!spell.trigger || ev.sustained) return
    const trig = (): Trig => ({ kind: spell.trigger!.kind, then: spell.trigger!.then, slot: opts.slot ?? -1, dir, strength: s, caster, age: 0, armed: false, size })
    if (spell.shape === 'projectile') for (const p of this.projectiles.slice(counts.p)) p.trig = trig()
    else if (spell.shape === 'rune') { const r = this.runes.at(-1); if (r && this.runes.length >= counts.r) r.trig = trig() }
    else if (spell.shape === 'summon') for (const w of this.wisps.slice(counts.w)) w.trig = trig()
    else if (spell.shape === 'orbit') for (const m of this.motes.slice(counts.m)) m.trig = trig()
    else this.anchor(trig(), this.landing(spell, tip, dir, aim, caster, origin))
  }

  /** Where an instantaneous shape's effect was centred: where its trigger waits. */
  private landing(spell: Spell, tip: { x: number; y: number }, dir: { x: number; y: number }, aim: { x: number; y: number }, caster: Body, origin?: { x: number; y: number }): { x: number; y: number } {
    const centre = { x: caster.x, y: caster.y - caster.h / 2 }
    switch (spell.shape) {
      case 'aoe': return origin ?? this.clampToRange(caster, aim)
      case 'target': return this.firstSurface(centre, this.clampToRange(caster, aim))
      case 'self': return centre
      case 'wave': return origin ?? centre
      case 'cone': return this.firstSurface(tip, { x: tip.x + dir.x * 36, y: tip.y + dir.y * 36 })
      case 'beam': return this.beamEnds.get(-1) ?? tip
      default: return tip
    }
  }

  private anchor(t: Trig, at: { x: number; y: number }): void {
    if (t.kind === 'impact') this.fire(t, at.x, at.y)
    else this.anchors.push({ ...t, x: at.x, y: at.y })
  }

  /** A held spell was let go: its trigger (if any) waits at where it ended. */
  channelEnded(spell: Spell, slot: number, tip: { x: number; y: number }, aim: { x: number; y: number }, caster: Body): void {
    if (!spell.trigger) return
    const dx = aim.x - tip.x, dy = aim.y - tip.y, l = Math.hypot(dx, dy) || 1
    const dir = { x: dx / l, y: dy / l }
    const end = spell.shape === 'beam' ? this.beamEnds.get(slot) ?? this.beamEnds.get(-1) ?? tip : this.landing(spell, tip, dir, aim, caster)
    this.anchor({ kind: spell.trigger.kind, then: spell.trigger.then, slot, dir, strength: 1, caster, age: 0, armed: false, size: sizeOf(spell) }, end)
  }

  /** Sets off a trigger's follow-up spell from a point. */
  private fire(t: Trig, x: number, y: number): void {
    const spell: Spell = { elements: t.then.elements, shape: t.then.shape, cast: 'instant', size: t.size }
    this.flashes.push({ x, y, r: 6, life: 0.2, max: 0.2, colour: 0xffffff })
    this.cast(spell, { strength: Math.max(0.6, Math.min(1.2, t.strength)), sustained: false, dt: 0 }, { x, y }, { x: x + t.dir.x * 40, y: y + t.dir.y * 40 }, t.caster, { origin: { x, y } })
  }

  /** Is something (the caster only once it has moved away) within reach of a trigger at (x, y)? */
  private somethingNear(t: Trig, x: number, y: number): boolean {
    const d = (b: Body) => Math.hypot(b.x - x, b.y - b.h / 2 - y) - b.h / 2
    if (!t.armed && d(t.caster) > NEAR_REACH + 2) t.armed = true
    return this.bodies.some((b) => d(b) < NEAR_REACH && (!b.isCaster || t.armed))
  }

  /** Does this slot have triggers waiting for a recast? */
  hasRecast(slot: number): boolean {
    const waits = (t?: Trig) => !!t && t.kind === 'recast' && t.slot === slot
    return this.anchors.some(waits) || this.projectiles.some((p) => waits(p.trig)) || this.runes.some((r) => waits(r.trig)) || this.wisps.some((w) => waits(w.trig)) || this.motes.some((m) => waits(m.trig))
  }

  /** Recasting a slot sets off everything of its waiting for a recast, instead of casting again. */
  recast(slot: number): void {
    const waits = (t?: Trig) => !!t && t.kind === 'recast' && t.slot === slot
    for (let i = this.anchors.length - 1; i >= 0; i--) if (waits(this.anchors[i])) { const a = this.anchors.splice(i, 1)[0]; this.fire(a, a.x, a.y) }
    for (const p of this.projectiles) if (waits(p.trig)) { this.fire(p.trig!, p.x, p.y); p.trig = undefined }
    for (let i = this.runes.length - 1; i >= 0; i--) if (waits(this.runes[i].trig)) this.setOff(i)
    for (const w of this.wisps) if (waits(w.trig)) { this.fire(w.trig!, w.x, w.y); w.trig = undefined }
    for (let i = this.motes.length - 1; i >= 0; i--) if (waits(this.motes[i].trig)) { const m = this.motes.splice(i, 1)[0]; this.fire(m.trig!, m.x, m.y) }
  }

  /** Triggers riding on bolts, wisps and motes, and anchors waiting at points. */
  private updateTriggers(dt: number): void {
    for (const p of this.projectiles) {
      const t = p.trig
      if (!t) continue
      t.age += dt
      if ((t.kind === 'delay' && t.age >= TRIGGER_DELAY) || (t.kind === 'near' && this.somethingNear(t, p.x, p.y))) { this.fire(t, p.x, p.y); p.trig = undefined }
    }
    for (const w of this.wisps) {
      const t = w.trig
      if (!t) continue
      t.age += dt
      const touching = t.kind === 'impact' && !!this.bodyAt(w.x, w.y, 3)
      if (touching || (t.kind === 'delay' && t.age >= TRIGGER_DELAY) || (t.kind === 'near' && this.somethingNear(t, w.x, w.y))) { this.fire(t, w.x, w.y); w.trig = undefined }
    }
    for (let i = this.motes.length - 1; i >= 0; i--) {
      const m = this.motes[i], t = m.trig
      if (!t) continue
      t.age += dt
      if ((t.kind === 'delay' && t.age >= TRIGGER_DELAY) || (t.kind === 'near' && this.somethingNear(t, m.x, m.y))) { this.motes.splice(i, 1); this.fire(t, m.x, m.y) }
    }
    for (let i = this.anchors.length - 1; i >= 0; i--) {
      const a = this.anchors[i]
      a.age += dt
      const go = (a.kind === 'delay' && a.age >= TRIGGER_DELAY) || (a.kind === 'near' && this.somethingNear(a, a.x, a.y))
      if (go) { this.anchors.splice(i, 1); this.fire(a, a.x, a.y) }
      else if (a.age > ANCHOR_WAIT) this.anchors.splice(i, 1)
    }
  }

  /** Where a straight line from the tip towards the aim first meets something solid (within range). */
  private firstSurface(tip: { x: number; y: number }, aim: { x: number; y: number }): { x: number; y: number } {
    const dx = aim.x - tip.x, dy = aim.y - tip.y, d = Math.min(RANGE, Math.hypot(dx, dy)) || 1
    const ux = dx / (Math.hypot(dx, dy) || 1), uy = dy / (Math.hypot(dx, dy) || 1)
    let x = tip.x, y = tip.y
    for (let t = 0; t <= d; t += 0.5) {
      const nx = tip.x + ux * t, ny = tip.y + uy * t
      if (this.blocks(nx, ny)) break
      x = nx; y = ny
    }
    return { x, y }
  }

  private blocks(x: number, y: number): boolean {
    const m = this.grid.get(Math.floor(x), Math.floor(y)), k = KIND[m]
    return !this.grid.inside(Math.floor(x), Math.floor(y)) || !(m === M.EMPTY || k === Kind.GAS || k === Kind.FIRE || k === Kind.PLANT)
  }

  private bodyAt(x: number, y: number, pad = 0, includeCaster = false): Body | undefined {
    return this.bodies.find((b) => (includeCaster || !b.isCaster) && Math.abs(b.x - x) < b.w / 2 + pad && y > b.y - b.h - pad && y < b.y + pad)
  }

  /** A held line from the catalyst to the first thing it meets. */
  private beam(els: readonly ElementId[], tip: { x: number; y: number }, dir: { x: number; y: number }, caster: Body, dt: number, size = 1): void {
    let x = tip.x, y = tip.y, hitBody: Body | undefined
    for (let t = 0; t < 110; t += 0.5) {
      const nx = tip.x + dir.x * t, ny = tip.y + dir.y * t
      hitBody = this.bodyAt(nx, ny)
      if (hitBody || this.blocks(nx, ny)) { x = nx; y = ny; break }
      x = nx; y = ny
      // Forces touch what the beam passes through, lightly.
      if (Math.random() < 0.04) for (const el of els) if (el === 'heat' || el === 'cold') applyToCell(this.grid, el, Math.floor(nx), Math.floor(ny), true)
    }
    const end = { x: x + dir.x, y: y + dir.y }
    for (const el of els) {
      if (el === 'force') push(this.grid, end.x, end.y, 3 * size, 0.9, end.x, end.y, dir.x, dir.y) // a drill
      else if (SUBSTANCE[el] !== undefined) {
        // Poured out at the end, in a spray as wide as the beam.
        for (let i = 0; i < Math.round(70 * dt * size + Math.random()); i++) {
          const a = rnd() * Math.PI * 2, d = rnd() * (size - 1) * 1.5
          applyToCell(this.grid, el, Math.floor(x - dir.x * (1 + Math.random() * 2) + Math.cos(a) * d), Math.floor(y - dir.y * (1 + Math.random() * 2) + Math.sin(a) * d))
        }
      } else applyDisc(this.grid, [el], end.x, end.y, 2.5 * size, 1, true)
    }
    this.fields(els, end.x, end.y, 4 * size, true, caster)
    if (els.includes('light') && rnd() < 0.06) applyToCell(this.grid, 'heat', Math.floor(end.x), Math.floor(end.y)) // a held beam of Light warms what it hits
    if (hitBody) { this.touchBody(hitBody, els, dir.x * 600 * dt, dir.y * 600 * dt, 14 * dt); this.eat(hitBody, els, true, dt) }
    this.beams.push({ x0: tip.x, y0: tip.y, x1: x, y1: y, colour: elementInfo(els[0]).colour })
    this.beamEnds.set(this.beamSlot, { x, y, dir })
    if (Math.random() < 0.5) this.spark(x, y, els, 25)
  }

  /** Straight onto the aimed point (or the first thing in the way), small and precise. */
  private target(els: readonly ElementId[], caster: Body, aim: { x: number; y: number }, s: number, ev: CastEvent, size = 1): void {
    const from = { x: caster.x, y: caster.y - caster.h / 2 }
    const p = this.firstSurface(from, this.clampToRange(caster, aim))
    const body = this.bodyAt(p.x, p.y, 4)
    if (body) {
      this.touchBody(body, els, 0, ev.sustained ? -300 * ev.dt : -60 * s, ev.sustained ? 14 * ev.dt : 10 * s)
      if (els.includes('force')) body.impulse(0, ev.sustained ? -500 * ev.dt : -150 * s)
    }
    applyDisc(this.grid, els.filter((e) => e !== 'force'), p.x, p.y, (2.5 + 1.5 * s) * size, 1, ev.sustained)
    if (els.includes('force')) push(this.grid, p.x, p.y, (3 + s) * size, 0.8 * s)
    this.fields(els, p.x, p.y, (3 + 3 * s) * size, ev.sustained, caster)
    if (body) this.eat(body, els, ev.sustained, ev.dt)
    if (!ev.sustained || Math.random() < 0.2) this.flashes.push({ x: p.x, y: p.y, r: 4 * size, life: 0.18, max: 0.18, colour: elementInfo(els[0]).colour })
  }

  /**
   * Forces that work as a field where a spell lands, sized by the spell's reach `r`: Gravity leaves
   * a well, Magnetism a magnet, Time a bubble (slowed; sped up if mixed with Life); Sound spreads a
   * ring. Held spells keep theirs going while they're held.
   */
  private fields(els: readonly ElementId[], x: number, y: number, r: number, sustained: boolean, owner?: Body): void {
    const life = (n: number) => (sustained ? 0.3 : n)
    if (els.includes('gravity')) this.zone('pull', x, y, r + 5, life(2 + r / 4), owner)
    if (els.includes('magnetism')) this.zone('magnet', x, y, r * 1.4 + 6, life(3 + r / 4), owner)
    if (els.includes('time')) this.zone(els.includes('life') ? 'fast' : 'slow', x, y, r + 6, life(5 + r / 3))
    if (els.includes('sound') && (!sustained || rnd() < 0.15)) this.ripples.push({ x, y, r: r * 1.6 + 6, life: 0.45, max: 0.45, colour: 0x9ad8c8 })
    if (els.includes('light')) this.zone('light', x, y, r + 14, life(14 + r))
    if (els.includes('shadow')) this.zone('dark', x, y, r + 6, life(10 + r / 2))
    if (els.includes('lightning') && (!sustained || rnd() < 0.12)) this.strike(x, y, Math.max(0.6, r / 8))
  }

  /**
   * Lightning: it runs through whatever conducts where it lands (a pool, a length of metal) and
   * sparks around it; anything touching the charge is shocked (wet dummies for longer; the caster
   * too, standing in the pool they struck). Crystal splits it into several arcs.
   */
  private strike(x: number, y: number, s: number, depth = 0): void {
    const g = this.grid, W = g.width
    const { charged, crystals } = electrify(g, Math.floor(x), Math.floor(y), Math.round(500 * Math.min(1.6, s)))
    for (const p of charged) this.charged.push({ p, life: 0.25 })
    if (this.charged.length > 1500) this.charged.splice(0, this.charged.length - 1500)
    // Bolts out to a few of the charged cells (or just crackling, if there's nothing to run along).
    const ends = charged.length ? Array.from({ length: Math.min(5, charged.length) }, () => charged[(rnd() * charged.length) | 0]).map((p) => ({ x: (p % W) + 0.5, y: Math.floor(p / W) + 0.5 }))
      : Array.from({ length: 3 }, () => ({ x: x + (rnd() - 0.5) * 12, y: y + (rnd() - 0.5) * 12 }))
    for (const e of ends) this.bolts.push({ pts: jagged(x, y, e.x, e.y), life: 0.18, max: 0.18 })
    this.flashes.push({ x, y, r: 5, life: 0.15, max: 0.15, colour: 0xfff27a })
    const hot = new Set(charged)
    for (const b of this.bodies) {
      let shocked = Math.hypot(b.x - x, b.y - b.h / 2 - y) < 5
      for (let cy = Math.floor(b.y - b.h) - 1; !shocked && cy <= Math.floor(b.y); cy++) {
        for (let cx = Math.floor(b.x - b.w / 2) - 1; cx <= Math.ceil(b.x + b.w / 2); cx++) if (hot.has(cy * W + cx)) { shocked = true; break }
      }
      if (!shocked) continue
      b.affect?.('lightning')
      b.hurt?.(10 * s)
    }
    // Crystal splits the arc into several, out in all directions.
    if (depth > 0) return
    for (const c of crystals.slice(0, 3)) {
      const cx = (c % W) + 0.5, cy = Math.floor(c / W) + 0.5
      for (let k = 0; k < 3; k++) {
        const a = rnd() * Math.PI * 2
        const end = this.firstSurface({ x: cx + Math.cos(a) * 2, y: cy + Math.sin(a) * 2 }, { x: cx + Math.cos(a) * 18, y: cy + Math.sin(a) * 18 })
        this.bolts.push({ pts: jagged(cx, cy, end.x, end.y), life: 0.2, max: 0.2 })
        this.strike(end.x, end.y, s * 0.6, depth + 1)
      }
    }
  }

  /** A field at (x, y), or an existing one of its kind near there kept going (held spells, wisps). */
  private zone(kind: Zone['kind'], x: number, y: number, r: number, life: number, owner?: Body): void {
    const z = this.zones.find((z) => z.kind === kind && Math.hypot(z.x - x, z.y - y) < Math.max(4, z.r * 0.4))
    if (z) { z.x = x; z.y = y; z.r = Math.max(z.r, r); z.life = Math.max(z.life, life); z.max = Math.max(z.max, z.life); return }
    this.zones.push({ kind, x, y, r, life, max: life, owner })
    if (this.zones.length > MAX_ZONES) this.zones.shift()
  }

  /** How fast time goes for a body at (x, y): slowed or sped up in a time bubble. */
  timeScaleAt(x: number, y: number): number {
    for (const z of this.zones) {
      if ((z.kind === 'slow' || z.kind === 'fast') && Math.hypot(z.x - x, z.y - y) < z.r) return z.kind === 'slow' ? SLOW_TIME : FAST_TIME
    }
    return 1
  }

  /** Void eats a body's cells, the caster's included if they're careless; Decay rots them a little. */
  private eat(b: Body, els: readonly ElementId[], sustained: boolean, dt: number): void {
    if (els.includes('void')) b.hurt?.(sustained ? 30 * dt : 20)
    if (els.includes('decay') && !b.isCaster) b.hurt?.(sustained ? 8 * dt : 6)
  }

  /** Fields wear off; the rest are handed to the simulation, and wells pull bodies in (not whoever made them). */
  private updateZones(dt: number): void {
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i]
      z.life -= dt
      if (z.life <= 0) this.zones.splice(i, 1)
    }
    const g = this.grid
    g.field.fill(0)
    const sim = this.zones.filter((z) => z.kind !== 'light' && z.kind !== 'dark')
    g.fields = sim.map((z) => ({ kind: z.kind as 'pull', x: z.x, y: z.y, r: z.r }))
    sim.forEach((z, i) => {
      for (let y = Math.max(0, Math.floor(z.y - z.r)); y <= Math.min(g.height - 1, Math.ceil(z.y + z.r)); y++) {
        for (let x = Math.max(0, Math.floor(z.x - z.r)); x <= Math.min(g.width - 1, Math.ceil(z.x + z.r)); x++) {
          if ((x + 0.5 - z.x) ** 2 + (y + 0.5 - z.y) ** 2 <= z.r * z.r) g.field[y * g.width + x] = i + 1
        }
      }
    })
    for (const z of this.zones) {
      if (z.kind !== 'pull') continue
      for (const b of this.bodies) {
        if (b === z.owner) continue
        const dx = z.x - b.x, dy = z.y - (b.y - b.h / 2), d = Math.hypot(dx, dy)
        if (d > z.r + 4 || d < 1.5) continue
        b.thrust((dx / d) * 500, (dy / d) * 500 - 420, dt)
      }
    }
  }

  /** Void cast on yourself: a blink along the aim, to the furthest spot you fit before anything solid. */
  private blink(me: Body, dir: { x: number; y: number }, s: number, size = 1): void {
    if (!me.moveTo) return
    const reach = BLINK * Math.min(1, 0.6 + 0.4 * s) * size
    let bx = me.x, by = me.y
    for (let t = 1; t <= reach; t++) {
      const x = me.x + dir.x * t, y = me.y + dir.y * t
      if (boxHits(this.grid.isSolid, x, y, me.w, me.h)) break
      bx = x; by = y
    }
    if (bx === me.x && by === me.y) return
    this.flashes.push({ x: me.x, y: me.y - me.h / 2, r: 9, life: 0.25, max: 0.25, colour: 0xc03aff })
    me.moveTo(bx, by)
    this.flashes.push({ x: bx, y: by - me.h / 2, r: 9, life: 0.3, max: 0.3, colour: 0xc03aff })
  }

  /** Elements meeting one body: life heals, force shoves, the rest affect it. */
  private touchBody(b: Body, els: readonly ElementId[], pushX: number, pushY: number, healAmount: number): void {
    for (const el of els) {
      if (el === 'life') b.heal(healAmount)
      else if (el === 'force') { if (!b.isCaster) b.impulse(pushX, pushY) }
      else b.affect?.(el)
    }
  }

  /** Elements over a disc, on the world and on any bodies inside it. Force pushes away from the centre. */
  hit(els: readonly ElementId[], cx: number, cy: number, r: number, forceStrength: number, sustained: boolean, dt = 0): void {
    if (!els.length) return
    applyDisc(this.grid, els.filter((e) => e !== 'force'), cx, cy, r, 1, sustained)
    if (els.includes('force')) push(this.grid, cx, cy, r, Math.min(1, forceStrength))
    this.fields(els, cx, cy, r, sustained)
    for (const b of this.bodies) {
      const bx = b.x, by = b.y - b.h / 2
      if (Math.hypot(bx - cx, by - cy) > r + Math.max(b.w, b.h) / 2) continue
      this.eat(b, els, sustained, dt)
      if (els.includes('life')) b.heal(sustained ? 14 * dt : 10 * forceStrength / 0.6)
      if (els.includes('force') && !b.isCaster) {
        const ax = bx - cx, ay = by - cy, l = Math.hypot(ax, ay) || 1
        b.impulse((ax / l) * 160 * forceStrength, (ay / l) * 160 * forceStrength - 40)
      }
      for (const el of els) if (el !== 'life' && el !== 'force') b.affect?.(el)
    }
    for (let i = 0; i < (sustained ? 1 : 10); i++) this.spark(cx, cy, els, 30 + rnd() * 50)
  }

  private cone(els: readonly ElementId[], tip: { x: number; y: number }, dir: { x: number; y: number }, s: number, ev: CastEvent, size = 1): void {
    const g = this.grid
    const rays = ev.sustained ? Math.max(1, Math.round(160 * ev.dt * size + rnd())) : Math.round(40 * s * size)
    const half = 0.32 + 0.08 * Math.min(1, s - 1 > 0 ? s - 1 : 0)
    const length = (30 + 18 * Math.min(1.6, s)) * size
    const base = Math.atan2(dir.y, dir.x)
    for (let i = 0; i < rays; i++) {
      const a = base + (rnd() * 2 - 1) * half
      const cx = Math.cos(a), cy = Math.sin(a)
      const reach = length * (0.35 + rnd() * 0.65)
      let lastFree = -1, lx = 0, ly = 0
      for (let d = 2; d < reach; d += 0.9) {
        const x = Math.floor(tip.x + cx * d), y = Math.floor(tip.y + cy * d)
        const m = g.get(x, y), k = KIND[m]
        const open = m === M.EMPTY || k === Kind.GAS || k === Kind.FIRE
        if (!open) {
          for (const el of els) if (SUBSTANCE[el] === undefined && el !== 'force') applyToCell(g, el, x, y, ev.sustained)
          if (els.includes('force')) push(g, x, y, 1.5, 0.5 * s, x, y, cx, cy)
          break
        }
        lastFree = 1; lx = x; ly = y
        if (rnd() < 0.08) for (const el of els) if (SUBSTANCE[el] === undefined && el !== 'force' && el !== 'life') applyToCell(g, el, x, y, ev.sustained)
      }
      if (lastFree > 0) for (const el of els) if (SUBSTANCE[el] !== undefined) applyToCell(g, el, lx, ly)
      if (rnd() < 0.5) this.sparks.push({ x: tip.x, y: tip.y, vx: cx * (60 + rnd() * 60), vy: cy * (60 + rnd() * 60), life: 0.25, max: 0.25, colour: elementInfo(els[(rnd() * els.length) | 0]).colour })
    }
    if (els.some((e) => FIELD_FORCES.includes(e) || e === 'sound')) {
      const end = this.firstSurface(tip, { x: tip.x + dir.x * length * 0.7, y: tip.y + dir.y * length * 0.7 })
      this.fields(els, end.x, end.y, (6 + 3 * s) * size, ev.sustained)
    }
    // Life in a cone heals whatever it washes over; force shoves it.
    for (const b of this.bodies) {
      if (b.isCaster) continue
      const bx = b.x - tip.x, by = b.y - b.h / 2 - tip.y
      const d = Math.hypot(bx, by)
      if (d > length || Math.abs(Math.atan2(by, bx) - base) > half + 0.2) continue
      if (els.includes('life')) b.heal(ev.sustained ? 14 * ev.dt : 6 * s)
      if (els.includes('force')) b.impulse(dir.x * (ev.sustained ? 600 * ev.dt : 120 * s), dir.y * (ev.sustained ? 600 * ev.dt : 120 * s))
    }
  }

  private self(els: readonly ElementId[], me: Body, dir: { x: number; y: number }, s: number, ev: CastEvent, size = 1): void {
    const cx = me.x, cy = me.y - me.h / 2
    this.fields(els, cx, cy, (6 + 4 * s) * size, ev.sustained, me)
    for (const el of els) {
      if (FIELD_FORCES.includes(el)) {
        if (el === 'gravity' && ev.sustained) me.thrust(0, -640, ev.dt) // held: float
        continue
      }
      if (el === 'void') { if (!ev.sustained) this.blink(me, dir, s, size); continue } // a blink, not a hole around you
      if (el === 'force') {
        if (ev.sustained) me.thrust(dir.x * 900, dir.y * 900, ev.dt) // levitate, fly
        else me.impulse(dir.x * 230 * s, dir.y * 230 * s) // a launch
      } else if (el === 'life') {
        me.heal(ev.sustained ? 14 * ev.dt : 18 * s)
      } else if (el === 'cold' && ev.sustained) {
        applyDisc(this.grid, ['cold'], me.x, me.y + 2, 7) // frost underfoot: walk on water
      } else {
        // A ring around the caster, clear of the body.
        const n = ev.sustained ? Math.round(60 * ev.dt * size + rnd()) : Math.round(70 * s * size)
        for (let i = 0; i < n; i++) {
          const a = rnd() * Math.PI * 2, r = 8 + rnd() * 4 * Math.max(0.5, size) // a wider ring for bigger spells, never closer in
          applyToCell(this.grid, el, Math.floor(cx + Math.cos(a) * r), Math.floor(cy + Math.sin(a) * r * 1.2), ev.sustained)
        }
      }
    }
    if (!ev.sustained || rnd() < 0.3) this.flashes.push({ x: cx, y: cy, r: 10 * size, life: 0.25, max: 0.25, colour: elementInfo(els[0]).colour })
  }

  private clampToRange(caster: Body, aim: { x: number; y: number }): { x: number; y: number } {
    const cx = caster.x, cy = caster.y - caster.h / 2
    const dx = aim.x - cx, dy = aim.y - cy, d = Math.hypot(dx, dy)
    return d <= RANGE ? aim : { x: cx + (dx / d) * RANGE, y: cy + (dy / d) * RANGE }
  }

  private spark(x: number, y: number, els: readonly ElementId[], speed: number): void {
    const a = rnd() * Math.PI * 2
    this.sparks.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: 0.35, max: 0.35, colour: elementInfo(els[(rnd() * els.length) | 0]).colour })
  }

  update(dt: number): void {
    const g = this.grid
    this.beams.length = 0
    this.updateRunes(dt)
    this.updateWisps(dt)
    this.updateMotes(dt)
    this.updateWaves(dt)
    this.updateTriggers(dt)
    this.updateZones(dt)
    for (let i = this.ripples.length - 1; i >= 0; i--) { this.ripples[i].life -= dt; if (this.ripples[i].life <= 0) this.ripples.splice(i, 1) }
    for (let i = this.bolts.length - 1; i >= 0; i--) { this.bolts[i].life -= dt; if (this.bolts[i].life <= 0) this.bolts.splice(i, 1) }
    for (const c of this.charged) c.life -= dt
    while (this.charged.length && this.charged[0].life <= 0) this.charged.shift()
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i]
      p.age += dt
      p.vy += 70 * dt
      const n = Math.max(1, Math.ceil(Math.hypot(p.vx, p.vy) * dt))
      let hit = p.age > 3
      for (let k = 0; k < n && !hit; k++) {
        const nx = p.x + (p.vx * dt) / n, ny = p.y + (p.vy * dt) / n
        const m = g.get(Math.floor(nx), Math.floor(ny)), kd = KIND[m]
        if (!g.inside(Math.floor(nx), Math.floor(ny)) || !(m === M.EMPTY || kd === Kind.GAS || kd === Kind.FIRE)) hit = true
        else if (this.bodies.some((b) => { const pad = ((p.size ?? 1) - 1) * 1.5; return !b.isCaster && Math.abs(b.x - nx) < b.w / 2 + pad && ny > b.y - b.h - pad && ny < b.y + pad })) hit = true
        else { p.x = nx; p.y = ny }
      }
      if (rnd() < 0.6) this.sparks.push({ x: p.x, y: p.y, vx: -p.vx * 0.1, vy: -p.vy * 0.1, life: 0.2, max: 0.2, colour: elementInfo(p.els[0]).colour })
      if (hit) {
        this.projectiles.splice(i, 1)
        const r = (4 + 4 * Math.min(1.6, p.strength)) * (p.size ?? 1)
        this.hit(p.els, p.x, p.y, r, 0.75 * p.strength, false)
        this.flashes.push({ x: p.x, y: p.y, r, life: 0.22, max: 0.22, colour: elementInfo(p.els[0]).colour })
        // Its trigger goes off here on impact; otherwise it keeps waiting where the bolt landed.
        if (p.trig) this.anchor(p.trig, { x: p.x - p.vx * 0.01, y: p.y - p.vy * 0.01 })
      }
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i]
      s.life -= dt
      if (s.life <= 0) { this.sparks.splice(i, 1); continue }
      s.x += s.vx * dt; s.y += s.vy * dt
      s.vx *= Math.exp(-4 * dt); s.vy *= Math.exp(-4 * dt)
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i]
      f.life -= dt
      if (f.life <= 0) this.flashes.splice(i, 1)
    }
  }

  /** Runes wait on their surface and go off when something comes near (the caster once it's left). */
  private updateRunes(dt: number): void {
    for (let i = this.runes.length - 1; i >= 0; i--) {
      const r = this.runes[i]
      r.age += dt
      const near = (b: Body) => Math.hypot(b.x - r.x, b.y - b.h / 2 - r.y) < RUNE_REACH + b.h / 2
      const caster = this.bodies.find((b) => b.isCaster)
      if (!r.armed && (!caster || !near(caster))) r.armed = true
      // A rune's trigger decides when it goes off: by default (and "on impact" or "near"), when
      // something comes near; "after a delay", a second after it's placed; "on recast", when recast.
      const kind = r.trig?.kind
      if (kind === 'recast') continue
      if (kind === 'delay') { if (r.age >= TRIGGER_DELAY) this.setOff(i); continue }
      if (this.bodies.some((b) => near(b) && (!b.isCaster || r.armed))) this.setOff(i)
    }
  }

  setOff(i: number): void {
    const r = this.runes[i]
    this.runes.splice(i, 1)
    const radius = (5 + 5 * r.strength) * (r.size ?? 1)
    this.hit(r.els, r.x, r.y, radius, 0.7 * r.strength, false)
    this.flashes.push({ x: r.x, y: r.y, r: radius, life: 0.3, max: 0.3, colour: elementInfo(r.els[0]).colour })
    if (r.trig) this.fire(r.trig, r.x, r.y - 2)
  }

  /** Summoned wisps (stand-ins): drift towards the nearest body that isn't the caster, giving off their elements. */
  private updateWisps(dt: number): void {
    for (let i = this.wisps.length - 1; i >= 0; i--) {
      const w = this.wisps[i]
      w.life -= dt
      if (w.life <= 0) {
        this.wisps.splice(i, 1)
        if (w.trig && (w.trig.kind === 'near' || w.trig.kind === 'recast')) this.anchors.push({ ...w.trig, x: w.x, y: w.y })
        continue
      }
      let tx = w.home.x + Math.sin(w.life * 1.7) * 6, ty = w.home.y + Math.cos(w.life * 2.3) * 3
      const prey = this.bodies.filter((b) => !b.isCaster && Math.hypot(b.x - w.x, b.y - w.y) < 70).sort((a, b) => Math.hypot(a.x - w.x, a.y - w.y) - Math.hypot(b.x - w.x, b.y - w.y))[0]
      if (prey && !w.els.includes('life')) { tx = prey.x; ty = prey.y - prey.h - 3 }
      if (w.els.includes('life')) { const c = this.bodies.find((b) => b.isCaster); if (c) { tx = c.x + 10; ty = c.y - c.h - 4 } }
      w.vx += (tx - w.x) * 3 * dt - w.vx * 2 * dt
      w.vy += (ty - w.y) * 3 * dt - w.vy * 2 * dt
      if (!this.blocks(w.x + w.vx * dt, w.y + w.vy * dt)) { w.x += w.vx * dt; w.y += w.vy * dt }
      w.tick -= dt
      if (w.tick <= 0) {
        w.tick = 0.5
        if (w.els.includes('life')) for (const b of this.bodies) if (Math.hypot(b.x - w.x, b.y - b.h / 2 - w.y) < 16) b.heal(4 * w.strength)
        this.hit(w.els.filter((e) => e !== 'life'), w.x, w.y + 3, (3 + 2 * w.strength) * (w.size ?? 1), 0.5 * w.strength, false)
        if (w.els.includes('life')) applyDisc(this.grid, ['life'], w.x, w.y + 6, 5 * (w.size ?? 1))
      }
    }
  }

  /** Motes circle the caster and burst on the first body they touch. */
  private updateMotes(dt: number): void {
    const c = this.bodies.find((b) => b.isCaster)
    for (let i = this.motes.length - 1; i >= 0; i--) {
      const m = this.motes[i]
      m.life -= dt
      m.angle += 2.6 * dt
      if (c) { m.x = c.x + Math.cos(m.angle) * 16; m.y = c.y - c.h / 2 + Math.sin(m.angle) * 12 }
      const prey = this.bodyAt(m.x, m.y, 2)
      if (m.life <= 0 || prey) {
        this.motes.splice(i, 1)
        if (prey) {
          this.hit(m.els, m.x, m.y, (3 + 2 * m.strength) * (m.size ?? 1), 0.6 * m.strength, false)
          this.flashes.push({ x: m.x, y: m.y, r: 5, life: 0.2, max: 0.2, colour: elementInfo(m.els[0]).colour })
          if (m.trig?.kind === 'impact') this.fire(m.trig, m.x, m.y)
        }
      }
    }
  }

  /** Waves spread out from where they were cast, acting on everything their front crosses. */
  private updateWaves(dt: number): void {
    const g = this.grid
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i]
      const from = w.r
      w.r = Math.min(w.max, w.r + 90 * dt)
      const n = Math.max(12, Math.round(w.r * 3))
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2
        const x = Math.floor(w.x + Math.cos(a) * w.r), y = Math.floor(w.y + Math.sin(a) * w.r)
        for (const el of w.els) {
          if (el === 'force') { if (Math.random() < 0.5) push(g, x, y, 1.5, 0.7 * w.strength, w.x, w.y) }
          else if (SUBSTANCE[el] !== undefined) { if (Math.random() < 0.12) applyToCell(g, el, x, y) }
          else if (Math.random() < 0.5) applyToCell(g, el, x, y)
        }
      }
      for (const b of this.bodies) {
        if (w.hit.has(b)) continue
        const d = Math.hypot(b.x - w.x, b.y - b.h / 2 - w.y)
        if (d >= from - 4 && d <= w.r + 4) {
          w.hit.add(b)
          const l = d || 1
          this.touchBody(b, w.els, ((b.x - w.x) / l) * 220 * w.strength, ((b.y - b.h / 2 - w.y) / l) * 220 * w.strength - 50, 8 * w.strength)
        }
      }
      if (w.r >= w.max) this.waves.splice(i, 1)
    }
  }
}

/** A jagged line from (x0, y0) to (x1, y1), as flat [x, y, x, y, ...] points: lightning. */
function jagged(x0: number, y0: number, x1: number, y1: number): number[] {
  const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.round(len / 4))
  const nx = -(y1 - y0) / (len || 1), ny = (x1 - x0) / (len || 1)
  const pts = [x0, y0]
  for (let i = 1; i < n; i++) {
    const t = i / n, off = (Math.random() - 0.5) * Math.min(6, len * 0.3)
    pts.push(x0 + (x1 - x0) * t + nx * off, y0 + (y1 - y0) * t + ny * off)
  }
  pts.push(x1, y1)
  return pts
}
