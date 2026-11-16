// The world as a grid of cells. Static for now: no simulation until the player is done.

export const Material = {
  EMPTY: 0,
  ROCK: 1,
} as const
export type Material = (typeof Material)[keyof typeof Material]

export class CellGrid {
  readonly width: number
  readonly height: number
  readonly cells: Uint8Array

  constructor(width: number, height: number) {
    this.width = width
    this.height = height
    this.cells = new Uint8Array(width * height)
  }

  get(x: number, y: number): Material {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return Material.ROCK
    return this.cells[y * this.width + x] as Material
  }

  set(x: number, y: number, m: Material): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return
    this.cells[y * this.width + x] = m
  }

  /** Solid for the player: outside the grid counts as solid, so nothing leaves the room. */
  isSolid = (x: number, y: number): boolean => this.get(x, y) !== Material.EMPTY
}
