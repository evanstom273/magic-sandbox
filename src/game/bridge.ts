import type { Spell } from './magic/spells.ts'

// What the game tells the React interface. The game writes; React subscribes. (Touch input goes the
// other way, through input/touchInput.ts.)

type Listener = () => void

export interface SlotView {
  name: string // e.g. "Water Projectile"
  detail: string // e.g. "Instant"
  colours: string[] // the elements' colours
}

export interface HudState {
  health: number
  maxHealth: number
  dead: boolean // waiting for the player to continue
  mana: number
  maxMana: number
  slots: SlotView[]
  activeSlot: number
  charge: number // 0–1 while a charged spell is building
  spells: Spell[] // the hotbar's spells, for the builder
  builderOpen: boolean // the spell builder is open (the game pauses)
}

let state: HudState = { health: 100, maxHealth: 100, dead: false, mana: 100, maxMana: 100, slots: [], activeSlot: 0, charge: 0, spells: [], builderOpen: false }
const listeners = new Set<Listener>()

export const hud = {
  get: (): HudState => state,
  set(next: Partial<HudState>): void {
    const merged = { ...state, ...next }
    const same = (Object.keys(next) as (keyof HudState)[]).every((k) => merged[k] === state[k])
    if (same) return
    state = merged
    for (const l of listeners) l()
  },
  subscribe(l: Listener): () => void {
    listeners.add(l)
    return () => listeners.delete(l)
  },
}

/** Spells changed in the builder, waiting for the game to take them. */
export const spellEdits: { slot: number; spell: Spell }[] = []
