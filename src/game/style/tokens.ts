// Colour tokens from the Stylised Geometry guide (stylised-geometry/STYLISED_GEOMETRY.md):
// the colour-jobs table in §5.1 plus the extra starting tokens in §12.4.
// The guide's light, squash and hit-stop numbers are left out until something
// moves, because they were tuned for a side-on platformer.

/** Every outline. */
export const INK = 0x1a1a26
/** The player's body. No enemy is white-bodied. */
export const HERO = 0xf2f2f2
/** The player's abilities. */
export const POWER = 0x8fd3ff
export const POWER_LIGHT = 0xcfeaff
/** Getting hurt, health loss, hurt flashes. */
export const DAMAGE = 0xff5a5a
/** Currency, pickups, buying. */
export const REWARD = 0xffcf4a
/** "About to attack". */
export const HOT_TELL = 0xfff0d8
/** Dust and small debris. */
export const DUST = 0xb4b4c6
/** Feet. */
export const FOOT = 0x2a2a3a

/** Placeholder backdrop from the reference sheets, until the game has a world palette (guide §5.3). */
export const BACKDROP = 0x14141c
