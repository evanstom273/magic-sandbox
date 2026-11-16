// What the on-screen touch controls are holding. React writes it; the game reads it.
// jumpTap latches a press until the game reads it, so a tap shorter than a frame still counts.
export const touchInput = {
  moveX: 0,
  jump: false,
  jumpTap: false,
  // A hotbar slot picked by tapping it (React sets it, the game takes it).
  pickSlot: -1,
}
