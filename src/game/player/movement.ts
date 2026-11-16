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
  climbing: 0 | -1 | 1 // the side of the wall being held, or 0
  wallLock: number
  lockDir: -1 | 1
}

export interface PlayerInput {
  move: number // -1 to 1, left and right
  climb: number // -1 to 1, up and down
  jump: boolean // held
}

export interface StepEvents {
  jumped: boolean
  doubleJumped: boolean
  wallJumped: 0 | -1 | 1 // the side of the wall jumped off
  climbJumped: boolean
  ledgeHopped: boolean
  grabbed: boolean
  wallSliding: 0 | -1 | 1
  landed: number // impact strength 0–1, or -1 when there was no landing
  skidded: boolean
}

export function createPlayer(x: number, y: number): PlayerState {
  return {
    x, y, vx: 0, vy: 0, grounded: false, coyote: 0, buffer: 0, jumpHeld: false, facing: 1,
    airJumps: PLAYER.airJumps, climbing: 0, wallLock: 0, lockDir: 1,
  }
}

const E = 1e-6

/** Does a size × size box with its feet at (x, feet) overlap anything solid? */
export function boxHits(solid: SolidAt, x: number, feet: number, size: number = PLAYER.size): boolean {
  const half = size / 2
  const x0 = Math.floor(x - half + E), x1 = Math.floor(x + half - E)
  const y0 = Math.floor(feet - size + E), y1 = Math.floor(feet - E)
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) if (solid(cx, cy)) return true
  return false
}

/**
 * Is there wall beside the box on one side, `dist` cells out, across rows from `fromTop` to
 * `toTop` cells below the top of the box?
 */
function wallBeside(solid: SolidAt, s: PlayerState, side: -1 | 1, dist: number, fromTop = 0, toTop: number = PLAYER.size - 1): boolean {
  const half = PLAYER.size / 2
  const col = side > 0 ? Math.floor(s.x + half - E) + dist : Math.floor(s.x - half + E) - dist
  const top = Math.floor(s.y - PLAYER.size + E)
  for (let r = top + fromTop; r <= top + toTop; r++) if (solid(col, r)) return true
  return false
}

function wallNear(solid: SolidAt, s: PlayerState, reach: number): 0 | -1 | 1 {
  for (let d = 1; d <= reach; d++) {
    const r = wallBeside(solid, s, 1, d), l = wallBeside(solid, s, -1, d)
    if (r && l) return s.facing
    if (r) return 1
    if (l) return -1
  }
  return 0
}

const approach = (v: number, target: number, amount: number) =>
  v < target ? Math.min(target, v + amount) : Math.max(target, v - amount)

export function stepPlayer(s: PlayerState, input: PlayerInput, dt: number, solid: SolidAt): StepEvents {
  const T = PLAYER
  const ev: StepEvents = {
    jumped: false, doubleJumped: false, wallJumped: 0, climbJumped: false, ledgeHopped: false,
    grabbed: false, wallSliding: 0, landed: -1, skidded: false,
  }

  // Jump input: buffered on press, so a slightly early press still counts.
  const pressed = input.jump && !s.jumpHeld
  s.jumpHeld = input.jump
  s.buffer = pressed ? T.jumpBuffer : Math.max(0, s.buffer - dt)
  s.coyote = s.grounded ? T.coyote : Math.max(0, s.coyote - dt)
  s.wallLock = Math.max(0, s.wallLock - dt)

  let move = Math.max(-1, Math.min(1, input.move))
  if (s.wallLock > 0) move = s.lockDir
  const climb = Math.max(-1, Math.min(1, input.climb))

  // Auto grab: push into a wall while not rising (or press up against one on the ground) to cling.
  // Once on, the player stays without holding anything; pushing away lets go. No stamina limit.
  const touching = wallNear(solid, s, 1)
  const pushing = move === 0 ? 0 : move > 0 ? 1 : -1
  if (s.climbing !== 0) {
    if (touching !== s.climbing || pushing === -s.climbing) s.climbing = 0
  } else if (touching !== 0 && s.wallLock <= 0) {
    const fromAir = !s.grounded && s.vy >= 0 && pushing === touching
    const fromGround = s.grounded && climb < 0
    if (fromAir || fromGround) {
      s.climbing = touching
      s.airJumps = T.airJumps
      ev.grabbed = true
    }
  }

  if (s.climbing !== 0) {
    const side = s.climbing
    s.facing = side
    s.vx = 0
    s.vy = climb < 0 ? -T.climbUpSpeed * -climb : climb > 0 ? T.climbDownSpeed * climb : 0
    if (climb > 0) ev.wallSliding = side // climbing down is the wall slide

    // Climbed past the top of the wall: pop up onto it.
    if (climb < 0 && !wallBeside(solid, s, side, 1, 0, Math.floor(PLAYER.size / 2))) {
      s.vy = -T.ledgeHopSpeed
      s.vx = side * 45
      s.climbing = 0
      ev.ledgeHopped = true
    } else if (s.buffer > 0) {
      s.buffer = 0
      if (move === -side) wallJump(s, side, ev)
      else {
        s.vy = -T.climbJumpSpeed
        ev.climbJumped = true
      }
      s.climbing = 0
    }
  } else {
    // Walking.
    if (move !== 0) s.facing = move > 0 ? 1 : -1
    if (s.grounded && move !== 0 && Math.sign(move) !== Math.sign(s.vx) && Math.abs(s.vx) > T.walkSpeed * 0.6) ev.skidded = true
    const accel = s.grounded ? (move !== 0 ? T.groundAccel : T.groundDecel) : T.airAccel
    s.vx = approach(s.vx, move * T.walkSpeed, accel * dt)

    // Jumps: from the ground, then off a wall, then in the air.
    if (s.buffer > 0) {
      const wall = s.grounded ? 0 : wallNear(solid, s, T.wallJumpReach)
      if (s.grounded || s.coyote > 0) {
        s.vy = -T.jumpSpeed
        s.grounded = false
        s.coyote = 0
        s.buffer = 0
        ev.jumped = true
      } else if (wall !== 0) {
        s.buffer = 0
        wallJump(s, wall, ev)
      } else if (pressed && s.airJumps > 0) {
        s.airJumps--
        s.vy = -T.doubleJumpSpeed
        s.buffer = 0
        ev.doubleJumped = true
      }
    }
  }

  if (!input.jump && s.vy < -T.jumpSpeed * T.jumpCut && !ev.ledgeHopped) s.vy = Math.max(s.vy, -T.jumpSpeed * T.jumpCut)
  if (s.climbing === 0) s.vy = Math.min(T.maxFall, s.vy + T.gravity * dt)

  // Sliding down a wall you're pushing into.
  if (s.climbing === 0 && !s.grounded && s.vy > 0 && touching !== 0 && touching === move) {
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
      let climbed = false
      if (s.grounded) {
        for (let u = 1; u <= T.stepUp; u++) {
          if (!boxHits(solid, nx, s.y - u)) { s.x = nx; s.y -= u; climbed = true; break }
        }
      }
      if (!climbed) {
        // Stop flush against the wall, not a fraction of a cell short of it.
        const half = PLAYER.size / 2
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
  let dy = s.vy * dt
  s.grounded = false
  while (Math.abs(dy) > 1e-9) {
    const st = Math.max(-1, Math.min(1, dy))
    const ny = s.y + st
    if (!boxHits(solid, s.x, ny)) s.y = ny
    else {
      // Stop flush on the floor or under the ceiling.
      const flush = st > 0 ? Math.floor(ny - E) : Math.floor(ny - PLAYER.size + E) + 1 + PLAYER.size
      if (!boxHits(solid, s.x, flush)) s.y = flush
      if (st > 0) s.grounded = true
      s.vy = 0
      break
    }
    dy -= st
  }

  // Walking down small bumps keeps the player on the ground instead of hopping off each one.
  if (wasGrounded && !s.grounded && s.vy >= 0 && s.climbing === 0) {
    let y = s.y
    for (let d = 0; d <= T.stepUp; d++) {
      if (boxHits(solid, s.x, y + 0.5)) { s.y = y; s.grounded = true; s.vy = 0; break }
      y += 1
    }
  }
  if (!s.grounded && s.vy >= 0 && boxHits(solid, s.x, s.y + 0.5)) s.grounded = true
  if (s.climbing !== 0 && s.grounded && climb >= 0) s.climbing = 0 // climbed down to the floor

  if (s.grounded) s.airJumps = T.airJumps
  if (s.grounded && !wasGrounded && fallSpeed > 80) ev.landed = Math.min(1, (fallSpeed - 80) / 280)
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
