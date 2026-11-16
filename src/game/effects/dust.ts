// The style guide's dust (§7.2): small pale squares that drift and fade. Here each mote is one cell.

export interface Mote {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
}

export class Dust {
  readonly motes: Mote[] = []
  private readonly rand: () => number

  constructor(rand: () => number = Math.random) {
    this.rand = rand
  }

  /** A puff at (x, y). dir: -1 or 1 to throw it one way, 0 for both. */
  puff(x: number, y: number, count: number, speed: number, dir: -1 | 0 | 1 = 0): void {
    const r = this.rand
    for (let i = 0; i < count; i++) {
      const side = dir === 0 ? (i % 2 === 0 ? -1 : 1) : dir
      const max = 0.3 + r() * 0.35
      this.motes.push({
        x: x + (r() - 0.5) * 6,
        y: y - r() * 1.5,
        vx: side * speed * (0.4 + r() * 0.8),
        vy: -(8 + r() * 18),
        life: max,
        max,
      })
    }
  }

  update(dt: number): void {
    for (let i = this.motes.length - 1; i >= 0; i--) {
      const m = this.motes[i]
      m.life -= dt
      if (m.life <= 0) { this.motes.splice(i, 1); continue }
      m.x += m.vx * dt
      m.y += m.vy * dt
      const drag = Math.exp(-5 * dt)
      m.vx *= drag
      m.vy = m.vy * drag + 6 * dt
    }
  }
}
