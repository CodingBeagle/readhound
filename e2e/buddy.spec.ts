import { expect, test } from './fixtures.ts'

test('the beagle buddy greets me on Home and reacts to a tap', async ({ page }) => {
  // A fresh library: the buddy is curious and wants to find a first book.
  await page.goto('/')
  const buddy = page.getByRole('region', { name: 'Beagle buddy' })
  await expect(buddy).toHaveAttribute('data-mood', 'curious')
  await expect(buddy.getByRole('status')).toContainText(/first book|empty shelf/)

  // Demo mode has recent reading, so the buddy is in a good mood.
  await page.goto('/demo')
  await page.getByRole('button', { name: 'Start demo mode' }).click()
  await expect(page.getByText('Demo mode: sample data')).toBeVisible()
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Home' }).click()
  await expect(buddy).toHaveAttribute('data-mood', /excited|happy|curious/)
  const before = await buddy.getByRole('status').textContent()
  await buddy.getByRole('button', { name: /Beagle buddy/ }).click()
  await expect(buddy.getByRole('status')).not.toHaveText(before ?? '')
})
