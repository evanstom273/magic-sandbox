import { boxHits, type SolidAt } from '../player/movement.ts'
import { feel, type ElementId } from '../world/elements.ts'
import type { Body } from './effects.ts'

// Stand-in training dummies (not creature designs): something for Target, Orbit, Summon and runes to
// find. They fall, get shoved, freeze, scorch, get wet and glow when healed; they can't be hurt.

export class Dummy implements Body {
  x: number
  y: number
  vx = 0
  vy = 0
  readonly w = 10
  readonly h = 14
  readonly isCaster = false
  frozen = 0
  scorched = 0
  wet = 0
  healed = 0
  poisoned = 0
  dazzled = 0
  stunned = 0
  eaten = 0 // a flash where Void (or worse) took a bite; dummies can't be hurt
  readonly home: { x: number; y: number }

  constructor(x: number, y: number) {
    this.x = x
    this.y = y
    this.home = { x, y }
  }

  heal(n: number): void { if (n > 0) this.healed = 0.6 }
  hurt(): void { this.eaten = 0.4 }
  impulse(vx: number, vy: number): void { if (this.frozen <= 0) { this.vx += vx; this.vy += vy } }
  thrust(ax: number, ay: number, dt: number): void { this.impulse(ax * dt, ay * dt) }
  affect(el: ElementId): void {
    const f = feel(el)
    if (f === 'cold') { this.frozen = 2.5; this.vx = 0 }
    else if (f === 'hot') { this.scorched = 1; this.frozen = 0 }
    else if (f === 'wet') this.wet = 3
    else if (f === 'poison') this.poisoned = 3
    else if (f === 'dazzle') this.dazzled = 2
    else if (f === 'stun') { this.stunned = this.wet > 0 ? 2.5 : 1.2; this.vx = 0 }
  }

  update(dt: number, solid: SolidAt): void {
    this.frozen = Math.max(0, this.frozen - dt)
    this.scorched = Math.max(0, this.scorched - dt)
    this.wet = Math.max(0, this.wet - dt)
    this.healed = Math.max(0, this.healed - dt)
    this.poisoned = Math.max(0, this.poisoned - dt)
    this.dazzled = Math.max(0, this.dazzled - dt)
    this.stunned = Math.max(0, this.stunned - dt)
    this.eaten = Math.max(0, this.eaten - dt)
    for (let i = 0; i < 6 && boxHits(solid, this.x, this.y, this.w, this.h); i++) this.y -= 1
    this.vy = Math.min(300, this.vy + 560 * dt)
    this.vx *= Math.exp(-3 * dt)
    for (const [axis, v] of [['x', this.vx * dt], ['y', this.vy * dt]] as const) {
      let left = v
      while (Math.abs(left) > 1e-6) {
        const st = Math.max(-1, Math.min(1, left))
        const nx = axis === 'x' ? this.x + st : this.x, ny = axis === 'y' ? this.y + st : this.y
        if (boxHits(solid, nx, ny, this.w, this.h)) {
          if (axis === 'x') this.vx = 0
          else { this.vy = 0; this.vx *= 0.8 }
          break
        }
        this.x = nx; this.y = ny
        left -= st
      }
    }
  }
}
