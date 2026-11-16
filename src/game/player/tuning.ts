// Starting values for the player, to tune in play. Distances are in cells, times in seconds.
export const PLAYER = {
  size: 12, // the body is size × size cells; the hitbox is the plain square
  walkSpeed: 66,
  groundAccel: 1100,
  groundDecel: 1500,
  airAccel: 650,
  gravity: 560,
  jumpSpeed: 200, // about 3 body-heights at full hold
  jumpCut: 0.45, // releasing jump early caps upward speed at this fraction
  maxFall: 380,
  coyote: 0.1, // can still jump this long after walking off a ledge
  jumpBuffer: 0.12, // a jump pressed this long before landing still happens
  stepUp: 3, // walks up and down bumps this many cells high without jumping

  // Extra movement (no magic).
  airJumps: 1, // double jump; comes back on landing or on a wall
  doubleJumpSpeed: 180,
  wallSlideMax: 60, // fall speed while pushing into a wall
  climbUpSpeed: 40,
  climbDownSpeed: 60,
  wallJumpSpeedX: 95,
  wallJumpSpeedY: 190,
  wallJumpLock: 0.16, // after a wall jump, input can't pull you straight back for this long
  wallJumpReach: 2, // cells: how far from a wall a wall jump still works
  climbJumpSpeed: 185, // a jump while grabbing with no direction: straight up the wall
  ledgeHopSpeed: 150, // climbing past the top of a wall pops you up onto it
} as const

// The style guide's squash and stretch (§7.1), as a starting point.
export const SQUASH = {
  jump: [0.72, 1.32] as const,
  doubleJump: [0.8, 1.22] as const,
  landingStrength: 0.4, // landing is (1 + 0.4k) × (1 − 0.4k), k = impact 0–1
  fallStretch: 0.12, // extra vertical stretch at full fall speed
  stiffness: 420,
  damping: 24, // a little overshoot, not a wobble
}
