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
