// Starting values for the player, to tune in play. Distances are in cells, times in seconds.
export const PLAYER = {
  // The hitbox: the whole figure from the top of the head to the bottom of the feet (No. 6, #67).
  // Hands are drawing only.
  width: 10,
  height: 16,
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
  wallSlideMax: 60, // sliding down a wall: when you let go, or while pushing in before the cling catches
  wallJumpSpeedX: 70, // a short kick away, so you can steer back to the same wall and go again
  wallJumpSpeedY: 190,
  wallJumpLock: 0.1, // after a wall jump, input can't pull you straight back for this long
  wallJumpReach: 2, // cells: how far from a wall a wall jump still works
  clingDelay: 0.1, // push into a wall this long while falling before clinging, so brushing past doesn't grab
  swimStroke: 95, // each jump press in water
  swimSink: 40, // the most you sink at in water
  wallMinRows: 12, // a wall only counts if it's beside the top 12 rows of the figure; bumps of up to 4 cells never count
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
