import { useSyncExternalStore } from 'react'
import { hud } from '../game/bridge.ts'

// The health bar, top left. The lost part lingers as a pale trail before draining, so a hit reads at a glance.
export function HealthBar() {
  const { health, maxHealth } = useSyncExternalStore(hud.subscribe, hud.get)
  const pct = Math.max(0, Math.min(100, (health / maxHealth) * 100))
  return (
    <div
      role="meter"
      aria-label="Health"
      aria-valuemin={0}
      aria-valuemax={maxHealth}
      aria-valuenow={Math.round(health)}
      className="pointer-events-none absolute top-[max(16px,env(safe-area-inset-top))] left-[max(16px,env(safe-area-inset-left))] h-3.5 w-44 overflow-hidden rounded-[3px] border-2 border-[#1a1a26] bg-[#2a2a3a]"
    >
      <div className="absolute inset-y-0 left-0 bg-[#f2e6e6] transition-[width] delay-300 duration-500 ease-out" style={{ width: `${pct}%` }} />
      <div className="absolute inset-y-0 left-0 bg-[#ff5a5a]" style={{ width: `${pct}%` }} />
    </div>
  )
}
