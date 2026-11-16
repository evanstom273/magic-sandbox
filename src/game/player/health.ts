// Starting values for health, to tune in play.
export const HEALTH = {
  max: 100,
  // In cells, so falls hurt the same whatever the player's size: safe for 72 cells (4.5 of the
  // 16-cell figure's heights; higher than a jump plus a double jump), then 1 a cell.
  safeFall: 72,
  perCell: 1,
  fallCap: 85, // one fall never takes more than this, so it can't kill from full health
  restRate: 40, // health a second while standing on the stand-in rest spot
}

/** Damage for a fall of `cells` cells. */
export function fallDamage(cells: number): number {
  if (cells <= HEALTH.safeFall) return 0
  return Math.min(HEALTH.fallCap, Math.round((cells - HEALTH.safeFall) * HEALTH.perCell))
}

/** A mark on the body, where damage came from. `amount` is the health it stands for; it shrinks as health heals. */
export interface Mark {
  kind: 'dent' | 'burn' // falls and blows dent; fire, lava and acid eat cells away instead
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
    // Burning in one place keeps eating the same bite, rather than leaving a mark every moment.
    const last = this.marks[this.marks.length - 1]
    if (kind === 'burn' && last?.kind === 'burn' && Math.abs(last.at - at) < 0.25) last.amount += taken
    else this.marks.push({ kind, at, amount: taken, seed: this.nextSeed++ })
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
