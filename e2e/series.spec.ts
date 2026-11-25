import { expect, test } from './fixtures.ts'

test('a book from Open Library gets its series from Wikidata, with the gaps', async ({ page }) => {
  await page.goto('/search')
  await page.getByRole('searchbox', { name: 'Search Open Library' }).fill('9780593135204')
  await page.getByRole('searchbox', { name: 'Search Open Library' }).press('Enter')
  await expect(page.getByText('Found by ISBN')).toBeVisible()
  await page.getByRole('link', { name: /Project Hail Mary/ }).first().click()
  await expect(page.getByRole('heading', { name: 'Add to library' })).toBeVisible()
  await page.getByRole('button', { name: 'Add to library' }).click()

  const suggestion = page.getByRole('region', { name: 'Part of a series?' })
  await expect(suggestion.getByText('Afdeling Q, book 1')).toBeVisible()
  await suggestion.getByRole('button', { name: 'Add' }).click()
  await page.getByRole('link', { name: 'Afdeling Q #1' }).click()

  await expect(page.getByRole('heading', { name: 'Afdeling Q' })).toBeVisible()
  await expect(page.getByText('0 of 3 read')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Find it: Flaskepost fra P' })).toBeVisible()
})

test('demo series: progress, a complete trilogy and next in series on Home', async ({ page }) => {
  await page.goto('/demo')
  await page.getByRole('button', { name: 'Start demo mode' }).click()
  await expect(page.getByText('Demo mode: sample data')).toBeVisible()

  await page.goto('/series')
  await expect(page.getByRole('link', { name: /Københavnertrilogien.*Series complete/ })).toBeVisible()
  await page.getByRole('link', { name: /Afdeling Q/ }).click()
  await expect(page.getByText('2 of 10 in your library')).toBeVisible()

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Next in series' })).toBeVisible()
})
