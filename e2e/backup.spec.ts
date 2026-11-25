import { readFile } from 'node:fs/promises'

import { expect, test } from './fixtures.ts'

test('export a backup and restore it into an empty library', async ({ page }, testInfo) => {
  // Make one book to back up.
  await page.goto('/add/manual')
  await page.getByLabel('Title', { exact: true }).fill('Kongens Fald')
  await page.getByLabel('Author').fill('Johannes V. Jensen')
  await page.getByRole('button', { name: /Save|Add/ }).last().click()
  await expect(page.getByRole('heading', { name: 'Kongens Fald' })).toBeVisible()

  await page.goto('/profile')
  await expect(page.getByText('You have not made a backup yet.')).toBeVisible()
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export backup' }).click()
  const download = await downloading
  expect(download.suggestedFilename()).toMatch(/^readhound-backup-.*\.json$/)
  const file = testInfo.outputPath('backup.json')
  await download.saveAs(file)
  const backup = JSON.parse(await readFile(file, 'utf8'))
  expect(backup.format).toBe('readhound-backup')
  expect(backup.data.editions).toHaveLength(1)
  await expect(page.getByText(/^Last backup:/)).toBeVisible()

  // Remove the book, then bring it back from the file.
  await page.goto('/library')
  await page.getByRole('link', { name: /Kongens Fald/ }).click()
  await page.getByRole('button', { name: 'Remove from library' }).click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByText('Your library is empty.')).toBeVisible()

  await page.goto('/profile')
  await page.getByLabel('Import backup').setInputFiles(file)
  await expect(page.getByText('This backup has 1 books, 0 reads, 0 sessions, 0 notes and 0 lists.')).toBeVisible()
  await page.getByRole('button', { name: 'Replace and import' }).click()
  await expect(page.getByText('Backup imported.')).toBeVisible()

  await page.goto('/library')
  await expect(page.getByText('Kongens Fald')).toBeVisible()
})
