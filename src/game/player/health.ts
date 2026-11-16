import { PLAYER } from './tuning.ts'

// Starting values for health, to tune in play.
export const HEALTH = {
  max: 100,
  safeFall: 6, // body heights fallen before it hurts (higher than a jump plus a double jump)
  perHeight: 12, // damage per body height past that
  fallCap: 85, // one fall never takes more than this, so it can't kill from full health
  restRate: 40, // health a second while standing on the stand-in rest spot
}

/** Damage for a fall of `cells` cells. */
export function fallDamage(cells: number, size: number = PLAYER.size): number {
  const heights = cells / size
  if (heights <= HEALTH.safeFall) return 0
  return Math.min(HEALTH.fallCap, Math.round((heights - HEALTH.safeFall) * HEALTH.perHeight))
}

/** A mark on the body, where damage came from. `amount` is the health it stands for; it shrinks as health heals. */
export interface Mark {
  kind: 'dent' // falls (and later blows) dent; fire and acid will eat cells instead
  at: number // 0–1 across the body's bottom edge
  amount: number
  seed: number
}

export class Health {
  value: number = HEALTH.max
  marks: Mark[] = []
  private nextSeed = 1

  /** Takes damage and leaves a mark. Returns true if that was the end of the player's health. */
  hurt(amount: number, kind: Mark['kind'], at: number): boolean {
    if (amount <= 0) return false
    const taken = Math.min(amount, this.value)
    this.value -= taken
    this.marks.push({ kind, at, amount: taken, seed: this.nextSeed++ })
    return this.value <= 0
  }

  /** Heals, mending the newest marks first so the body keeps matching the bar. */
  heal(amount: number): void {
    let left = Math.min(amount, HEALTH.max - this.value)
    this.value += left
    for (let i = this.marks.length - 1; i >= 0 && left > 0; i--) {
      const m = this.marks[i]
      const used = Math.min(m.amount, left)
      m.amount -= used
      left -= used
      if (m.amount <= 1e-6) this.marks.splice(i, 1)
    }
  }

  reset(): void {
    this.value = HEALTH.max
    this.marks = []
  }
}
