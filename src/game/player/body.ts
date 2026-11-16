import type { Mark } from './health.ts'

// A character's body as its own little grid of cells. It moves smoothly and is drawn at the
// world's cell size; once the world is simulated, the world acts on these cells directly.

export const BodyCell = {
  EMPTY: 0,
  INK: 1, // the outline
  HERO: 2, // the player's white
} as const
export type BodyCell = (typeof BodyCell)[keyof typeof BodyCell]

export class CellBody {
  readonly width: number
  readonly height: number
  readonly cells: Uint8Array

  constructor(width: number, height: number) {
    this.width = width
    this.height = height
    this.cells = new Uint8Array(width * height)
  }

  /** A plain square: a one-cell ink outline around a filled body. */
  static square(size: number, fill: BodyCell = BodyCell.HERO): CellBody {
    const b = new CellBody(size, size)
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const edge = x === 0 || y === 0 || x === size - 1 || y === size - 1
        b.cells[y * size + x] = edge ? BodyCell.INK : fill
      }
    }
    return b
  }

  /** A copy with the marks of damage on it. Each dent's depth follows the health it stands for. */
  withMarks(marks: readonly Mark[], fallCap = 85): CellBody {
    const b = new CellBody(this.width, this.height)
    b.cells.set(this.cells)
    const W = this.width, H = this.height
    for (const m of marks) {
      if (m.kind === 'burn') { this.bite(b, m, fallCap); continue }
      const depth = Math.max(1, Math.min(Math.floor(H * 0.42), Math.round((m.amount / fallCap) * H * 0.42)))
      const half = 1.5 + depth * 0.8
      const cx = 1 + m.at * (W - 3)
      for (let x = 0; x < W; x++) {
        const t = (x + 0.5 - cx) / (half + 0.5)
        if (Math.abs(t) >= 1) continue
        const d = Math.round(depth * (1 - t * t))
        for (let y = H - d; y < H; y++) b.cells[y * W + x] = BodyCell.EMPTY
      }
      // A crack or two running up from the dent.
      let x = Math.round(cx), r = (m.seed * 9301 + 49297) % 233280
      const len = Math.min(H - 3, depth + 1 + (r % 3))
      for (let i = 0; i < len; i++) {
        r = (r * 9301 + 49297) % 233280
        x = Math.max(2, Math.min(W - 3, x + ((r % 3) - 1)))
        const y = H - depth - 1 - i
        if (y <= 1) break
        if (b.cells[y * W + x] === BodyCell.HERO) b.cells[y * W + x] = BodyCell.INK
      }
    }
    b.reink()
    return b
  }

  /** A burn: a ragged bite eaten out of the body's bottom edge, with a few pits around it. */
  private bite(b: CellBody, m: Mark, fallCap: number): void {
    const W = this.width, H = this.height
    const depth = Math.max(1, Math.min(Math.floor(H * 0.5), Math.round((m.amount / fallCap) * H * 0.5)))
    const half = 1.5 + depth * 0.9
    const cx = 1 + m.at * (W - 3)
    let r = (m.seed * 7919 + 104729) % 233280
    const next = () => (r = (r * 9301 + 49297) % 233280)
    for (let x = 0; x < W; x++) {
      const t = (x + 0.5 - cx) / (half + 0.5)
      if (Math.abs(t) >= 1) continue
      const d = Math.max(0, Math.round(depth * (1 - t * t)) + (next() % 3) - 1)
      for (let y = H - d; y < H; y++) b.cells[y * W + x] = BodyCell.EMPTY
      // Pits just above the bite.
      const py = H - d - 1 - (next() % 2)
      if (py > 1 && next() % 3 === 0) b.cells[py * W + x] = BodyCell.EMPTY
    }
  }

  /** Redraws the outline along whatever edge the body now has. */
  reink(): void {
    const W = this.width, H = this.height
    const out = this.cells.slice()
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (this.cells[y * W + x] !== BodyCell.HERO) continue
        const edge = x === 0 || y === 0 || x === W - 1 || y === H - 1 ||
          this.cells[y * W + x - 1] === BodyCell.EMPTY || this.cells[y * W + x + 1] === BodyCell.EMPTY ||
          this.cells[(y - 1) * W + x] === BodyCell.EMPTY || this.cells[(y + 1) * W + x] === BodyCell.EMPTY
        if (edge) out[y * W + x] = BodyCell.INK
      }
    }
    this.cells.set(out)
  }

  get(x: number, y: number): BodyCell {
    return this.cells[y * this.width + x] as BodyCell
  }

  /**
   * The body redrawn at a new size in whole cells (for squash and stretch), sampling each cell's
   * centre so the outline stays on all four sides.
   */
  resample(outW: number, outH: number): Uint8Array {
    const w = Math.max(1, Math.round(outW)), h = Math.max(1, Math.round(outH))
    const out = new Uint8Array(w * h)
    for (let y = 0; y < h; y++) {
      // Edges map to edges, so the outline survives any size; the rest samples each cell's centre.
      const sy = y === 0 ? 0 : y === h - 1 ? this.height - 1 : Math.min(this.height - 1, Math.floor(((y + 0.5) * this.height) / h))
      for (let x = 0; x < w; x++) {
        const sx = x === 0 ? 0 : x === w - 1 ? this.width - 1 : Math.min(this.width - 1, Math.floor(((x + 0.5) * this.width) / w))
        out[y * w + x] = this.cells[sy * this.width + sx]
      }
    }
    return out
  }
}
