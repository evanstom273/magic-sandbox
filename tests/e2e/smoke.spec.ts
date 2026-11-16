import { expect, test } from '@playwright/test'

test('the game boots: one canvas filling the window, and no errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })

  await page.goto('./')
  const canvas = page.locator('canvas')
  await expect(canvas.first()).toBeVisible()

  // Let the game run for a while, so anything that throws in a scene shows up.
  await page.evaluate(
    () =>
      new Promise<void>((done) => {
        let frames = 0
        const tick = () => (++frames >= 30 ? done() : requestAnimationFrame(tick))
        requestAnimationFrame(tick)
      }),
  )

  await expect(canvas).toHaveCount(1)
  const box = await canvas.boundingBox()
  const viewport = page.viewportSize()!
  expect(box?.width).toBeCloseTo(viewport.width, 0)
  expect(box?.height).toBeCloseTo(viewport.height, 0)
  expect(errors).toEqual([])
})
