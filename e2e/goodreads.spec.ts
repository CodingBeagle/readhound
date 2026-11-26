import { fileURLToPath } from 'node:url'

import { expect, test } from './fixtures.ts'

const SAMPLE = fileURLToPath(new URL('../src/domain/__fixtures__/goodreads_library_export.csv', import.meta.url))

test('import a Goodreads export: preview, duplicates, progress and the imported library', async ({ page }) => {
  // Open Library is asked about one book a second.
  test.setTimeout(120_000)

  // One book is in the library already, under a slightly different spelling.
  await page.goto('/add/manual')
  await page.getByLabel('Title', { exact: true }).fill('Kongens fald')
  await page.getByLabel('Author').fill('Johannes V. Jensen')
  await page.getByRole('button', { name: /Save|Add/ }).last().click()
  await expect(page.getByRole('heading', { name: 'Kongens fald' })).toBeVisible()

  await page.goto('/profile')
  await page.getByRole('link', { name: 'Import from Goodreads' }).click()
  await expect(page.getByRole('heading', { name: 'Import from Goodreads' })).toBeVisible()

  await page.getByLabel('Goodreads export file').setInputFiles(SAMPLE)
  await expect(page.getByText('7 books in the file')).toBeVisible()
  await expect(page.getByText('Imports 6 books')).toBeVisible()
  await expect(page.getByText('Finished: 4')).toBeVisible()
  await expect(page.getByText('Did not finish: 1')).toBeVisible()
  await expect(page.getByText('5 finished reads, 1 of them rereads')).toBeVisible()
  await expect(page.getByText('Shelves that become lists: Danske klassikere')).toBeVisible()
  await page.getByText('1 book is already in your library and will be skipped').click()
  await expect(page.getByRole('link', { name: 'Kongens Fald' })).toBeVisible()
  await expect(page.getByLabel('Match books on Open Library')).toBeChecked()

  await page.getByRole('button', { name: 'Import 6 books' }).click()
  await expect(page.getByRole('progressbar')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Import done' })).toBeVisible({ timeout: 100_000 })
  await expect(page.getByText('6 books imported')).toBeVisible()
  await expect(page.getByText('1 matched on Open Library')).toBeVisible()
  await expect(page.getByText('5 added from the Goodreads details')).toBeVisible()

  // The matched book has its Goodreads rating, status and reread.
  await page.getByRole('link', { name: 'Open library' }).click()
  await expect(page.getByText('The Way of Kings')).toBeVisible()
  await page.getByRole('link', { name: /Project Hail Mary/ }).first().click()
  await expect(page.getByRole('heading', { name: 'Project Hail Mary' })).toBeVisible()
  await expect(page.getByText('Loved every page.', { exact: false })).toBeVisible()

  // The DNF shelf became the DNF pile.
  await page.goto('/library?status=dnf')
  await expect(page.getByText('The Silmarillion')).toBeVisible()
})

test('a file that is not a Goodreads export is refused', async ({ page }, testInfo) => {
  const file = testInfo.outputPath('not-goodreads.csv')
  await (await import('node:fs/promises')).writeFile(file, 'Title,Author\nX,Y\n')
  await page.goto('/import/goodreads')
  await page.getByLabel('Goodreads export file').setInputFiles(file)
  await expect(page.getByRole('alert')).toContainText('This is not a Goodreads library export')
})
