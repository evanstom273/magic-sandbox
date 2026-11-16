// The style guide's ring (§7.2): an outline that grows and fades. Drawn as a ring of cells.

export interface Ring {
  x: number
  y: number
  r: number
  grow: number
  life: number
  max: number
}

export class Rings {
  readonly rings: Ring[] = []

  add(x: number, y: number, r = 4, grow = 40, life = 0.3): void {
    this.rings.push({ x, y, r, grow, life, max: life })
  }

  update(dt: number): void {
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const g = this.rings[i]
      g.life -= dt
      if (g.life <= 0) { this.rings.splice(i, 1); continue }
      g.r += g.grow * dt
    }
  }
}
