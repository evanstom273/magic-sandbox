import { expect, test, type Page } from '@playwright/test'

// Drives the player through the dev build's window.__player hook (left out of production builds).
test.skip(({ baseURL }) => !baseURL?.includes('5173'), 'needs the development build')

type P = { x: number; y: number; vy: number; grounded: boolean; airJumps: number; sx: number; sy: number; dust: number; rings: number; health: number; marks: number; mode: string; shards: number }
const player = (page: Page) => page.evaluate(() => (window as unknown as { __player: () => P }).__player())

async function ready(page: Page, url = './') {
  await page.goto(url)
  await page.waitForFunction(() => typeof (window as unknown as { __player?: unknown }).__player === 'function')
  await expect.poll(async () => (await player(page)).grounded).toBe(true)
}

test('jumps and double jumps with squash, stretch, dust and a ring, then walks with the keyboard', async ({ page }) => {
  await ready(page)
  // Jump in the open by the start, clear of the low ledge's underside.
  await page.keyboard.down('Space')
  await expect.poll(async () => (await player(page)).sy).toBeGreaterThan(1.05)
  await expect.poll(async () => (await player(page)).dust).toBeGreaterThan(0)
  await page.waitForTimeout(200)
  await page.keyboard.up('Space')
  await page.waitForTimeout(80)
  await page.keyboard.down('Space')
  await expect.poll(async () => (await player(page)).airJumps).toBe(0)
  await expect.poll(async () => (await player(page)).rings).toBeGreaterThan(0)
  await page.keyboard.up('Space')
  await expect.poll(async () => (await player(page)).grounded, { timeout: 4000 }).toBe(true)

  const start = await player(page)
  await page.keyboard.down('KeyD')
  await page.waitForTimeout(500)
  await page.keyboard.up('KeyD')
  expect((await player(page)).x).toBeGreaterThan(start.x + 10)
})

test('the thumbstick and Jump button work on a phone-sized screen', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true })
  const page = await context.newPage()
  await ready(page, 'http://localhost:5173/?touch=1')
  const start = await player(page)
  const stick = (await page.getByRole('slider', { name: 'Move' }).boundingBox())!
  const cx = stick.x + stick.width / 2, cy = stick.y + stick.height / 2
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(cx + 60, cy, { steps: 4 })
  await page.waitForTimeout(400)
  await page.mouse.up()
  expect((await player(page)).x).toBeGreaterThan(start.x + 8)

  const jump = page.getByRole('button', { name: 'Jump' })
  await jump.dispatchEvent('pointerdown', { pointerId: 7 })
  await expect.poll(async () => (await player(page)).grounded).toBe(false)
  await jump.dispatchEvent('pointerup', { pointerId: 7 })
  await expect(page.getByRole('button', { name: 'Grab' })).toHaveCount(0)
  await context.close()
})

test('a long fall hurts, dents the body and shows on the bar; the rest spot heals it', async ({ page }) => {
  await ready(page)
  const bar = page.getByRole('meter', { name: 'Health' })
  await expect(bar).toHaveAttribute('aria-valuenow', '100')
  await page.evaluate(() => (window as unknown as { __teleport: (x: number, y: number) => void }).__teleport(303, 30))
  await expect.poll(async () => (await player(page)).health, { timeout: 4000 }).toBeLessThan(100)
  const hurt = await player(page)
  expect(hurt.health).toBeGreaterThan(0)
  expect(hurt.marks).toBe(1)
  await expect.poll(async () => Number(await bar.getAttribute('aria-valuenow'))).toBe(Math.round(hurt.health))

  await page.evaluate(() => (window as unknown as { __teleport: (x: number, y: number) => void }).__teleport(137, 150))
  await expect.poll(async () => (await player(page)).health, { timeout: 5000 }).toBe(100)
  expect((await player(page)).marks).toBe(0)
})

test('at zero health the body shatters, the game waits for Jump, then the player gathers back at the start', async ({ page }) => {
  await ready(page)
  await page.keyboard.down('KeyD')
  await page.waitForTimeout(400)
  await page.keyboard.up('KeyD')
  await page.evaluate(() => (window as unknown as { __hurt: (n: number) => void }).__hurt(100))
  await expect.poll(async () => (await player(page)).mode).toBe('dying')
  expect((await player(page)).shards).toBeGreaterThan(60)
  const prompt = page.getByRole('status')
  await expect(prompt).toHaveText('Press Jump to continue', { timeout: 3000 })
  await page.waitForTimeout(500)
  expect((await player(page)).mode).toBe('dead') // it waits

  await page.keyboard.press('Space')
  await expect(prompt).toHaveCount(0)
  await expect.poll(async () => (await player(page)).mode).toBe('alive')
  const back = await player(page)
  expect(back.health).toBe(100)
  expect(back.x).toBeCloseTo(30, 0)
})

test('standing in liquid mana soaks the pool up into your mana; lava eats the body away', async ({ page }) => {
  await page.goto('./')
  await page.waitForFunction(() => typeof (window as unknown as { __health?: unknown }).__health === 'function')
  type W = { __world: () => { get(x: number, y: number): number; set(x: number, y: number, m: number): void; cells: Uint8Array }; __Material: Record<string, number>; __player: () => { x: number; y: number }; __setMana(n: number): void; __health: () => { value: number; marks: string[] } }
  const pool = () => page.evaluate(() => { const w = window as unknown as W; return w.__world().cells.filter((c) => c === w.__Material.MANA).length })
  await page.evaluate(() => {
    const w = window as unknown as W, g = w.__world(), M = w.__Material, p = w.__player()
    for (let y = Math.floor(p.y) - 14; y < Math.floor(p.y); y++) {
      for (let x = Math.floor(p.x) - 15; x < Math.floor(p.x) + 15; x++) if (g.get(x, y) === M.EMPTY || g.get(x, y) === M.PLANT) g.set(x, y, M.MANA)
    }
    w.__setMana(5)
  })
  const before = await pool()
  expect(before).toBeGreaterThan(200)
  await expect.poll(pool, { timeout: 3000 }).toBeLessThan(before - 40) // soaked up

  await page.evaluate(() => {
    const w = window as unknown as W, g = w.__world(), M = w.__Material, p = w.__player()
    for (let y = Math.floor(p.y) - 3; y < Math.floor(p.y); y++) for (let x = Math.floor(p.x) - 7; x < Math.floor(p.x) + 7; x++) g.set(x, y, M.LAVA)
  })
  await expect.poll(() => page.evaluate(() => (window as unknown as W).__health().marks), { timeout: 3000 }).toContain('burn')
  expect(await page.evaluate(() => (window as unknown as W).__health().value)).toBeLessThan(100)
})

test('the cheat menu: invulnerable and infinite mana', async ({ page }) => {
  await page.goto('./')
  await page.waitForFunction(() => typeof (window as unknown as { __hurt?: unknown }).__hurt === 'function')
  type W = { __hurt(n: number): void; __health: () => { value: number }; __magic: () => { mana: number }; __setMana(n: number): void }
  await page.getByRole('button', { name: 'Cheats' }).dispatchEvent('pointerdown')
  const menu = page.getByRole('dialog', { name: 'Cheats' })
  await menu.getByRole('switch', { name: 'Invulnerable' }).click()
  await expect(menu.getByRole('switch', { name: 'Invulnerable' })).toHaveAttribute('aria-checked', 'true')
  await menu.getByRole('switch', { name: 'Infinite mana' }).click()
  await page.keyboard.press('c') // C closes it
  await expect(menu).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Cheats, on: Invulnerable, Infinite mana' })).toBeVisible() // lit up

  await page.evaluate(() => (window as unknown as W).__hurt(60))
  expect(await page.evaluate(() => (window as unknown as W).__health().value)).toBe(100)
  expect(await page.evaluate(() => (window as unknown as W).__magic().mana)).toBe(100) // topped up
  await page.mouse.move(700, 300)
  for (let i = 0; i < 5; i++) { await page.mouse.down(); await page.waitForTimeout(40); await page.mouse.up(); await page.waitForTimeout(60) }
  expect(await page.evaluate(() => (window as unknown as W).__magic().mana)).toBe(100) // casting spends nothing

  await page.keyboard.press('c') // C opens it too
  await menu.getByRole('switch', { name: 'Invulnerable' }).click()
  await menu.getByRole('button', { name: 'Done' }).click()
  await page.evaluate(() => (window as unknown as W).__hurt(30))
  expect(await page.evaluate(() => (window as unknown as W).__health().value)).toBe(70)
})

test('menu keys open and close their menus again and again', async ({ page }) => {
  await page.goto('./')
  await page.waitForFunction(() => typeof (window as unknown as { __hurt?: unknown }).__hurt === 'function')
  for (const [key, name] of [['c', 'Cheats'], ['g', 'Guide'], ['b', 'Spell builder']]) {
    const menu = page.getByRole('dialog', { name })
    for (let i = 0; i < 2; i++) {
      await page.keyboard.press(key)
      await expect(menu).toBeVisible()
      await page.keyboard.press(key)
      await expect(menu).toHaveCount(0)
    }
  }
})
