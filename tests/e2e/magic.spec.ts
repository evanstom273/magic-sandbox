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

test('on a phone, the move stick, Jump and the hotbar move, jump and pick without casting', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true })
  const page = await context.newPage()
  await page.goto('http://localhost:5173/?touch=1')
  await page.waitForFunction(() => typeof (window as unknown as { __magic?: unknown }).__magic === 'function')
  const magic = () => page.evaluate(() => (window as unknown as { __magic: () => { mana: number; projectiles: number } }).__magic())
  const player = () => page.evaluate(() => (window as unknown as { __player: () => { x: number } }).__player())
  const before = await water(page)
  const startX = (await player()).x
  const cdp = await context.newCDPSession(page)
  const stick = (await page.getByRole('slider', { name: 'Move' }).boundingBox())!
  const sx = stick.x + stick.width / 2, sy = stick.y + stick.height / 2
  // Hold the move stick to the right: the player walks, and nothing is cast.
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx, y: sy }] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sx + 45, y: sy }] })
  await page.waitForTimeout(500)
  expect((await magic()).projectiles).toBe(0)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  expect((await player()).x).toBeGreaterThan(startX + 8)
  // Tap Jump and a hotbar slot: still nothing cast.
  const jump = (await page.getByRole('button', { name: 'Jump' }).boundingBox())!
  await page.touchscreen.tap(jump.x + jump.width / 2, jump.y + jump.height / 2)
  const slot = (await page.getByRole('button', { name: /Spell 1/ }).boundingBox())!
  await page.touchscreen.tap(slot.x + slot.width / 2, slot.y + slot.height / 2)
  await page.waitForTimeout(500)
  expect((await magic()).mana).toBe(100)
  expect(await water(page)).toBe(before)
  await context.close()
})

test('on desktop, clicking the hotbar or the Spells button doesn\'t cast', async ({ page }) => {
  await page.goto('./')
  await page.waitForFunction(() => typeof (window as unknown as { __magic?: unknown }).__magic === 'function')
  // Press and hold on a hotbar slot, then on the Spells button: long enough that a press on the world would cast.
  for (const name of [/Spell 1/, /^Spells$/]) {
    const box = (await page.getByRole('button', { name }).boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.waitForTimeout(300)
    await page.mouse.up()
    await page.keyboard.press('Escape') // in case it opened the builder
  }
  await page.waitForTimeout(200)
  expect(await page.evaluate(() => (window as unknown as { __magic: () => { mana: number } }).__magic().mana)).toBe(100)
})

test('a trigger built in the builder: a water bolt that waits, then sets off heat on recast', async ({ page }) => {
  await page.goto('./')
  await page.waitForFunction(() => typeof (window as unknown as { __anchors?: unknown }).__anchors === 'function')
  await page.getByRole('button', { name: 'Spells' }).dispatchEvent('pointerdown')
  const builder = page.getByRole('dialog', { name: 'Spell builder' })
  await builder.getByRole('button', { name: 'Slot 1' }).click()
  await builder.getByRole('button', { name: 'On recast' }).click()
  await builder.getByRole('button', { name: 'Then Heat' }).click()
  await builder.getByRole('button', { name: 'Then Water' }).click() // leave just Heat
  await expect(builder).toContainText('on recast, then Heat AoE')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: /Spell 1: Water Projectile → Heat AoE/ })).toBeVisible()

  const anchors = () => page.evaluate(() => (window as unknown as { __anchors: () => number }).__anchors())
  await page.mouse.move(700, 300)
  await page.mouse.down(); await page.waitForTimeout(50); await page.mouse.up()
  await expect.poll(anchors, { timeout: 3000 }).toBe(1) // landed, waiting
  await page.waitForTimeout(400)
  await page.mouse.down(); await page.waitForTimeout(50); await page.mouse.up()
  await expect.poll(anchors).toBe(0) // set off
  expect(await page.evaluate(() => (window as unknown as { __magic: () => { projectiles: number } }).__magic().projectiles)).toBe(0) // and no second bolt
})

test('the builder\'s element search and filters', async ({ page }) => {
  await page.goto('./')
  await page.waitForFunction(() => typeof (window as unknown as { __magic?: unknown }).__magic === 'function')
  await page.getByRole('button', { name: 'Spells' }).dispatchEvent('pointerdown')
  const builder = page.getByRole('dialog', { name: 'Spell builder' })
  await builder.getByRole('button', { name: 'Slot 1' }).click()
  const search = builder.getByRole('searchbox', { name: 'Search elements', exact: true })
  await search.pressSequentially('bone') // the b typed here mustn't close the builder
  await expect(builder).toBeVisible()
  await expect(builder.getByRole('button', { name: 'Bone', exact: true })).toBeVisible()
  await expect(builder.getByRole('button', { name: 'Water', exact: true })).toHaveCount(0)
  await search.press('Escape') // clears the search first
  await expect(search).toHaveValue('')
  await expect(builder).toBeVisible()

  const show = builder.getByRole('group', { name: 'Show elements', exact: true })
  await show.getByRole('button', { name: /^Liquids/ }).click()
  await expect(builder.getByRole('button', { name: 'Lava', exact: true })).toBeVisible()
  await expect(builder.getByRole('button', { name: 'Sand', exact: true })).toHaveCount(0)
  await builder.getByRole('button', { name: 'Lava', exact: true }).click()
  await show.getByRole('button', { name: /^Picked/ }).click()
  await expect(builder.getByRole('button', { name: 'Water', exact: true })).toBeVisible()
  await expect(builder.getByRole('button', { name: 'Lava', exact: true })).toBeVisible()
  await expect(builder.getByRole('button', { name: 'Oil', exact: true })).toHaveCount(0)

  await search.press('Escape') // with the search empty, Escape closes the builder
  await expect(builder).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Spell 1: Water \+ Lava Projectile/ })).toBeVisible()
})
