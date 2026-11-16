import { applyDisc, applyToCell, push, SUBSTANCE, type ElementId } from '../world/elements.ts'
import { CellGrid, Kind, KIND, Material as M } from '../world/grid.ts'
import type { CastEvent } from './caster.ts'
import { elementInfo, type Spell } from './spells.ts'

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
}

export interface Projectile { x: number; y: number; vx: number; vy: number; els: ElementId[]; strength: number; age: number }
export interface Spark { x: number; y: number; vx: number; vy: number; life: number; max: number; colour: number }
export interface Flash { x: number; y: number; r: number; life: number; max: number; colour: number }

const rnd = Math.random
const RANGE = 95 // the furthest an aimed spell (AoE, Target, Rune) lands from the caster

export class Magic {
  readonly grid: CellGrid
  readonly projectiles: Projectile[] = []
  readonly sparks: Spark[] = []
  readonly flashes: Flash[] = []
  bodies: Body[] = []

  constructor(grid: CellGrid) {
    this.grid = grid
  }

  /** One cast of a spell, from the catalyst's tip towards the aim point. */
  cast(spell: Spell, ev: CastEvent, tip: { x: number; y: number }, aim: { x: number; y: number }, caster: Body): void {
    const dx = aim.x - tip.x, dy = aim.y - tip.y
    const len = Math.hypot(dx, dy) || 1
    const dir = { x: dx / len, y: dy / len }
    const els = spell.elements
    const s = ev.strength
    switch (spell.shape) {
      case 'projectile': {
        const spread = spell.cast === 'burst' || spell.cast === 'continuous' ? (rnd() - 0.5) * 0.12 : 0
        const a = Math.atan2(dir.y, dir.x) + spread
        const speed = 150 + 50 * Math.min(1.6, s)
        this.projectiles.push({ x: tip.x, y: tip.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, els: [...els], strength: s, age: 0 })
        break
      }
      case 'cone': this.cone(els, tip, dir, s, ev); break
      case 'aoe': {
        const p = this.clampToRange(caster, aim)
        const r = 5 + 5 * s
        this.hit(els, p.x, p.y, r, 0.6 * s, false)
        this.flashes.push({ x: p.x, y: p.y, r, life: 0.3, max: 0.3, colour: elementInfo(els[0]).colour })
        break
      }
      case 'self': this.self(els, caster, dir, s, ev); break
      default: break // the other shapes arrive in the next stages
    }
  }

  /** Elements over a disc, on the world and on any bodies inside it. Force pushes away from the centre. */
  hit(els: readonly ElementId[], cx: number, cy: number, r: number, forceStrength: number, sustained: boolean, dt = 0): void {
    applyDisc(this.grid, els.filter((e) => e !== 'force'), cx, cy, r, 1, sustained)
    if (els.includes('force')) push(this.grid, cx, cy, r, Math.min(1, forceStrength))
    for (const b of this.bodies) {
      const bx = b.x, by = b.y - b.h / 2
      if (Math.hypot(bx - cx, by - cy) > r + Math.max(b.w, b.h) / 2) continue
      if (els.includes('life')) b.heal(sustained ? 14 * dt : 10 * forceStrength / 0.6)
      if (els.includes('force') && !b.isCaster) {
        const ax = bx - cx, ay = by - cy, l = Math.hypot(ax, ay) || 1
        b.impulse((ax / l) * 160 * forceStrength, (ay / l) * 160 * forceStrength - 40)
      }
    }
    for (let i = 0; i < (sustained ? 1 : 10); i++) this.spark(cx, cy, els, 30 + rnd() * 50)
  }

  private cone(els: readonly ElementId[], tip: { x: number; y: number }, dir: { x: number; y: number }, s: number, ev: CastEvent): void {
    const g = this.grid
    const rays = ev.sustained ? Math.max(1, Math.round(160 * ev.dt + rnd())) : Math.round(40 * s)
    const half = 0.32 + 0.08 * Math.min(1, s - 1 > 0 ? s - 1 : 0)
    const length = 30 + 18 * Math.min(1.6, s)
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

  private self(els: readonly ElementId[], me: Body, dir: { x: number; y: number }, s: number, ev: CastEvent): void {
    const cx = me.x, cy = me.y - me.h / 2
    for (const el of els) {
      if (el === 'force') {
        if (ev.sustained) me.thrust(dir.x * 900, dir.y * 900, ev.dt) // levitate, fly
        else me.impulse(dir.x * 230 * s, dir.y * 230 * s) // a launch
      } else if (el === 'life') {
        me.heal(ev.sustained ? 14 * ev.dt : 18 * s)
      } else if (el === 'cold' && ev.sustained) {
        applyDisc(this.grid, ['cold'], me.x, me.y + 2, 7) // frost underfoot: walk on water
      } else {
        // A ring around the caster, clear of the body.
        const n = ev.sustained ? Math.round(60 * ev.dt + rnd()) : Math.round(70 * s)
        for (let i = 0; i < n; i++) {
          const a = rnd() * Math.PI * 2, r = 8 + rnd() * 4
          applyToCell(this.grid, el, Math.floor(cx + Math.cos(a) * r), Math.floor(cy + Math.sin(a) * r * 1.2), ev.sustained)
        }
      }
    }
    if (!ev.sustained || rnd() < 0.3) this.flashes.push({ x: cx, y: cy, r: 10, life: 0.25, max: 0.25, colour: elementInfo(els[0]).colour })
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
        else if (this.bodies.some((b) => !b.isCaster && Math.abs(b.x - nx) < b.w / 2 && ny > b.y - b.h && ny < b.y)) hit = true
        else { p.x = nx; p.y = ny }
      }
      if (rnd() < 0.6) this.sparks.push({ x: p.x, y: p.y, vx: -p.vx * 0.1, vy: -p.vy * 0.1, life: 0.2, max: 0.2, colour: elementInfo(p.els[0]).colour })
      if (hit) {
        this.projectiles.splice(i, 1)
        const r = 4 + 4 * Math.min(1.6, p.strength)
        this.hit(p.els, p.x, p.y, r, 0.75 * p.strength, false)
        this.flashes.push({ x: p.x, y: p.y, r, life: 0.22, max: 0.22, colour: elementInfo(p.els[0]).colour })
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
}
