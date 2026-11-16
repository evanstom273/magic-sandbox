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
  affect?(el: ElementId): void // other elements touching it (freezing, scorching, wetting)
}

export interface Projectile { x: number; y: number; vx: number; vy: number; els: ElementId[]; strength: number; age: number }
export interface Spark { x: number; y: number; vx: number; vy: number; life: number; max: number; colour: number }
export interface Flash { x: number; y: number; r: number; life: number; max: number; colour: number }
export interface Beam { x0: number; y0: number; x1: number; y1: number; colour: number }
export interface Rune { x: number; y: number; els: ElementId[]; strength: number; armed: boolean; age: number }
export interface Wisp { x: number; y: number; vx: number; vy: number; els: ElementId[]; strength: number; life: number; tick: number; home: { x: number; y: number } }
export interface Mote { angle: number; els: ElementId[]; strength: number; life: number; x: number; y: number }
export interface Wave { x: number; y: number; r: number; max: number; els: ElementId[]; strength: number; hit: Set<Body> }

const MAX_RUNES = 6
const RUNE_REACH = 12

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
      case 'beam': this.beam(els, tip, dir, caster, ev.dt); break
      case 'rune': {
        const p = this.firstSurface(tip, aim)
        this.runes.push({ x: p.x, y: p.y, els: [...els], strength: s, armed: false, age: 0 })
        if (this.runes.length > MAX_RUNES) this.runes.shift()
        break
      }
      case 'target': this.target(els, caster, aim, s, ev); break
      case 'summon': {
        const p = this.clampToRange(caster, aim)
        this.wisps.push({ x: p.x, y: p.y, vx: 0, vy: 0, els: [...els], strength: s, life: 6 + 4 * s, tick: 0.3, home: { x: p.x, y: p.y } })
        break
      }
      case 'orbit': {
        const n = Math.round(4 + 2 * s)
        for (let i = 0; i < n; i++) this.motes.push({ angle: (i / n) * Math.PI * 2, els: [...els], strength: s, life: 12, x: caster.x, y: caster.y })
        break
      }
      case 'wave': {
        const cy = caster.y - caster.h / 2
        this.waves.push({ x: caster.x, y: cy, r: 4, max: ev.sustained ? 26 : 22 + 22 * s, els: [...els], strength: ev.sustained ? 0.8 : s, hit: new Set([caster]) })
        break
      }
      default: break
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
  private beam(els: readonly ElementId[], tip: { x: number; y: number }, dir: { x: number; y: number }, caster: Body, dt: number): void {
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
      if (el === 'force') push(this.grid, end.x, end.y, 3, 0.9, end.x, end.y, dir.x, dir.y) // a drill
      else if (SUBSTANCE[el] !== undefined) {
        for (let i = 0; i < Math.round(70 * dt + Math.random()); i++) applyToCell(this.grid, el, Math.floor(x - dir.x * (1 + Math.random() * 2)), Math.floor(y - dir.y * (1 + Math.random() * 2)))
      } else applyDisc(this.grid, [el], end.x, end.y, 2.5, 1, true)
    }
    if (hitBody) this.touchBody(hitBody, els, dir.x * 600 * dt, dir.y * 600 * dt, 14 * dt)
    this.beams.push({ x0: tip.x, y0: tip.y, x1: x, y1: y, colour: elementInfo(els[0]).colour })
    if (Math.random() < 0.5) this.spark(x, y, els, 25)
    void caster
  }

  /** Straight onto the aimed point (or the first thing in the way), small and precise. */
  private target(els: readonly ElementId[], caster: Body, aim: { x: number; y: number }, s: number, ev: CastEvent): void {
    const from = { x: caster.x, y: caster.y - caster.h / 2 }
    const p = this.firstSurface(from, this.clampToRange(caster, aim))
    const body = this.bodyAt(p.x, p.y, 4)
    if (body) {
      this.touchBody(body, els, 0, ev.sustained ? -300 * ev.dt : -60 * s, ev.sustained ? 14 * ev.dt : 10 * s)
      if (els.includes('force')) body.impulse(0, ev.sustained ? -500 * ev.dt : -150 * s)
    }
    applyDisc(this.grid, els.filter((e) => e !== 'force'), p.x, p.y, 2.5 + 1.5 * s, 1, ev.sustained)
    if (els.includes('force')) push(this.grid, p.x, p.y, 3 + s, 0.8 * s)
    if (!ev.sustained || Math.random() < 0.2) this.flashes.push({ x: p.x, y: p.y, r: 4, life: 0.18, max: 0.18, colour: elementInfo(els[0]).colour })
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
    for (const b of this.bodies) {
      const bx = b.x, by = b.y - b.h / 2
      if (Math.hypot(bx - cx, by - cy) > r + Math.max(b.w, b.h) / 2) continue
      if (els.includes('life')) b.heal(sustained ? 14 * dt : 10 * forceStrength / 0.6)
      if (els.includes('force') && !b.isCaster) {
        const ax = bx - cx, ay = by - cy, l = Math.hypot(ax, ay) || 1
        b.impulse((ax / l) * 160 * forceStrength, (ay / l) * 160 * forceStrength - 40)
      }
      for (const el of els) if (el !== 'life' && el !== 'force') b.affect?.(el)
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
    this.beams.length = 0
    this.updateRunes(dt)
    this.updateWisps(dt)
    this.updateMotes(dt)
    this.updateWaves(dt)
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

  /** Runes wait on their surface and go off when something comes near (the caster once it's left). */
  private updateRunes(dt: number): void {
    for (let i = this.runes.length - 1; i >= 0; i--) {
      const r = this.runes[i]
      r.age += dt
      const near = (b: Body) => Math.hypot(b.x - r.x, b.y - b.h / 2 - r.y) < RUNE_REACH + b.h / 2
      const caster = this.bodies.find((b) => b.isCaster)
      if (!r.armed && (!caster || !near(caster))) r.armed = true
      if (this.bodies.some((b) => near(b) && (!b.isCaster || r.armed))) this.setOff(i)
    }
  }

  setOff(i: number): void {
    const r = this.runes[i]
    this.runes.splice(i, 1)
    const radius = 5 + 5 * r.strength
    this.hit(r.els, r.x, r.y, radius, 0.7 * r.strength, false)
    this.flashes.push({ x: r.x, y: r.y, r: radius, life: 0.3, max: 0.3, colour: elementInfo(r.els[0]).colour })
  }

  /** Summoned wisps (stand-ins): drift towards the nearest body that isn't the caster, giving off their elements. */
  private updateWisps(dt: number): void {
    for (let i = this.wisps.length - 1; i >= 0; i--) {
      const w = this.wisps[i]
      w.life -= dt
      if (w.life <= 0) { this.wisps.splice(i, 1); continue }
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
        this.hit(w.els.filter((e) => e !== 'life'), w.x, w.y + 3, 3 + 2 * w.strength, 0.5 * w.strength, false)
        if (w.els.includes('life')) applyDisc(this.grid, ['life'], w.x, w.y + 6, 5)
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
          this.hit(m.els, m.x, m.y, 3 + 2 * m.strength, 0.6 * m.strength, false)
          this.flashes.push({ x: m.x, y: m.y, r: 5, life: 0.2, max: 0.2, colour: elementInfo(m.els[0]).colour })
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
