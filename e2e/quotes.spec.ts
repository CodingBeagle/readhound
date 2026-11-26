import { expect, test } from './fixtures.ts'

test('Zico shares book quotes on my favourite themes', async ({ page }) => {
  // 2 March 2026 is a day the buddy opens with a quote.
  await page.clock.setFixedTime(new Date('2026-03-02T12:00:00'))
  await page.goto('/profile')
  const section = page.locator('section', { has: page.getByRole('heading', { name: 'Zico’s book quotes' }) })
  await expect(section.getByRole('switch', { name: 'Share quotes from classic books' })).toBeChecked()
  await expect(section.getByRole('button', { name: 'All themes' })).toHaveAttribute('aria-pressed', 'true')
  await section.getByRole('button', { name: 'Grief' }).click()
  await expect(section.getByRole('button', { name: 'Grief' })).toHaveAttribute('aria-pressed', 'true')
  await expect(section.getByText(/\d+ quotes to choose from/)).toBeVisible()

  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Home' }).click()
  const buddy = page.getByRole('region', { name: 'Zico' })
  const quote = buddy.getByTestId('buddy-quote')
  // First he says hello; a tap moves him on to the day's quote.
  await expect(buddy.getByRole('status')).toContainText('I’m Zico')
  await buddy.getByRole('button', { name: /^Zico/ }).click()
  await expect(quote).toBeVisible()
  await expect(quote).toContainText('A quote on grief')
  const first = await quote.getAttribute('data-quote')
  await buddy.getByRole('button', { name: 'Another quote', exact: true }).click()
  await expect(quote).not.toHaveAttribute('data-quote', first ?? '')
  await expect(quote).toContainText('A quote on grief')

  // Find this book searches Open Library for it.
  await buddy.getByRole('link', { name: 'Find book on Open Library' }).click()
  await expect(page).toHaveURL(/\/search\?q=/)

  // Turning quotes off leaves the buddy to its own lines.
  await page.goto('/profile')
  const toggle = section.getByRole('switch', { name: 'Share quotes from classic books' })
  await toggle.click()
  await expect(toggle).not.toBeChecked()
  await expect(section.getByRole('button', { name: 'Grief' })).toBeHidden()
  await page.goto('/')
  await expect(buddy.getByRole('status')).toContainText(/first book|empty shelf/)
  await expect(quote).toBeHidden()
})
