import { useEffect, useState, useSyncExternalStore } from 'react'
import { hud, spellEdits } from '../game/bridge.ts'
import { touchInput } from '../game/input/touchInput.ts'
import {
  CAST_HELP, CAST_TYPES, castCost, channelCost, ELEMENTS, SHAPE_HELP, SHAPES, STAND_IN_CAPACITY, TRIGGERS,
  toggleElement, withShape, type Spell,
} from '../game/magic/spells.ts'

const hex = (n: number) => '#' + n.toString(16).padStart(6, '0')

function Chip({ on, disabled, onClick, children, label }: { on: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode; label?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md border-2 px-2.5 py-1.5 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-35 ${on ? 'border-[#8fd3ff] bg-[#1d2436] text-white' : 'border-[#2c2f45] bg-[#14151f] text-white/80 hover:border-[#454a6a]'}`}
    >
      {children}
    </button>
  )
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex flex-wrap items-baseline gap-x-2 text-[11px] font-semibold tracking-[0.08em] text-white/55 uppercase">
        {title}
        {note && <span className="font-normal tracking-normal text-white/40 normal-case">{note}</span>}
      </h3>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </section>
  )
}

// The spell builder (#82): pick a hotbar slot, then its elements, shape and casting type.
// The game pauses while it's open. Changes apply straight away.
export function SpellBuilder() {
  const { builderOpen, spells, activeSlot } = useSyncExternalStore(hud.subscribe, hud.get)
  const [slot, setSlot] = useState(activeSlot)
  const [wasOpen, setWasOpen] = useState(builderOpen)
  if (builderOpen !== wasOpen) {
    setWasOpen(builderOpen)
    if (builderOpen) setSlot(activeSlot) // open on the spell in hand
  }
  const close = () => hud.set({ builderOpen: false })

  useEffect(() => {
    if (!builderOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' || e.key === 'b' || e.key === 'B') { e.preventDefault(); close() } }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [builderOpen])

  if (!builderOpen || !spells.length) return null
  const spell = spells[slot]
  const set = (next: Spell) => spellEdits.push({ slot, spell: next })
  const shape = SHAPES.find((s) => s.id === spell.shape)!
  const cost = spell.cast === 'channeled' ? `${Math.round(channelCost(spell))} mana a second`
    : spell.cast === 'charged' ? `${Math.round(castCost(spell, 0.4))}–${Math.round(castCost(spell, 1.6))} mana, by how long you hold`
    : spell.cast === 'burst' ? `${Math.round(castCost(spell) * 3)} mana for the three shots`
    : spell.cast === 'continuous' ? `${Math.round(castCost(spell))} mana a shot`
    : `${Math.round(castCost(spell))} mana`

  return (
    <div className="absolute inset-0 z-20 flex items-start justify-center overflow-y-auto bg-[#07080c]/70 px-[max(12px,env(safe-area-inset-left))] py-[max(12px,env(safe-area-inset-top))]" onPointerDown={(e) => { if (e.target === e.currentTarget) close() }}>
      <div role="dialog" aria-modal="true" aria-label="Spell builder" className="my-auto flex w-full max-w-[640px] flex-col gap-4 rounded-xl border-2 border-[#2c2f45] bg-[#101119] p-4 text-white shadow-[0_8px_0_#07080c]">
        <header className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Spells</h2>
          <button type="button" onClick={close} className="rounded-md border-2 border-[#2c2f45] bg-[#14151f] px-3 py-1.5 text-[13px] font-semibold hover:border-[#454a6a]">Done</button>
        </header>

        <Section title="Slot">
          {spells.map((_, i) => (
            <Chip key={i} on={i === slot} onClick={() => { setSlot(i); touchInput.pickSlot = i }} label={`Slot ${i + 1}`}>{`${i + 1}`}</Chip>
          ))}
        </Section>

        <Section title="Elements" note={`Up to ${STAND_IN_CAPACITY}: the stand-in catalyst's capacity. Mixed elements react by the world's rules.`}>
          {ELEMENTS.map((e) => (
            <Chip key={e.id} on={spell.elements.includes(e.id)} onClick={() => set(toggleElement(spell, e.id))}>
              <span className="h-2.5 w-2.5 rounded-[2px] border border-black/40" style={{ background: hex(e.colour) }} />
              {e.name}
            </Chip>
          ))}
        </Section>

        <Section title="Shape" note={SHAPE_HELP[spell.shape]}>
          {SHAPES.map((s) => (
            <Chip key={s.id} on={s.id === spell.shape} disabled={!s.types.length} onClick={() => set(withShape(spell, s.id))} label={s.types.length ? undefined : `${s.name}: needs weapons`}>
              {s.name}
            </Chip>
          ))}
        </Section>

        <Section title="Casting" note={CAST_HELP[spell.cast]}>
          {CAST_TYPES.filter((c) => shape.types.includes(c.id)).map((c) => (
            <Chip key={c.id} on={c.id === spell.cast} onClick={() => set({ ...spell, cast: c.id })}>{c.name}</Chip>
          ))}
        </Section>

        <Section title="Trigger" note="Coming next: a trigger sets off a second spell from wherever this one got to.">
          <Chip on disabled onClick={() => {}}>None</Chip>
          {TRIGGERS.map((t) => <Chip key={t.id} on={false} disabled onClick={() => {}}>{t.name}</Chip>)}
        </Section>

        <p className="m-0 rounded-md border border-[#2c2f45] bg-[#14151f] px-3 py-2 text-[13px] text-white/75">
          <strong className="text-white">{spell.elements.map((e) => ELEMENTS.find((x) => x.id === e)!.name).join(' + ')} {shape.name}</strong>, {spell.cast}. Costs {cost}.
        </p>
      </div>
    </div>
  )
}
