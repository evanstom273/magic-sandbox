import { expect, test } from 'vitest'
import { createPlayer, stepPlayer } from '../player/movement.ts'
import { PLAYER } from '../player/tuning.ts'
import { buildTestRoom, ROOM_W } from './testRoom.ts'

const DT = 1 / 60

test('the high ledge can be reached by scaling the right-hand wall and kicking off onto it', () => {
  const room = buildTestRoom()
  const wallX = ROOM_W - 4
  const s = createPlayer(wallX - PLAYER.size / 2 - 10, 150)
  for (let i = 0; i < 30; i++) stepPlayer(s, { move: 0, jump: false }, DT, room.isSolid)
  expect(s.grounded).toBe(true)

  // Scale the wall: push into it, press jump when close enough, hold through the rise, repeat.
  let holdLeft = 0, released = true, onLedge = false
  for (let t = 0; t < 12 && !onLedge; t += DT) {
    const high = s.y < 32 // feet above the ledge's top: time to kick off towards it
    const near = s.x > wallX - PLAYER.size / 2 - PLAYER.wallJumpReach
    let jump = false
    if (holdLeft > 0) { jump = true; holdLeft -= DT }
    else if (!released) released = true
    else if (near) { jump = true; holdLeft = 0.3; released = false }
    stepPlayer(s, { move: high ? -1 : 1, jump }, DT, room.isSolid)
    onLedge = s.grounded && s.y < 40 && s.x < 296
  }
  expect(onLedge).toBe(true)
})
