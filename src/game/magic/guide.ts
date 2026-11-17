import codex from './codex.json'

// The in-game guide to combining elements (#85), read from the Element Codex (its copy in
// codex.json, made by scripts/codex-to-json.cjs). What happens when materials meet, what each force
// does to each material, and what mixing does in a spell. Rules about things not in the game yet
// (creatures, the world's sources of elements) are left out until they are.

export interface CodexElement { id: string; name: string; kind: string; colour: string; world: string; cast: string; draw: string }
export type GuideSection = 'meet' | 'force' | 'spell'
export interface GuideEntry { section: GuideSection; title: string; text: string; els: string[] }

export const CODEX_ELEMENTS: CodexElement[] = codex.elements
export const SECTIONS: { id: GuideSection; name: string }[] = [
  { id: 'meet', name: 'When materials meet' },
  { id: 'force', name: 'Forces on materials' },
  { id: 'spell', name: 'In a spell' },
]

/** The words the codex uses for each element, where its name alone won't find it. */
const WORDS: Record<string, string[]> = {
  plants: ['wood', 'plants', 'plant', 'moss', 'trees'],
  rot: ['rot', 'miasma'],
  mana: ['liquid mana', 'mana'],
  swampgas: ['swamp gas'],
  molten: ['molten metal', 'molten'],
  honey: ['honey', 'sap'],
  fire: ['fire', 'flame', 'flames', 'burning', 'burns'],
  heat: ['heat', 'hot'],
  ice: ['ice'],
  ectoplasm: ['ectoplasm'],
  spores: ['spores', 'spore'],
  seeds: ['seeds', 'seed'],
  bone: ['bone', 'bones'],
  lightning: ['lightning', 'spark'],
}
const wordsFor = (e: CodexElement) => WORDS[e.id] ?? [e.name.toLowerCase()]
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const PATTERNS = CODEX_ELEMENTS.map((e) => ({ id: e.id, re: new RegExp(`\\b(${wordsFor(e).map(escape).join('|')})\\b`, 'i') }))

/** Which elements a piece of the codex's text is about. */
export function elementsIn(text: string): string[] {
  return PATTERNS.filter((p) => p.re.test(text)).map((p) => p.id)
}

/** Rules about what isn't in the game yet. */
const NOT_YET = /creature|storm crystal|life spring/i

/** The force grid's columns, as elements (Creatures aren't in the game yet). */
const COLUMN: Record<string, string | undefined> = {
  Water: 'water', Oil: 'oil', Lava: 'lava', Acid: 'acid', Sand: 'sand', Stone: 'stone', Gunpowder: 'gunpowder',
  Metal: 'metal', 'Wood and plants': 'plants', Ice: 'ice', Steam: 'steam',
}

/** What mixing does in a spell (the game's own rules, in elements.ts `mix`, from the codex). */
const SPELL: GuideEntry[] = [
  { section: 'spell', title: 'Life + Decay', text: 'They cancel where they meet: a spell of both fizzles.', els: ['life', 'decay'] },
  { section: 'spell', title: 'Light + Shadow', text: 'They cancel where they meet.', els: ['light', 'shadow'] },
  { section: 'spell', title: 'Shadow + Life', text: 'Ectoplasm, instead of either.', els: ['shadow', 'life', 'ectoplasm'] },
  { section: 'spell', title: 'Heat + Lightning', text: 'Plasma as well, where they land together.', els: ['heat', 'lightning', 'plasma'] },
  { section: 'spell', title: 'Time + Life', text: 'Time speeds the world up where it lands, instead of slowing it: things grow, age and rot.', els: ['time', 'life'] },
  { section: 'spell', title: 'Any two elements', text: 'Both act where the spell lands, and then the world takes over: what they make meets what\'s there by the rules below.', els: [] },
]

const byId = (id: string) => CODEX_ELEMENTS.find((e) => e.id === id)!

export const GUIDE: GuideEntry[] = [
  ...SPELL,
  ...codex.contacts.filter(([a, b]) => !NOT_YET.test(a + b)).map(([a, b]): GuideEntry => ({ section: 'meet', title: a, text: b, els: elementsIn(a) })),
  ...Object.entries(codex.forces as Record<string, string[]>).flatMap(([force, row]) =>
    row.flatMap((text, i): GuideEntry[] => {
      const material = COLUMN[codex.columns[i]]
      if (!text || !material) return []
      return [{ section: 'force', title: `${byId(force).name} on ${codex.columns[i].toLowerCase()}`, text, els: [force, material] }]
    })),
]

/** An element a search term names (by its name, or the words the codex uses for it), if any. */
export function elementNamed(term: string): CodexElement | undefined {
  const t = term.trim().toLowerCase()
  if (!t) return undefined
  return CODEX_ELEMENTS.find((e) => e.name.toLowerCase() === t || e.id === t || wordsFor(e).includes(t))
    ?? CODEX_ELEMENTS.find((e) => e.name.toLowerCase().startsWith(t))
}

/**
 * Searching the guide. A query naming elements ("lava", "lava + water") finds every rule with all of
 * them in it, and shows the first one's card; anything else searches the rules' words.
 */
export function searchGuide(query: string, section?: GuideSection): { element?: CodexElement; entries: GuideEntry[] } {
  const inSection = section ? GUIDE.filter((g) => g.section === section) : GUIDE
  const terms = query.split('+').map((t) => t.trim()).filter(Boolean)
  if (!terms.length) return { entries: inSection }
  const named = terms.map(elementNamed)
  if (named.every(Boolean)) {
    const ids = named.map((e) => e!.id)
    return { element: named[0], entries: inSection.filter((g) => ids.every((id) => g.els.includes(id))) }
  }
  const q = query.trim().toLowerCase()
  return { entries: inSection.filter((g) => (g.title + ' ' + g.text).toLowerCase().includes(q)) }
}
