import { SQUASH } from './tuning.ts'

/** Squash and stretch as a damped spring on each axis. Drawing only; the hitbox never changes. */
export class Squash {
  sx = 1
  sy = 1
  private vx = 0
  private vy = 0

  set(sx: number, sy: number): void {
    this.sx = sx
    this.sy = sy
    this.vx = 0
    this.vy = 0
  }

  jump(): void {
    this.set(SQUASH.jump[0], SQUASH.jump[1])
  }

  land(impact: number): void {
    const k = Math.max(0, Math.min(1, impact)) * SQUASH.landingStrength
    this.set(1 + k, 1 - k)
  }

  /** fall: 0–1, how close to full fall speed; stretches the body slightly while falling. */
  update(dt: number, fall = 0): void {
    const ty = 1 + SQUASH.fallStretch * Math.max(0, Math.min(1, fall))
    const tx = 1 / ty
    const n = Math.max(1, Math.ceil(dt / (1 / 240)))
    const h = dt / n
    for (let i = 0; i < n; i++) {
      this.vx += (-SQUASH.stiffness * (this.sx - tx) - SQUASH.damping * this.vx) * h
      this.vy += (-SQUASH.stiffness * (this.sy - ty) - SQUASH.damping * this.vy) * h
      this.sx += this.vx * h
      this.sy += this.vy * h
    }
  }
}
