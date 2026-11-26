import { expect, test } from './fixtures.ts'

test('Zico introduces himself on Home and reacts to a tap', async ({ page }) => {
  // A fresh library: the first time, Zico says hello by name and wears a name tag.
  await page.goto('/')
  const buddy = page.getByRole('region', { name: 'Zico' })
  await expect(buddy).toHaveAttribute('data-mood', 'curious')
  await expect(buddy.getByTestId('buddy-name-tag')).toHaveText('Zico')
  await expect(buddy.getByRole('status')).toContainText('I’m Zico')

  // He only introduces himself once; after that he wants to find a first book.
  await page.reload()
  await expect(buddy.getByRole('status')).toContainText(/first book|empty shelf/)

  // Demo mode has recent reading, so the buddy is in a good mood.
  await page.goto('/demo')
  await page.getByRole('button', { name: 'Start demo mode' }).click()
  await expect(page.getByText('Demo mode: sample data')).toBeVisible()
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Home' }).click()
  await expect(buddy).toHaveAttribute('data-mood', /excited|happy|curious/)
  await expect(buddy.getByRole('status')).not.toContainText('I’m Zico')
  const before = await buddy.getByRole('status').textContent()
  await buddy.getByRole('button', { name: /^Zico/ }).click()
  await expect(buddy.getByRole('status')).not.toHaveText(before ?? '')
})
