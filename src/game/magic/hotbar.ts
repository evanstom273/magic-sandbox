import { elementInfo, shapeInfo, TRIGGERS, type Spell } from './spells.ts'

// The hotbar of four prepared spells (#82). Until the spell builder arrives, it starts with four
// examples, one each of Projectile, Cone, Self and AoE.
export const DEFAULT_HOTBAR: Spell[] = [
  { elements: ['water'], shape: 'projectile', cast: 'instant' },
  { elements: ['heat'], shape: 'cone', cast: 'channeled' },
  { elements: ['force'], shape: 'self', cast: 'channeled' },
  { elements: ['life'], shape: 'aoe', cast: 'charged' },
]

export function describe(spell: Spell) {
  const els = spell.elements.map((e) => elementInfo(e).name).join(' + ')
  const t = spell.trigger
  const then = t ? ` → ${t.then.elements.map((e) => elementInfo(e).name).join(' + ')} ${shapeInfo(t.then.shape).name}` : ''
  const cast = spell.cast[0].toUpperCase() + spell.cast.slice(1)
  return {
    name: `${els} ${shapeInfo(spell.shape).name}${then}`,
    detail: t ? `${cast}, ${TRIGGERS.find((x) => x.id === t.kind)!.name.toLowerCase()}` : cast,
    colours: spell.elements.map((e) => '#' + elementInfo(e).colour.toString(16).padStart(6, '0')),
  }
}
