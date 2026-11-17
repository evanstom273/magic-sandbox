import { useSyncExternalStore } from 'react'
import { hud } from '../game/bridge.ts'

function Bar({ label, value, max, fill, trail }: { label: string; value: number; max: number; fill: string; trail?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      className="relative h-3.5 w-44 overflow-hidden max-[480px]:w-32 rounded-[3px] border-2 border-[#1a1a26] bg-[#2a2a3a]"
    >
      {trail && <div className="absolute inset-y-0 left-0 transition-[width] delay-300 duration-500 ease-out" style={{ width: `${pct}%`, background: trail }} />}
      <div className="absolute inset-y-0 left-0" style={{ width: `${pct}%`, background: fill }} />
    </div>
  )
}

// Health (red; the lost part lingers as a pale trail) and mana (the guide's power blue) at top left.
export function HealthBar() {
  const { health, maxHealth, mana, maxMana } = useSyncExternalStore(hud.subscribe, hud.get)
  return (
    <div className="pointer-events-none absolute top-[max(16px,env(safe-area-inset-top))] left-[max(16px,env(safe-area-inset-left))] flex flex-col gap-1.5">
      <Bar label="Health" value={health} max={maxHealth} fill="#ff5a5a" trail="#f2e6e6" />
      <Bar label="Mana" value={mana} max={maxMana} fill="#8fd3ff" />
    </div>
  )
}
