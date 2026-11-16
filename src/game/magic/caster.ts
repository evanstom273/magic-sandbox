import { castCost, channelCost, Mana, type Spell } from './spells.ts'

// Turns cast input (press, hold, release) into casts, by the spell's casting type:
// Instant casts once; Charged builds while held and fires on release; Channeled sustains while held;
// Burst fires three shots; Continuous repeats shots while held. A tap is a press and a release.

export interface CastEvent {
  strength: number // 1 is a normal cast; charged spells go from 0.4 to 1.6
  sustained: boolean // part of a held, channelled cast (runs every frame with dt)
  dt: number
}

export const CHARGE_TIME = 1.2
export const BURST_SHOTS = 3
export const BURST_GAP = 0.09
export const CONTINUOUS_GAP = 0.16

export class Caster {
  charge = 0 // 0–1 while charging
  charging = false
  channelling = false
  private burstLeft = 0
  private burstTimer = 0
  private repeatTimer = 0
  private held = false

  /** One frame. `down` is whether cast is held now. Returns the casts to make this frame. */
  update(spell: Spell, down: boolean, dt: number, mana: Mana): CastEvent[] {
    const out: CastEvent[] = []
    const pressed = down && !this.held
    const released = !down && this.held
    this.held = down
    const fire = (strength: number) => {
      if (mana.spend(castCost(spell, strength))) out.push({ strength, sustained: false, dt })
    }

    switch (spell.cast) {
      case 'instant':
        if (pressed) fire(1)
        break
      case 'charged':
        if (pressed) { this.charging = true; this.charge = 0 }
        if (this.charging && down) {
          // Charge only as far as mana can pay for.
          const next = Math.min(1, this.charge + dt / CHARGE_TIME)
          if (mana.infinite || castCost(spell, 0.4 + 1.2 * next) <= mana.value) this.charge = next
        }
        if (this.charging && released) { this.charging = false; fire(0.4 + 1.2 * this.charge); this.charge = 0 }
        break
      case 'channeled':
        this.channelling = down && mana.spend(channelCost(spell) * dt)
        if (this.channelling) out.push({ strength: 1, sustained: true, dt })
        break
      case 'burst':
        if (pressed) { this.burstLeft = BURST_SHOTS; this.burstTimer = 0 }
        break
      case 'continuous':
        if (pressed) this.repeatTimer = 0
        if (down) {
          this.repeatTimer -= dt
          if (this.repeatTimer <= 0) { fire(0.5); this.repeatTimer = CONTINUOUS_GAP }
        }
        break
    }
    if (this.burstLeft > 0) {
      this.burstTimer -= dt
      if (this.burstTimer <= 0) { fire(0.8); this.burstLeft--; this.burstTimer = BURST_GAP }
    }
    if (!down) this.channelling = false
    return out
  }

  /** Casting in any way: holding cast, charging, channelling, or a burst still firing. Mana doesn't refill meanwhile. */
  get casting(): boolean {
    return this.held || this.charging || this.channelling || this.burstLeft > 0
  }

  /** Switching spells cancels anything in progress. */
  reset(): void {
    this.charge = 0
    this.charging = false
    this.channelling = false
    this.burstLeft = 0
  }
}
