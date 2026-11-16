import { useSyncExternalStore } from 'react'
import { hud } from '../game/bridge.ts'
import { touchInput } from '../game/input/touchInput.ts'

// The four prepared spells (#82), top centre. Click or tap one, or press 1–4 (gamepad: LB and RB).
export function Hotbar() {
  const { slots, activeSlot, charge } = useSyncExternalStore(hud.subscribe, hud.get)
  if (!slots.length) return null
  return (
    // On narrow screens it drops to a row of its own under the health and mana bars.
    <div className="pointer-events-none absolute inset-x-0 top-[max(12px,env(safe-area-inset-top))] flex justify-center px-[max(16px,env(safe-area-inset-left))] max-[700px]:top-[calc(max(16px,env(safe-area-inset-top))+48px)]">
      <ol className="pointer-events-auto flex gap-1.5" aria-label="Spells">
        {slots.map((s, i) => (
          <li key={i}>
            <button
              type="button"
              aria-pressed={i === activeSlot}
              aria-label={`Spell ${i + 1}: ${s.name}, ${s.detail}`}
              onPointerDown={(e) => { e.preventDefault(); touchInput.pickSlot = i }}
              className={`relative flex w-[clamp(64px,19vw,112px)] select-none flex-col items-start gap-0.5 overflow-hidden rounded-md border-2 px-1.5 py-1 text-left leading-tight ${i === activeSlot ? 'border-[#8fd3ff] bg-[#1d2436]' : 'border-[#2c2f45] bg-[#14151f]/85'}`}
            >
              <span className="flex gap-1">
                <span className="text-[10px] font-semibold text-white/50">{i + 1}</span>
                {s.colours.map((c, j) => (
                  <span key={j} className="mt-0.5 h-2 w-2 rounded-[2px] border border-black/40" style={{ background: c }} />
                ))}
              </span>
              <span className="w-full truncate text-[11px] font-semibold text-white/90">{s.name}</span>
              <span className="text-[10px] text-white/50">{s.detail}</span>
              {i === activeSlot && charge > 0 && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[#8fd3ff]" style={{ width: `${charge * 100}%` }} />}
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}
