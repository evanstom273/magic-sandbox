import { hud } from '../game/bridge.ts'

const button = 'rounded-md border-2 border-[#2c2f45] bg-[#14151f]/85 px-3 py-2 text-[13px] font-semibold text-white/90 hover:border-[#454a6a]'

// Top right: the guide to combining elements (also G on a keyboard) and the spell builder (also B,
// or Select on a gamepad).
export function MenuButtons() {
  return (
    <div className="pointer-events-auto absolute top-[max(12px,env(safe-area-inset-top))] right-[max(16px,env(safe-area-inset-right))] flex gap-2">
      <button type="button" className={button} onPointerDown={(e) => { e.preventDefault(); hud.set({ guideOpen: true }) }}>Guide</button>
      <button type="button" className={button} onPointerDown={(e) => { e.preventDefault(); hud.set({ builderOpen: true }) }}>Spells</button>
    </div>
  )
}
