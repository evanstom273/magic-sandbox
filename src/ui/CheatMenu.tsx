import { useEffect, useSyncExternalStore } from 'react'
import { hud, type Cheats } from '../game/bridge.ts'

const CHEATS: { id: keyof Cheats; name: string; note: string }[] = [
  { id: 'invulnerable', name: 'Invulnerable', note: 'Nothing hurts you: falls, fire, lava, acid, blasts, Void. You still get shoved about.' },
  { id: 'infiniteMana', name: 'Infinite mana', note: 'Your mana stays full, whatever you cast.' },
]

// The cheat menu (#24, #87): switches for testing and messing about. They take effect at once and
// stay on until switched off (or the page is reloaded). The game pauses while it's open.
export function CheatMenu() {
  const { cheatsOpen, cheats } = useSyncExternalStore(hud.subscribe, hud.get)
  const close = () => hud.set({ cheatsOpen: false })

  useEffect(() => {
    if (!cheatsOpen) return
    const onKey = (e: KeyboardEvent) => { if (!e.repeat && (e.key === 'Escape' || e.key === 'c' || e.key === 'C')) { e.preventDefault(); close() } }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [cheatsOpen])

  if (!cheatsOpen) return null
  return (
    <div className="absolute inset-0 z-20 flex items-start justify-center overflow-y-auto bg-[#07080c]/70 px-[max(12px,env(safe-area-inset-left))] py-[max(12px,env(safe-area-inset-top))]" onPointerDown={(e) => { if (e.target === e.currentTarget) close() }}>
      <div role="dialog" aria-modal="true" aria-label="Cheats" className="my-auto flex w-full max-w-[420px] flex-col gap-3 rounded-xl border-2 border-[#2c2f45] bg-[#101119] p-4 text-white shadow-[0_8px_0_#07080c]">
        <header className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Cheats</h2>
          <button type="button" onClick={close} className="rounded-md border-2 border-[#2c2f45] bg-[#14151f] px-3 py-1.5 text-[13px] font-semibold hover:border-[#454a6a]">Done</button>
        </header>
        {CHEATS.map((c) => {
          const on = cheats[c.id]
          return (
            <button
              key={c.id}
              type="button"
              role="switch"
              aria-checked={on}
              aria-label={c.name}
              onClick={() => hud.set({ cheats: { ...cheats, [c.id]: !on } })}
              className={`flex items-center gap-3 rounded-lg border-2 p-3 text-left ${on ? 'border-[#8fd3ff] bg-[#1d2436]' : 'border-[#2c2f45] bg-[#14151f] hover:border-[#454a6a]'}`}
            >
              <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${on ? 'bg-[#8fd3ff]' : 'bg-[#2a2a3a]'}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-[left] ${on ? 'left-[18px]' : 'left-0.5'}`} />
              </span>
              <span className="flex flex-col">
                <strong className="text-[14px]">{c.name}</strong>
                <span className="text-[12px] text-white/55">{c.note}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
