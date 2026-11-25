import { expect, test } from './fixtures.ts'

test('demo mode fills the stats and leaves my library alone', async ({ page }) => {
  // A book of my own, which demo mode must not touch.
  await page.goto('/add/manual')
  await page.getByLabel('Title', { exact: true }).fill('Kongens Fald')
  await page.getByLabel('Author').fill('Johannes V. Jensen')
  await page.getByRole('button', { name: /Save|Add/ }).last().click()
  await expect(page.getByRole('heading', { name: 'Kongens Fald' })).toBeVisible()

  await page.goto('/demo')
  await page.getByRole('button', { name: 'Start demo mode' }).click()
  await expect(page.getByText('Demo mode: sample data')).toBeVisible()

  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Library' }).click()
  await expect(page.getByText('Kongens Fald')).toHaveCount(0)
  await expect(page.getByText(/^\d+ books$/)).toBeVisible()

  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Stats' }).click()
  await page.getByLabel('Period').selectOption('all')
  for (const section of ['Overview', 'Reading habits', 'What I read', 'My library', 'Fun extras'])
    await expect(page.getByRole('heading', { name: section })).toBeVisible()
  // Charts draw themselves once they scroll into view.
  await page.getByRole('heading', { name: 'Books per month' }).scrollIntoViewIfNeeded()
  await expect(page.getByRole('heading', { name: 'Books per month' })).toBeVisible()
  await expect(page.locator('.recharts-surface').first()).toBeVisible()

  // Every chart offers its numbers as a table.
  await page.getByText('Show as table').first().click()
  await expect(page.getByRole('table').first()).toBeVisible()

  // The danger zone can't touch anything in demo mode.
  await page.goto('/profile')
  await expect(page.getByRole('region', { name: 'Danger zone' }).getByText('You are in demo mode.', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Delete all my data…' })).toHaveCount(0)

  // Leaving demo mode from the banner brings my own library back.
  await page.getByRole('status').filter({ hasText: 'Demo mode: sample data' }).getByRole('button', { name: 'Leave demo mode' }).click()
  await expect(page.getByText('Demo mode: sample data')).toHaveCount(0)
  await page.goto('/library')
  await expect(page.getByText('Kongens Fald')).toBeVisible()
})

test('year in review steps through cards and saves an image', async ({ page }, testInfo) => {
  await page.goto('/demo')
  await page.getByRole('button', { name: 'Start demo mode' }).click()
  await expect(page.getByText('Demo mode: sample data')).toBeVisible()

  const year = new Date().getFullYear() - 1
  await page.goto('/stats')
  await page.getByRole('link', { name: `${year} in books` }).click()

  const dialog = page.getByRole('dialog', { name: `${year} in books` })
  await expect(dialog.getByRole('heading', { name: `Your ${year} in books` })).toBeVisible()
  const progress = dialog.getByText(/^Card 1 of \d+$/)
  const total = Number((await progress.textContent())!.match(/of (\d+)/)![1])
  expect(total).toBeGreaterThan(3)

  await dialog.getByRole('button', { name: 'Next' }).click()
  await expect(dialog.getByRole('heading', { name: 'By the numbers' })).toBeVisible()
  await page.keyboard.press('ArrowLeft')
  await expect(dialog.getByText('Card 1 of')).toBeAttached()
  for (let i = 1; i < total; i++) await page.keyboard.press('ArrowRight')
  await expect(dialog.getByRole('heading', { name: 'That was your year' })).toBeVisible()

  // Desktop Chromium has no share sheet for files, so the image downloads.
  const downloading = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'Save as image' }).click()
  const download = await downloading
  expect(download.suggestedFilename()).toBe(`readhound-${year}.png`)
  await download.saveAs(testInfo.outputPath('review.png'))
  await expect(dialog.getByText('Image saved.')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(/\/stats$/)
})
