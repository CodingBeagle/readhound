import { expect, test } from './fixtures.ts'

test('set a weekly pages goal on Home and log pages read today', async ({ page }) => {
  // A book being read, added by hand.
  await page.goto('/add/manual?title=Kongens%20Fald')
  await page.getByLabel('Author').fill('Johannes V. Jensen')
  await page.getByLabel('Page count').fill('300')
  await page.getByRole('button', { name: /Save|Add/ }).last().click()
  await expect(page.getByRole('heading', { name: 'Kongens Fald' })).toBeVisible()
  await page.getByRole('group', { name: 'Status' }).getByRole('button', { name: 'Currently reading' }).click()

  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Home' }).click()
  const card = page.getByRole('region', { name: 'Weekly pages goal' })
  await expect(card.getByText('Set a weekly pages goal')).toBeVisible()
  await card.getByRole('button', { name: '100 pages a week' }).click()
  await expect(card.getByTestId('weekly-pages')).toHaveText('0 / 100 pages')
  await expect(card.getByTestId('weekly-bar')).toHaveAttribute('data-intensity', '0')

  await card.getByLabel('Pages today').fill('60')
  await card.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(card.getByText('Added 60 pages of Kongens Fald.')).toBeVisible()
  await expect(card.getByTestId('weekly-pages')).toHaveText('60 / 100 pages')
  await expect(card.getByTestId('weekly-bar')).toHaveAttribute('data-intensity', '3')
  // The book moved on as well.
  await expect(page.getByText('Page 60 of 300').first()).toBeVisible()
  // The buddy comments on the week.
  await expect(page.getByTestId('beagle-buddy').getByRole('status')).toContainText(/halfway|60 pages|a day/i)

  await card.getByLabel('Pages today').fill('45')
  await card.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(card.getByTestId('weekly-bar')).toHaveAttribute('data-intensity', '5')
  await expect(card.getByText(/Goal reached!/)).toBeVisible()
  await expect(page.getByTestId('beagle-buddy')).toHaveAttribute('data-mood', 'excited')

  // The goal can be changed from Profile too.
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Profile' }).click()
  await expect(page.getByLabel('Pages per week')).toHaveValue('100')
})
