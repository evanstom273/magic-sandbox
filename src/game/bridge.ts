// What the game tells the React interface. The game writes; React subscribes. (Touch input goes the
// other way, through input/touchInput.ts.)

type Listener = () => void

export interface HudState {
  health: number
  maxHealth: number
  dead: boolean // waiting for the player to continue
}

let state: HudState = { health: 100, maxHealth: 100, dead: false }
const listeners = new Set<Listener>()

export const hud = {
  get: (): HudState => state,
  set(next: Partial<HudState>): void {
    const merged = { ...state, ...next }
    if (merged.health === state.health && merged.maxHealth === state.maxHealth && merged.dead === state.dead) return
    state = merged
    for (const l of listeners) l()
  },
  subscribe(l: Listener): () => void {
    listeners.add(l)
    return () => listeners.delete(l)
  },
}
