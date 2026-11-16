import { hud } from '../game/bridge.ts'

// Opens the spell builder (also B on a keyboard, Select on a gamepad).
export function SpellsButton() {
  return (
    <button
      type="button"
      onPointerDown={(e) => { e.preventDefault(); hud.set({ builderOpen: true }) }}
      className="pointer-events-auto absolute top-[max(12px,env(safe-area-inset-top))] right-[max(16px,env(safe-area-inset-right))] rounded-md border-2 border-[#2c2f45] bg-[#14151f]/85 px-3 py-2 text-[13px] font-semibold text-white/90 hover:border-[#454a6a]"
    >
      Spells
    </button>
  )
}
