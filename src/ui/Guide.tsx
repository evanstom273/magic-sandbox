import { useEffect, useState, useSyncExternalStore } from 'react'
import { hud } from '../game/bridge.ts'
import { CODEX_ELEMENTS, searchGuide, SECTIONS, type GuideSection } from '../game/magic/guide.ts'
import { ELEMENTS } from '../game/magic/spells.ts'

const KIND_NAME: Record<string, string> = { force: 'Force', liquid: 'Liquid', gas: 'Gas', solid: 'Solid or powder', made: 'Made by reactions' }
const colourOf = (id: string) => CODEX_ELEMENTS.find((e) => e.id === id)?.colour ?? '#888'
const nameOf = (id: string) => CODEX_ELEMENTS.find((e) => e.id === id)?.name ?? id

function Swatch({ id, onPick }: { id: string; onPick: (name: string) => void }) {
  return (
    <button type="button" title={nameOf(id)} aria-label={`Show ${nameOf(id)}`} onClick={() => onPick(nameOf(id))}
      className="h-3 w-3 shrink-0 rounded-[2px] border border-white/25" style={{ background: colourOf(id) }} />
  )
}

// The guide to combining elements (#85): what happens when materials meet, what each force does to
// each material, and what mixing does in a spell, from the Element Codex. Searching an element shows
// its card and everything it's part of; "lava + water" shows what two do together.
export function Guide() {
  const { guideOpen } = useSyncExternalStore(hud.subscribe, hud.get)
  const [query, setQuery] = useState('')
  const [section, setSection] = useState<GuideSection | undefined>()
  const close = () => hud.set({ guideOpen: false })

  useEffect(() => {
    if (!guideOpen) return
    const onKey = (e: KeyboardEvent) => {
      // Typing in the search box is typing (the box handles its own Escape first).
      if (e.target instanceof HTMLInputElement && e.key !== 'Escape') return
      if (e.key === 'Escape' || e.key === 'g' || e.key === 'G') { e.preventDefault(); close() }
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [guideOpen])

  if (!guideOpen) return null
  const { element, entries } = searchGuide(query, section)
  const castable = element && ELEMENTS.some((e) => e.id === element.id)
  const chip = (on: boolean) => `rounded-full border px-2.5 py-0.5 text-[12px] font-semibold ${on ? 'border-[#8fd3ff] bg-[#1d2436] text-white' : 'border-[#2c2f45] text-white/60 hover:border-[#454a6a]'}`

  return (
    <div className="absolute inset-0 z-20 flex items-start justify-center overflow-y-auto bg-[#07080c]/70 px-[max(12px,env(safe-area-inset-left))] py-[max(12px,env(safe-area-inset-top))]" onPointerDown={(e) => { if (e.target === e.currentTarget) close() }}>
      <div role="dialog" aria-modal="true" aria-label="Guide" className="my-auto flex w-full max-w-[640px] flex-col gap-3 rounded-xl border-2 border-[#2c2f45] bg-[#101119] p-4 text-white shadow-[0_8px_0_#07080c]">
        <header className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Combining elements</h2>
          <button type="button" onClick={close} className="rounded-md border-2 border-[#2c2f45] bg-[#14151f] px-3 py-1.5 text-[13px] font-semibold hover:border-[#454a6a]">Done</button>
        </header>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape' && query) { e.stopPropagation(); setQuery('') } }}
          placeholder='An element, two with "+" (lava + water), or any word'
          aria-label="Search the guide"
          className="w-full rounded-md border-2 border-[#2c2f45] bg-[#14151f] px-2.5 py-1.5 text-[14px] text-white placeholder:text-white/35 focus:border-[#8fd3ff] focus:outline-none"
        />
        <div role="group" aria-label="Show" className="flex flex-wrap gap-1">
          <button type="button" aria-pressed={!section} onClick={() => setSection(undefined)} className={chip(!section)}>All</button>
          {SECTIONS.map((s) => <button key={s.id} type="button" aria-pressed={section === s.id} onClick={() => setSection(s.id)} className={chip(section === s.id)}>{s.name}</button>)}
        </div>

        {element && (
          <article aria-label={element.name} className="flex flex-col gap-1.5 rounded-lg border border-[#2c2f45] bg-[#14151f] p-3 text-[13px]">
            <header className="flex items-center gap-2">
              <span className="h-3.5 w-3.5 rounded-[3px] border border-white/25" style={{ background: element.colour }} />
              <strong className="text-[15px]">{element.name}</strong>
              <span className="text-white/45">{KIND_NAME[element.kind]}{castable ? '' : ' · can\'t be cast'}</span>
            </header>
            <p className="m-0 text-white/80"><span className="text-white/45">In the world: </span>{element.world}</p>
            <p className="m-0 text-white/80"><span className="text-white/45">Cast: </span>{element.cast}</p>
          </article>
        )}

        <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px]" aria-label="Combinations">
          {entries.map((g) => (
            <li key={g.section + g.title} className="flex items-start gap-2 rounded-md px-1 py-1 hover:bg-white/[0.03]">
              <span className="mt-[3px] flex min-w-[44px] gap-1">{g.els.slice(0, 3).map((id) => <Swatch key={id} id={id} onPick={setQuery} />)}</span>
              <span className="text-white/80"><strong className="text-white">{g.title}:</strong> {g.text}</span>
            </li>
          ))}
        </ul>
        {!entries.length && <p className="m-0 text-[13px] text-white/45">Nothing in the guide for "{query.trim()}".</p>}
        <p className="m-0 text-[12px] text-white/35">{entries.length} {entries.length === 1 ? 'rule' : 'rules'}, from the Element Codex. Tap a colour to see that element.</p>
      </div>
    </div>
  )
}
