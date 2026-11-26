import { expect, test } from './fixtures.ts'

test('the beagle trots on and barks when I add a book', async ({ page }) => {
  await page.goto('/add/manual')
  await page.getByLabel('Title', { exact: true }).fill('Kongens Fald')
  await page.getByLabel('Author').fill('Johannes V. Jensen')
  await page.getByRole('button', { name: /Save|Add/ }).last().click()

  await expect(page.getByRole('heading', { name: 'Kongens Fald' })).toBeVisible()
  const beagle = page.getByTestId('barking-beagle')
  await expect(beagle.locator('[data-phase="in"]')).toBeAttached()
  await expect(beagle.getByText('Woof!')).toBeVisible()
  // It never gets in the way: it takes no taps and trots off by itself.
  await expect(beagle).toHaveCSS('pointer-events', 'none')
  await expect(beagle).toHaveCount(0, { timeout: 6000 })
})

test('the bark sound can be turned off in Profile', async ({ page }) => {
  await page.goto('/profile')
  const toggle = page.getByRole('switch', { name: 'Bark when I add a book' })
  await expect(toggle).toBeChecked()
  await toggle.uncheck()
  await page.reload()
  await expect(page.getByRole('switch', { name: 'Bark when I add a book' })).not.toBeChecked()
})

test('with reduced motion the beagle just appears and barks', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/add/manual')
  await page.getByLabel('Title', { exact: true }).fill('Kongens Fald')
  await page.getByLabel('Author').fill('Johannes V. Jensen')
  await page.getByRole('button', { name: /Save|Add/ }).last().click()
  const beagle = page.getByTestId('barking-beagle')
  await expect(beagle.locator('.barker-still')).toBeAttached()
  await expect(beagle.getByText('Woof!')).toBeVisible()
  await expect(beagle).toHaveCount(0, { timeout: 4000 })
})
