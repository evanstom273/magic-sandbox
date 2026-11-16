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

test('walks with the keyboard, jumps and double jumps with squash, stretch, dust and a ring', async ({ page }) => {
  await ready(page)
  const start = await player(page)
  await page.keyboard.down('KeyD')
  await page.waitForTimeout(500)
  await page.keyboard.up('KeyD')
  expect((await player(page)).x).toBeGreaterThan(start.x + 10)

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
  await page.evaluate(() => (window as unknown as { __teleport: (x: number, y: number) => void }).__teleport(225, 30))
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
  expect((await player(page)).shards).toBeGreaterThan(100)
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
