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

test('on a phone, the aim stick casts on release and the hotbar picks spells', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true })
  const page = await context.newPage()
  await page.goto('http://localhost:5173/?touch=1')
  await page.waitForFunction(() => typeof (window as unknown as { __magic?: unknown }).__magic === 'function')
  await page.getByRole('button', { name: /Spell 4/ }).dispatchEvent('pointerdown')
  await expect(page.getByRole('button', { name: /Spell 4/ })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: /Spell 1/ }).dispatchEvent('pointerdown')

  const before = await water(page)
  const stick = (await page.getByRole('slider', { name: 'Aim and cast' }).boundingBox())!
  const cx = stick.x + stick.width / 2, cy = stick.y + stick.height / 2
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(cx + 40, cy - 40, { steps: 4 })
  await page.waitForTimeout(150)
  expect(await water(page)).toBe(before) // nothing yet: it casts on release
  await page.mouse.up()
  await expect.poll(() => water(page), { timeout: 3000 }).toBeGreaterThan(before + 20)
  await context.close()
})
