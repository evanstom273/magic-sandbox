/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, test } from 'vitest'
import codex from './codex.json'
import { elementsIn, GUIDE, searchGuide } from './guide.ts'

describe('the in-game guide', () => {
  test('its copy of the codex is up to date with the codex page', () => {
    const { readCodex } = createRequire(import.meta.url)('../../../scripts/codex-to-json.cjs')
    expect(readCodex(readFileSync('docs/element-codex.html', 'utf8'))).toEqual(codex)
  })

  test('it finds which elements a rule is about', () => {
    expect(elementsIn('Lava + water').sort()).toEqual(['lava', 'water'])
    expect(elementsIn('Wood burning with no air (under sand or dirt)').sort()).toEqual(['dirt', 'fire', 'plants', 'sand'])
    expect(elementsIn('Lightning')).toEqual(['lightning']) // not Light
  })

  test('searching an element finds every rule with it, and its card', () => {
    const r = searchGuide('lava')
    expect(r.element?.name).toBe('Lava')
    expect(r.entries.some((e) => e.title === 'Lava + water')).toBe(true)
    expect(r.entries.some((e) => e.title === 'Cold on lava')).toBe(true)
    expect(r.entries.every((e) => e.els.includes('lava'))).toBe(true)
  })

  test('two elements find what they do together', () => {
    const r = searchGuide('lava + water')
    expect(r.entries.map((e) => e.text)).toContain('Obsidian and a burst of steam.')
    expect(searchGuide('shadow + life').entries.map((e) => e.title)).toContain('Shadow + Life')
  })

  test('other words search the text; sections filter', () => {
    expect(searchGuide('obsidian').element?.name).toBe('Obsidian')
    expect(searchGuide('explodes').entries.length).toBeGreaterThan(2)
    expect(searchGuide('', 'spell').entries.every((e) => e.section === 'spell')).toBe(true)
  })

  test('nothing about creatures yet', () => {
    expect(GUIDE.some((e) => /creature/i.test(e.title + e.text))).toBe(false)
  })
})
