// What the game tells the React interface. The game writes; React subscribes.

type Listener = () => void

export interface HudState {
  health: number
  maxHealth: number
}

let state: HudState = { health: 100, maxHealth: 100 }
const listeners = new Set<Listener>()

export const hud = {
  get: (): HudState => state,
  set(next: Partial<HudState>): void {
    const merged = { ...state, ...next }
    if (merged.health === state.health && merged.maxHealth === state.maxHealth) return
    state = merged
    for (const l of listeners) l()
  },
  subscribe(l: Listener): () => void {
    listeners.add(l)
    return () => listeners.delete(l)
  },
}
