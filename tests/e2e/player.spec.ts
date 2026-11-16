import { expect, test, type Page } from '@playwright/test'

// Drives the player through the dev build's window.__player hook (left out of production builds).
test.skip(({ baseURL }) => !baseURL?.includes('5173'), 'needs the development build')

type P = { x: number; y: number; grounded: boolean; sx: number; sy: number; dust: number }
const player = (page: Page) => page.evaluate(() => (window as unknown as { __player: () => P }).__player())

async function settle(page: Page) {
  await page.goto('./')
  await page.waitForFunction(() => typeof (window as unknown as { __player?: unknown }).__player === 'function')
  await expect.poll(async () => (await player(page)).grounded).toBe(true)
}

test('walks with the keyboard and jumps with squash, stretch and dust', async ({ page }) => {
  await settle(page)
  const start = await player(page)
  await page.keyboard.down('KeyD')
  await page.waitForTimeout(500)
  await page.keyboard.up('KeyD')
  expect((await player(page)).x).toBeGreaterThan(start.x + 10)

  await page.keyboard.down('Space')
  await expect.poll(async () => (await player(page)).sy).toBeGreaterThan(1.05)
  await expect.poll(async () => (await player(page)).dust).toBeGreaterThan(0)
  await page.waitForTimeout(250)
  await page.keyboard.up('Space')
  await expect.poll(async () => (await player(page)).grounded, { timeout: 3000 }).toBe(true)
})

test('touch buttons move and jump on a phone-sized screen', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true })
  const page = await context.newPage()
  await page.goto('http://localhost:5173/?touch=1')
  await page.waitForFunction(() => typeof (window as unknown as { __player?: unknown }).__player === 'function')
  await expect.poll(async () => (await player(page)).grounded).toBe(true)
  const start = await player(page)
  const right = page.getByRole('button', { name: 'Move right' })
  const box = (await right.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(400)
  await page.mouse.up()
  expect((await player(page)).x).toBeGreaterThan(start.x + 8)
  await page.getByRole('button', { name: 'Jump' }).dispatchEvent('pointerdown', { pointerId: 2 })
  await expect.poll(async () => (await player(page)).grounded).toBe(false)
  await page.getByRole('button', { name: 'Jump' }).dispatchEvent('pointerup', { pointerId: 2 })
  await context.close()
})
