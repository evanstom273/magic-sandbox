import { BodyCell, CellBody } from './body.ts'

// The player's figure (No. 6 from the Caster Line-up, #67): a rounded head on a longer body, with
// two eyes and a mouth, floating hands and floating feet. The head and body are one grid of real
// cells; the feet and hands float free and are drawn on their own.
//
// Rows from the top of the figure: head 0–6, body 7–12, a gap at 13, feet 14–15 (16 in all).

export const FIG = {
  bodyW: 10, // the head is the widest part
  bodyH: 13, // head and body together
  feetGap: 1,
  footW: 3,
  footH: 2,
}

export type Face = 'open' | 'blink' | 'hurt'

const inHead = (x: number, y: number) => {
  if (x < 0 || x > 9 || y < 0 || y > 6) return false
  const r = 2
  const cx = x < r ? r : x > 9 - r ? 9 - r : x
  const cy = y < r ? r : y > 6 - r ? 6 - r : y
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r + 0.5
}
const inBody = (x: number, y: number) => x >= 1 && x <= 8 && y >= 7 && y <= 12

/** The head and body as cells: outline, the seam where head meets body, and the face. */
export function figureBody(face: Face): CellBody {
  const W = FIG.bodyW, H = FIG.bodyH
  const b = new CellBody(W, H)
  const filled = (x: number, y: number) => inHead(x, y) || inBody(x, y)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!filled(x, y)) continue
      const edge = !filled(x - 1, y) || !filled(x + 1, y) || !filled(x, y - 1) || !filled(x, y + 1)
      const seam = inBody(x, y) && !inHead(x, y) && inHead(x, y - 1)
      b.cells[y * W + x] = edge || seam ? BodyCell.INK : BodyCell.HERO
    }
  }
  const set = (x: number, y: number, c: BodyCell) => { b.cells[y * W + x] = c }
  // Eyes: 2 × 3 with a highlight, a white cell clear of the outline on each side.
  for (const ex of [2, 6]) {
    if (face === 'open') {
      for (let dy = 0; dy < 3; dy++) { set(ex, 1 + dy, BodyCell.INK); set(ex + 1, 1 + dy, BodyCell.INK) }
      set(ex + 1, 1, BodyCell.HERO) // the highlight
    } else {
      set(ex, 2, BodyCell.INK); set(ex + 1, 2, BodyCell.INK) // shut, or squeezed when hurt
    }
  }
  if (face === 'hurt') {
    set(3, 5, BodyCell.INK); set(4, 4, BodyCell.INK); set(5, 4, BodyCell.INK); set(6, 5, BodyCell.INK) // a grimace
  } else {
    set(4, 5, BodyCell.INK); set(5, 5, BodyCell.INK)
  }
  return b
}

export interface Pose {
  walkPhase: number // advances with distance walked
  walking: boolean
  airborne: boolean
  wall: 0 | -1 | 1 // holding a wall on that side
  hurt: boolean
  time: number // seconds, for the idle bob
}

export interface Part {
  x: number // left, in cells
  y: number // top, in cells
  w: number
  h: number
}

/** Where the feet go, relative to the figure's centre x and its feet line. */
export function feet(cx: number, ground: number, pose: Pose): Part[] {
  const step = pose.walking ? Math.sin(pose.walkPhase) : 0
  const tuck = pose.airborne ? 1 : 0
  return [
    { x: cx - 4, y: ground - FIG.footH - tuck - Math.max(0, Math.round(step)), w: FIG.footW, h: FIG.footH },
    { x: cx + 1, y: ground - FIG.footH - tuck - Math.max(0, Math.round(-step)), w: FIG.footW, h: FIG.footH },
  ]
}

/** Where each hand's 3 × 3 blob goes (its top-left), relative to the body's position. */
export function hands(cx: number, bodyTop: number, bodyH: number, pose: Pose): { x: number; y: number }[] {
  const mid = bodyTop + bodyH * 0.62
  const bob = pose.walking || pose.airborne ? 0 : Math.sin(pose.time * 2.4) * 0.7
  const swing = pose.walking ? Math.sin(pose.walkPhase) * 1.6 : 0
  const up = pose.airborne ? -4 : pose.hurt ? -2 : 0
  const left = { x: cx - 9 + swing, y: mid - 1 + bob + up }
  const right = { x: cx + 6 - swing, y: mid - 1 + bob + up }
  // Holding a wall: that hand presses against it at shoulder height, the other hangs low.
  if (pose.wall === 1) { right.x = cx + 5; right.y = bodyTop + 6; left.y = mid + 1 }
  if (pose.wall === -1) { left.x = cx - 8; left.y = bodyTop + 6; right.y = mid + 1 }
  return [left, right]
}

/** A hand's cells: an ink ring around a white centre, as offsets in a 3 × 3 block. */
export const HAND_CELLS: { dx: number; dy: number; cell: BodyCell }[] = [
  { dx: 1, dy: 0, cell: BodyCell.INK },
  { dx: 0, dy: 1, cell: BodyCell.INK },
  { dx: 1, dy: 1, cell: BodyCell.HERO },
  { dx: 2, dy: 1, cell: BodyCell.INK },
  { dx: 1, dy: 2, cell: BodyCell.INK },
]
