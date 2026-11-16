import { expect, test, type Page } from '@playwright/test'

test.skip(({ baseURL }) => !baseURL?.includes('5173'), 'needs the development build')

const water = (page: Page) => page.evaluate(() => {
  const w = window as unknown as { __world: () => { cells: Uint8Array }; __Material: { WATER: number } }
  return w.__world().cells.filter((c) => c === w.__Material.WATER).length
})

test('a water bolt cast with the mouse makes water in the world, and costs mana', async ({ page }) => {
  await page.goto('./')
  await page.waitForFunction(() => typeof (window as unknown as { __magic?: unknown }).__magic === 'function')
  await expect(page.getByRole('button', { name: /Spell 1: Water Projectile/ })).toHaveAttribute('aria-pressed', 'true')
  const before = await water(page)
  await page.mouse.move(700, 300)
  await page.mouse.down()
  await page.waitForTimeout(50)
  await page.mouse.up()
  const mana = await page.evaluate(() => (window as unknown as { __magic: () => { mana: number } }).__magic().mana)
  expect(mana).toBeLessThan(100) // it refills quickly, so check straight away
  await expect.poll(() => water(page), { timeout: 3000 }).toBeGreaterThan(before + 20)
})

test('on a phone, tapping the world casts there, holding channels, and the hotbar picks spells', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true })
  const page = await context.newPage()
  await page.goto('http://localhost:5173/?touch=1')
  await page.waitForFunction(() => typeof (window as unknown as { __magic?: unknown }).__magic === 'function')
  await expect(page.getByRole('slider', { name: 'Aim and cast' })).toHaveCount(0) // no aim stick any more
  await page.getByRole('button', { name: /Spell 4/ }).dispatchEvent('pointerdown')
  await expect(page.getByRole('button', { name: /Spell 4/ })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: /Spell 1/ }).dispatchEvent('pointerdown')

  // A tap on the world above and to the right of the player fires the water bolt there.
  const before = await water(page)
  await page.touchscreen.tap(300, 380)
  await expect.poll(() => water(page), { timeout: 3000 }).toBeGreaterThan(before + 20)

  // Holding a finger on the world channels the Heat Cone (slot 2) for as long as it's down.
  await page.getByRole('button', { name: /Spell 2/ }).dispatchEvent('pointerdown')
  const cdp = await context.newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 60, y: 600 }] })
  await page.waitForTimeout(600)
  const channelling = await page.evaluate(() => (window as unknown as { __magic: () => { mana: number } }).__magic().mana)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  expect(channelling).toBeLessThan(95) // it drained while held
  await context.close()
})
