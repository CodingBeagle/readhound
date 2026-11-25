import { expect, test } from './fixtures.ts'

test('find a book, add the edition I own and log reading', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Nothing on the go')).toBeVisible()

  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Search' }).click()
  await page.getByRole('searchbox', { name: 'Search Open Library' }).fill('Froken Smilla')
  await page.getByRole('searchbox', { name: 'Search Open Library' }).press('Enter')
  await page.getByRole('link', { name: /Frøken Smillas fornemmelse for sne/ }).first().click()

  await expect(page.getByRole('heading', { name: 'Choose your edition' })).toBeVisible()
  // Danish editions come first, because Danish is a preferred language.
  await page.getByRole('link', { name: /Rosinante · 1992 · 435 pages/ }).click()

  await expect(page.getByRole('heading', { name: 'Add to library' })).toBeVisible()
  await page.getByLabel('Status').selectOption('reading')
  await page.getByRole('button', { name: 'Add to library' }).click()

  await expect(page.getByRole('heading', { name: 'Frøken Smillas fornemmelse for sne' })).toBeVisible()
  await page.getByLabel('I’m on page').fill('100')
  await page.getByRole('button', { name: 'Log', exact: true }).click()
  await expect(page.getByText('Logged 100 pages.')).toBeVisible()

  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Home' }).click()
  await expect(page.getByText('Frøken Smillas fornemmelse for sne')).toBeVisible()
  await expect(page.getByText('Page 100 of 435')).toBeVisible()
  await expect(page.getByText('1-day reading streak')).toBeVisible()
})

test('add a book by hand and finish it', async ({ page }) => {
  await page.goto('/search')
  await page.getByRole('searchbox', { name: 'Search Open Library' }).fill('nothing matches this')
  await page.getByRole('searchbox', { name: 'Search Open Library' }).press('Enter')
  await expect(page.getByText('No books found for “nothing matches this”.')).toBeVisible()
  await page.getByRole('link', { name: 'Add manually' }).first().click()

  await expect(page.getByRole('heading', { name: 'Add a book manually' })).toBeVisible()
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('nothing matches this')
  await page.getByLabel('Title', { exact: true }).fill('Kongens Fald')
  await page.getByLabel('Author').fill('Johannes V. Jensen')
  await page.getByLabel('Page count').fill('250')
  await page.getByRole('button', { name: /Save|Add/ }).last().click()

  await expect(page.getByRole('heading', { name: 'Kongens Fald' })).toBeVisible()
  const status = page.getByRole('group', { name: 'Status' })
  await expect(status.getByRole('button', { name: 'To read' })).toHaveAttribute('aria-pressed', 'true')

  // Finishing a book that was never started asks when it was read.
  await status.getByRole('button', { name: 'Finished' }).click()
  await expect(page.getByText('When did you read it?')).toBeVisible()
  await page.getByLabel('Finished', { exact: true }).fill('2026-01-20')
  await page.getByLabel('Started', { exact: true }).fill('2026-01-05')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(status.getByRole('button', { name: 'Finished' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText(/, finished$/)).toBeVisible()
  await page.getByLabel('Rating').selectOption('4.5')

  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Library' }).click()
  await expect(page.getByText('1 book')).toBeVisible()
  await expect(page.getByText('Kongens Fald')).toBeVisible()

  // The finished read counts its page count in the stats.
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Stats' }).click()
  await page.getByLabel('Period').selectOption('all')
  await expect(page.getByText('Books read').first()).toBeVisible()
})
