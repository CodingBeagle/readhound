import { expect, test } from './fixtures.ts'

test('the library as a bookshelf: filters apply and a spine pulls out and opens', async ({ page }) => {
  await page.goto('/demo')
  await page.getByRole('button', { name: 'Start demo mode' }).click()
  await expect(page.getByText('Demo mode: sample data')).toBeVisible()
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Library' }).click()
  await expect(page.getByText(/^\d+ books$/)).toBeVisible()

  await page.getByRole('group', { name: 'View' }).getByRole('button', { name: 'Shelf view' }).click()
  const shelf = page.getByRole('list', { name: 'Bookshelf' })
  await expect(shelf).toBeVisible()
  const spines = shelf.getByRole('button', { name: / by / })

  // Every book in the filtered library gets a spine.
  const bookCount = async () => Number((await page.getByText(/^\d+ books?$/).textContent())!.split(' ')[0])
  const total = await bookCount()
  await page.getByRole('group', { name: 'Status' }).getByRole('button', { name: 'Finished' }).click()
  // Wait for the filter to re-render the count before reading it.
  await expect.poll(bookCount).toBeLessThan(total)
  const count = await bookCount()
  await expect(spines).toHaveCount(count)
  await page.getByRole('button', { name: 'Owned' }).click()
  await expect.poll(bookCount).toBeLessThan(count)
  const owned = await bookCount()
  await expect(spines).toHaveCount(owned)

  // The view sticks in the URL, so it survives going to a book and back.
  await expect(page).toHaveURL(/view=shelf/)

  const first = spines.first()
  const title = (await first.getAttribute('aria-label'))!.split(' by ')[0]!
  await first.click()
  const dialog = page.getByRole('dialog', { name: title })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Put back' }).click()
  await expect(dialog).toHaveCount(0)

  await first.click()
  await page.getByRole('dialog', { name: title }).getByRole('link', { name: 'Open book' }).click()
  await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('list', { name: 'Bookshelf' })).toBeVisible()
})
