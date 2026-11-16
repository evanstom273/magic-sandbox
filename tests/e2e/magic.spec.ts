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

test('the spell builder changes a hotbar spell, and the game pauses while it is open', async ({ page }) => {
  await page.goto('./')
  await page.waitForFunction(() => typeof (window as unknown as { __magic?: unknown }).__magic === 'function')
  await page.getByRole('button', { name: 'Spells' }).dispatchEvent('pointerdown')
  const builder = page.getByRole('dialog', { name: 'Spell builder' })
  await expect(builder).toBeVisible()
  const frozen = await page.evaluate(() => (window as unknown as { __player: () => { y: number } }).__player().y)

  // Slot 1: Cold + Water Wave, charged.
  await builder.getByRole('button', { name: 'Slot 1' }).click()
  await builder.getByRole('button', { name: 'Cold' }).click()
  await builder.getByRole('button', { name: 'Wave', exact: true }).click()
  await builder.getByRole('button', { name: 'Charged' }).click()
  await expect(builder.getByRole('button', { name: 'Weapon enchantment: needs weapons' })).toBeDisabled()
  await expect(builder).toContainText('Water + Cold Wave, charged')
  expect(await page.evaluate(() => (window as unknown as { __player: () => { y: number } }).__player().y)).toBe(frozen)

  await page.keyboard.press('Escape')
  await expect(builder).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Spell 1: Water \+ Cold Wave, Charged/ })).toBeVisible()

  // B opens it again, and closes it.
  await page.keyboard.press('KeyB')
  await expect(builder).toBeVisible()
  await page.keyboard.press('KeyB')
  await expect(builder).toHaveCount(0)
})

test('dummies react to the new shapes: a Cold Target freezes one', async ({ page }) => {
  await page.goto('./')
  await page.waitForFunction(() => typeof (window as unknown as { __dummies?: unknown }).__dummies === 'function')
  await page.evaluate(() => {
    const w = window as unknown as { __setSpell: (i: number, s: unknown) => void; __teleport: (x: number, y: number) => void }
    w.__setSpell(0, { elements: ['cold'], shape: 'target', cast: 'instant' })
    w.__teleport(70, 150)
  })
  await page.waitForTimeout(600)
  const at = await page.evaluate(() => (window as unknown as { __dummies: () => { x: number; y: number }[] }).__dummies()[0])
  const canvas = (await page.locator('canvas').boundingBox())!
  // Sweep the aim along the floor until it lands on the dummy.
  let frozen = false
  for (let i = 0; i < 12 && !frozen; i++) {
    await page.mouse.move(canvas.x + canvas.width * (0.3 + i * 0.05), canvas.y + canvas.height * 0.83)
    await page.mouse.down()
    await page.mouse.up()
    await page.waitForTimeout(120)
    frozen = (await page.evaluate(() => (window as unknown as { __dummies: () => { frozen: number }[] }).__dummies()[0].frozen)) > 0
  }
  expect(frozen, `dummy at ${at.x},${at.y}`).toBe(true)
})
