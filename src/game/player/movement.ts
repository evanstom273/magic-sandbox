import { PLAYER } from './tuning.ts'

export type SolidAt = (x: number, y: number) => boolean

export interface PlayerState {
  x: number // centre, in cells
  y: number // feet, in cells
  vx: number
  vy: number
  grounded: boolean
  coyote: number
  buffer: number
  jumpHeld: boolean
  facing: 1 | -1
}

export interface PlayerInput {
  move: number // -1 to 1
  jump: boolean // held
}

export interface StepEvents {
  jumped: boolean
  landed: number // impact strength 0–1, or -1 when there was no landing
  skidded: boolean
}

export function createPlayer(x: number, y: number): PlayerState {
  return { x, y, vx: 0, vy: 0, grounded: false, coyote: 0, buffer: 0, jumpHeld: false, facing: 1 }
}

/** Does a size × size box with its feet at (x, feet) overlap anything solid? */
export function boxHits(solid: SolidAt, x: number, feet: number, size: number = PLAYER.size): boolean {
  const half = size / 2
  const e = 1e-6
  const x0 = Math.floor(x - half + e), x1 = Math.floor(x + half - e)
  const y0 = Math.floor(feet - size + e), y1 = Math.floor(feet - e)
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) if (solid(cx, cy)) return true
  return false
}

const approach = (v: number, target: number, amount: number) =>
  v < target ? Math.min(target, v + amount) : Math.max(target, v - amount)

export function stepPlayer(s: PlayerState, input: PlayerInput, dt: number, solid: SolidAt): StepEvents {
  const T = PLAYER
  const ev: StepEvents = { jumped: false, landed: -1, skidded: false }

  // Jump input: buffered on press, so a slightly early press still counts.
  const pressed = input.jump && !s.jumpHeld
  s.jumpHeld = input.jump
  s.buffer = pressed ? T.jumpBuffer : Math.max(0, s.buffer - dt)
  s.coyote = s.grounded ? T.coyote : Math.max(0, s.coyote - dt)

  // Walking.
  const move = Math.max(-1, Math.min(1, input.move))
  if (move !== 0) s.facing = move > 0 ? 1 : -1
  if (s.grounded && move !== 0 && Math.sign(move) !== Math.sign(s.vx) && Math.abs(s.vx) > T.walkSpeed * 0.6) ev.skidded = true
  const accel = s.grounded ? (move !== 0 ? T.groundAccel : T.groundDecel) : T.airAccel
  s.vx = approach(s.vx, move * T.walkSpeed, accel * dt)

  // Jumping, with a shorter jump if released early.
  if (s.buffer > 0 && (s.grounded || s.coyote > 0)) {
    s.vy = -T.jumpSpeed
    s.grounded = false
    s.coyote = 0
    s.buffer = 0
    ev.jumped = true
  }
  if (!input.jump && s.vy < -T.jumpSpeed * T.jumpCut) s.vy = -T.jumpSpeed * T.jumpCut
  s.vy = Math.min(T.maxFall, s.vy + T.gravity * dt)

  // Horizontal, a cell at most per sub-step, stepping up small bumps.
  let dx = s.vx * dt
  while (Math.abs(dx) > 1e-9) {
    const st = Math.max(-1, Math.min(1, dx))
    const nx = s.x + st
    if (!boxHits(solid, nx, s.y)) s.x = nx
    else {
      let climbed = false
      if (s.grounded) {
        for (let u = 1; u <= T.stepUp; u++) {
          if (!boxHits(solid, nx, s.y - u)) { s.x = nx; s.y -= u; climbed = true; break }
        }
      }
      if (!climbed) {
        // Stop flush against the wall, not a fraction of a cell short of it.
        const half = PLAYER.size / 2
        const flush = st > 0 ? Math.floor(nx + half - 1e-6) - half : Math.floor(nx - half + 1e-6) + 1 + half
        if (!boxHits(solid, flush, s.y)) s.x = flush
        s.vx = 0
        break
      }
    }
    dx -= st
  }

  // Vertical.
  const wasGrounded = s.grounded
  const fallSpeed = s.vy
  let dy = s.vy * dt
  s.grounded = false
  while (Math.abs(dy) > 1e-9) {
    const st = Math.max(-1, Math.min(1, dy))
    const ny = s.y + st
    if (!boxHits(solid, s.x, ny)) s.y = ny
    else {
      // Stop flush on the floor or under the ceiling.
      const flush = st > 0 ? Math.floor(ny - 1e-6) : Math.floor(ny - PLAYER.size + 1e-6) + 1 + PLAYER.size
      if (!boxHits(solid, s.x, flush)) s.y = flush
      if (st > 0) s.grounded = true
      s.vy = 0
      break
    }
    dy -= st
  }

  // Walking down small bumps keeps him on the ground instead of hopping off each one.
  if (wasGrounded && !s.grounded && s.vy >= 0) {
    let y = s.y
    for (let d = 0; d <= T.stepUp; d++) {
      if (boxHits(solid, s.x, y + 0.5)) { s.y = y; s.grounded = true; s.vy = 0; break }
      y += 1
    }
  }

  if (s.grounded && !wasGrounded && fallSpeed > 80) ev.landed = Math.min(1, (fallSpeed - 80) / 280)
  return ev
}
