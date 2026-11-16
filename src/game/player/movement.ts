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
  airJumps: number
  onWall: 0 | -1 | 1 // the side of the wall the player is on (holding or sliding), or 0
  wallLock: number
  lockDir: -1 | 1
  clingPush: number // how long the player has been pushing into a wall while falling
  fallDist: number // cells fallen since last on the ground or a wall; going up doesn't subtract
  boost: number // seconds left of a magic launch, during which letting go of jump doesn't cut the rise
}

export interface PlayerInput {
  move: number // -1 to 1, left and right
  jump: boolean // held
}

export interface StepEvents {
  jumped: boolean
  doubleJumped: boolean
  wallJumped: 0 | -1 | 1 // the side of the wall jumped off
  grabbed: boolean
  wallSliding: 0 | -1 | 1
  landed: number // impact strength 0–1, or -1 when there was no landing
  fell: number // on landing: cells fallen since last on the ground or a wall (for fall damage), else 0
  skidded: boolean
}

export function createPlayer(x: number, y: number): PlayerState {
  return {
    x, y, vx: 0, vy: 0, grounded: false, coyote: 0, buffer: 0, jumpHeld: false, facing: 1,
    airJumps: PLAYER.airJumps, onWall: 0, wallLock: 0, lockDir: 1, clingPush: 0, fallDist: 0, boost: 0,
  }
}

const E = 1e-6

/** Does the player's box, with its feet at (x, feet), overlap anything solid? */
export function boxHits(solid: SolidAt, x: number, feet: number, w: number = PLAYER.width, h: number = PLAYER.height): boolean {
  const half = w / 2
  const x0 = Math.floor(x - half + E), x1 = Math.floor(x + half - E)
  const y0 = Math.floor(feet - h + E), y1 = Math.floor(feet - E)
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) if (solid(cx, cy)) return true
  return false
}

/**
 * Is there wall beside the box on one side, `dist` cells out, across rows from `fromTop` to
 * `toTop` cells below the top of the box?
 */
function wallBeside(solid: SolidAt, s: PlayerState, side: -1 | 1, dist: number, fromTop = 0, toTop: number = PLAYER.height - 1): boolean {
  const half = PLAYER.width / 2
  const col = side > 0 ? Math.floor(s.x + half - E) + dist : Math.floor(s.x - half + E) - dist
  const top = Math.floor(s.y - PLAYER.height + E)
  for (let r = top + fromTop; r <= top + toTop; r++) if (solid(col, r)) return true
  return false
}

/** A wall within `reach` cells. Only something beside the upper body counts, never a bump at the feet. */
function wallNear(solid: SolidAt, s: PlayerState, reach: number): 0 | -1 | 1 {
  const rows = PLAYER.wallMinRows - 1
  for (let d = 1; d <= reach; d++) {
    const r = wallBeside(solid, s, 1, d, 0, rows), l = wallBeside(solid, s, -1, d, 0, rows)
    if (r && l) return s.facing
    if (r) return 1
    if (l) return -1
  }
  return 0
}

const approach = (v: number, target: number, amount: number) =>
  v < target ? Math.min(target, v + amount) : Math.max(target, v - amount)

/** What the world around the player is like this step (from the scene). */
export interface Surroundings {
  submerged: number // 0–1: how much of the body is in liquid (or quicksand)
  drag?: number // how freely you move in what you're in: 1 water; mud, honey, tar and quicksand far less
  slippery?: boolean // standing on ice or blood: slow to get going and slow to stop
  bouncy?: boolean // standing in slime: jumps go higher
}

export function stepPlayer(s: PlayerState, input: PlayerInput, dt: number, solid: SolidAt, env: Surroundings = { submerged: 0 }): StepEvents {
  const T = PLAYER
  const swimming = env.submerged > 0.35
  const drag = swimming ? env.drag ?? 1 : 1
  // Buried by falling sand or rubble: pushed up out of it.
  for (let i = 0; i < 6 && boxHits(solid, s.x, s.y); i++) s.y -= 1
  const ev: StepEvents = {
    jumped: false, doubleJumped: false, wallJumped: 0, grabbed: false, wallSliding: 0, landed: -1, fell: 0, skidded: false,
  }

  // Jump input: buffered on press, so a slightly early press still counts.
  const pressed = input.jump && !s.jumpHeld
  s.jumpHeld = input.jump
  s.buffer = pressed ? T.jumpBuffer : Math.max(0, s.buffer - dt)
  s.coyote = s.grounded ? T.coyote : Math.max(0, s.coyote - dt)
  s.wallLock = Math.max(0, s.wallLock - dt)

  let move = Math.max(-1, Math.min(1, input.move))
  if (s.wallLock > 0) move = s.lockDir

  // Walls: push into one for a moment while falling to catch hold. On a wall, pushing towards it
  // holds still, letting go slides down, pushing away drops off. No climbing: to scale a wall,
  // jump off it and steer back. No stamina.
  const touching = wallNear(solid, s, 1)
  const pushing = move === 0 ? 0 : move > 0 ? 1 : -1
  s.clingPush = !s.grounded && s.vy > 0 && touching !== 0 && pushing === touching ? s.clingPush + dt : 0
  if (s.onWall !== 0) {
    if (touching !== s.onWall || pushing === -s.onWall || s.grounded) s.onWall = 0
  } else if (touching !== 0 && s.wallLock <= 0 && s.clingPush >= T.clingDelay) {
    s.onWall = touching
    s.airJumps = T.airJumps
    ev.grabbed = true
  }

  // Walking (or steering in the air).
  if (s.onWall === 0) {
    if (move !== 0) s.facing = move > 0 ? 1 : -1
    if (s.grounded && move !== 0 && Math.sign(move) !== Math.sign(s.vx) && Math.abs(s.vx) > T.walkSpeed * 0.6) ev.skidded = true
    const accel = (s.grounded ? (move !== 0 ? T.groundAccel : T.groundDecel) : T.airAccel) * (s.grounded && env.slippery ? 0.15 : 1)
    s.vx = approach(s.vx, move * T.walkSpeed * (swimming ? 0.6 * drag : 1), accel * dt)
  } else {
    s.facing = s.onWall
    s.vx = 0
  }

  // Jumps: from the ground, then off a wall (always a kick away), then in the air.
  if (s.buffer > 0) {
    const wall = s.onWall !== 0 ? s.onWall : s.grounded ? 0 : wallNear(solid, s, T.wallJumpReach)
    if (swimming && pressed) {
      // Swimming: every press is a stroke upwards.
      s.vy = -T.swimStroke * drag
      s.buffer = 0
    } else if (s.grounded || s.coyote > 0) {
      s.vy = -T.jumpSpeed * (env.bouncy ? 1.4 : 1)
      s.grounded = false
      s.coyote = 0
      s.buffer = 0
      ev.jumped = true
    } else if (wall !== 0) {
      s.buffer = 0
      s.onWall = 0
      wallJump(s, wall, ev)
    } else if (pressed && s.airJumps > 0) {
      s.airJumps--
      s.vy = -T.doubleJumpSpeed
      s.buffer = 0
      ev.doubleJumped = true
    }
  }

  s.boost = Math.max(0, s.boost - dt)
  if (!input.jump && s.boost <= 0 && s.vy < -T.jumpSpeed * T.jumpCut) s.vy = -T.jumpSpeed * T.jumpCut
  s.vy = Math.min(swimming ? T.swimSink * drag : T.maxFall, s.vy + T.gravity * (swimming ? 0.25 : 1) * dt)
  if (swimming) { s.fallDist = 0; s.airJumps = T.airJumps } // water breaks a fall

  // On a wall: hold still while pushing towards it, slide down when let go. Pushing into a wall
  // before the hold catches also slides.
  if (s.onWall !== 0) {
    if (pushing === s.onWall) s.vy = Math.min(0, s.vy)
    else s.vy = Math.min(s.vy, T.wallSlideMax)
    if (s.vy > 0) ev.wallSliding = s.onWall
  } else if (!s.grounded && s.vy > 0 && touching !== 0 && touching === pushing) {
    s.vy = Math.min(s.vy, T.wallSlideMax)
    s.facing = touching
    ev.wallSliding = touching
  }

  // Horizontal, a cell at most per sub-step, stepping up small bumps.
  let dx = s.vx * dt
  while (Math.abs(dx) > 1e-9) {
    const st = Math.max(-1, Math.min(1, dx))
    const nx = s.x + st
    if (!boxHits(solid, nx, s.y)) s.x = nx
    else {
      // Step up small bumps on the ground, and while coming down, so bumpy ground doesn't catch.
      let climbed = false
      if (s.grounded || (s.vy >= 0 && s.onWall === 0)) {
        for (let u = 1; u <= T.stepUp; u++) {
          if (!boxHits(solid, nx, s.y - u)) { s.x = nx; s.y -= u; climbed = true; break }
        }
      }
      if (!climbed) {
        // Stop flush against the wall, not a fraction of a cell short of it.
        const half = PLAYER.width / 2
        const flush = st > 0 ? Math.floor(nx + half - E) - half : Math.floor(nx - half + E) + 1 + half
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
  const yBefore = s.y
  let dy = s.vy * dt
  s.grounded = false
  while (Math.abs(dy) > 1e-9) {
    const st = Math.max(-1, Math.min(1, dy))
    const ny = s.y + st
    if (!boxHits(solid, s.x, ny)) s.y = ny
    else {
      // Stop flush on the floor or under the ceiling.
      const flush = st > 0 ? Math.floor(ny - E) : Math.floor(ny - PLAYER.height + E) + 1 + PLAYER.height
      if (!boxHits(solid, s.x, flush)) s.y = flush
      if (st > 0) s.grounded = true
      s.vy = 0
      break
    }
    dy -= st
  }

  // Count every cell of downward travel; a double jump doesn't reset it, a wall does.
  if (s.y > yBefore) s.fallDist += s.y - yBefore
  if (s.onWall !== 0 || ev.wallSliding !== 0) s.fallDist = 0

  // Walking down small bumps keeps the player on the ground instead of hopping off each one.
  if (wasGrounded && !s.grounded && s.vy >= 0 && s.onWall === 0) {
    let y = s.y
    for (let d = 0; d <= T.stepUp; d++) {
      if (boxHits(solid, s.x, y + 0.5)) { s.y = y; s.grounded = true; s.vy = 0; break }
      y += 1
    }
  }
  if (!s.grounded && s.vy >= 0 && boxHits(solid, s.x, s.y + 0.5)) s.grounded = true
  if (s.onWall !== 0 && s.grounded) s.onWall = 0 // slid down to the floor

  if (s.grounded) s.airJumps = T.airJumps
  if (s.grounded && !wasGrounded) {
    if (fallSpeed > 80) ev.landed = Math.min(1, (fallSpeed - 80) / 280)
    ev.fell = s.fallDist
  }
  if (s.grounded) s.fallDist = 0
  return ev
}

function wallJump(s: PlayerState, side: -1 | 1, ev: StepEvents): void {
  s.vx = -side * PLAYER.wallJumpSpeedX
  s.vy = -PLAYER.wallJumpSpeedY
  s.wallLock = PLAYER.wallJumpLock
  s.lockDir = side > 0 ? -1 : 1
  s.facing = s.lockDir
  s.airJumps = PLAYER.airJumps
  ev.wallJumped = side
}
