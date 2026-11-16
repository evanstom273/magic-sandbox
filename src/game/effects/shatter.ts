import type { SolidAt } from '../player/movement.ts'

// Death and return: the body bursts into its own cells, which fall and settle on the ground; on the
// way back, cells fly in and snap together into the body. (Once the world is simulated, the
// shattered cells will become real debris.)

export interface CellPoint {
  x: number
  y: number
  cell: number
}

export interface Shard {
  x: number
  y: number
  vx: number
  vy: number
  cell: number // the body cell it came from (ink or white)
  settled: boolean
}

export class Shatter {
  readonly shards: Shard[] = []
  private readonly rand: () => number

  constructor(rand: () => number = Math.random) {
    this.rand = rand
  }

  /** Bursts a set of cells (the figure, at their places in the world) outwards from (cx, cy). */
  burst(points: readonly CellPoint[], cx: number, cy: number): void {
    this.shards.length = 0
    for (const p of points) {
      const px = p.x + 0.5, py = p.y + 0.5
      const dx = px - cx, dy = py - cy
      const d = Math.hypot(dx, dy) || 1
      // A gentle burst: the pieces land within a few body widths, not across the room.
      const speed = 20 + this.rand() * 35
      this.shards.push({ x: px, y: py, vx: (dx / d) * speed + (this.rand() - 0.5) * 16, vy: (dy / d) * speed - 30 - this.rand() * 40, cell: p.cell, settled: false })
    }
  }

  update(dt: number, solid: SolidAt, gravity = 420): void {
    for (const s of this.shards) {
      if (s.settled) continue
      s.vy += gravity * dt
      // Move at most a cell per sub-step, so fast pieces can't tunnel into the floor.
      const n = Math.max(1, Math.ceil(Math.max(Math.abs(s.vx), Math.abs(s.vy)) * dt))
      const h = dt / n
      for (let i = 0; i < n && !s.settled; i++) {
        const nx = s.x + s.vx * h
        if (solid(Math.floor(nx), Math.floor(s.y))) s.vx *= -0.35
        else s.x = nx
        const ny = s.y + s.vy * h
        if (!solid(Math.floor(s.x), Math.floor(ny))) { s.y = ny; continue }
        if (s.vy > 0) {
          s.y = Math.floor(ny) - 0.5 // resting on top of the cell it hit
          s.vx *= 0.55
          if (Math.abs(s.vy) < 45) { s.vy = 0; s.settled = true; s.x = Math.floor(s.x) + 0.5 } else s.vy *= -0.3
        } else s.vy = 0
      }
    }
  }
}

export interface GatherCell {
  fromX: number
  fromY: number
  toX: number
  toY: number
  cell: number
  delay: number
}

/** Cells flying in from around a point and snapping into a body standing there. */
export class Gather {
  cells: GatherCell[] = []
  t = 0
  readonly duration = 0.55

  /** Cells fly in from around their places and snap into them. */
  start(points: readonly CellPoint[], rand: () => number = Math.random): void {
    this.t = 0
    this.cells = points.map((p) => {
      const a = rand() * Math.PI * 2, r = 18 + rand() * 22
      return { fromX: p.x + Math.cos(a) * r, fromY: p.y + Math.sin(a) * r * 0.7, toX: p.x, toY: p.y, cell: p.cell, delay: rand() * 0.35 }
    })
  }

  get done(): boolean {
    return this.t >= this.duration + 0.35
  }

  update(dt: number): void {
    this.t += dt
  }

  /** Where each cell is now: eased in, so they rush at first and settle into place. */
  positions(): { x: number; y: number; cell: number }[] {
    return this.cells.map((c) => {
      const k = Math.max(0, Math.min(1, (this.t - c.delay) / this.duration))
      const e = 1 - Math.pow(1 - k, 3)
      return { x: c.fromX + (c.toX - c.fromX) * e, y: c.fromY + (c.toY - c.fromY) * e, cell: c.cell }
    })
  }
}
