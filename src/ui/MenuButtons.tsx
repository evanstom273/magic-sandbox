import { useEffect, useSyncExternalStore } from 'react'
import { hud, type HudState } from '../game/bridge.ts'

const button = 'rounded-md border-2 border-[#2c2f45] bg-[#14151f]/85 px-3 py-2 text-[13px] font-semibold text-white/90 hover:border-[#454a6a] max-[480px]:px-2 max-[480px]:text-[12px]'

// Top right: the cheat menu (also C), the guide to combining elements (also G) and the spell
// builder (also B, or Select on a gamepad).
export function MenuButtons() {
  const { cheats } = useSyncExternalStore(hud.subscribe, hud.get)
  const on = [cheats.invulnerable && 'Invulnerable', cheats.infiniteMana && 'Infinite mana'].filter(Boolean)
  const open = (which: Partial<HudState>) => (e: React.PointerEvent) => { e.preventDefault(); hud.set(which) }
  // Their keys. Each menu closes itself (with its key or Escape), so these only open one when none is.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.target instanceof HTMLInputElement) return
      const s = hud.get()
      if (s.builderOpen || s.guideOpen || s.cheatsOpen) return
      const k = e.key.toLowerCase()
      if (k === 'b') hud.set({ builderOpen: true })
      else if (k === 'g') hud.set({ guideOpen: true })
      else if (k === 'c') hud.set({ cheatsOpen: true })
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [])
  return (
    <div className="pointer-events-auto absolute top-[max(12px,env(safe-area-inset-top))] right-[max(16px,env(safe-area-inset-right))] flex gap-2 max-[480px]:gap-1.5">
      {/* Lit up, with a dot, while any cheat is on. */}
      <button type="button" aria-label={on.length ? `Cheats, on: ${on.join(', ')}` : 'Cheats'} title={on.length ? `On: ${on.join(', ')}` : undefined}
        className={`${button} ${on.length ? '!border-[#8fd3ff] flex items-center gap-1.5' : ''}`} onPointerDown={open({ cheatsOpen: true })}>
        {on.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-[#8fd3ff]" />}Cheats
      </button>
      <button type="button" className={button} onPointerDown={open({ guideOpen: true })}>Guide</button>
      <button type="button" className={button} onPointerDown={open({ builderOpen: true })}>Spells</button>
    </div>
  )
}
