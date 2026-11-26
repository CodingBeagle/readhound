import { expect, test } from '@playwright/test'

test('the landing page introduces Zico and opens the app', async ({ page }) => {
  await page.goto('/welcome/')
  await expect(page.getByRole('heading', { level: 1, name: 'Hi, I’m Zico!' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'First, I sniff out your books' })).toBeAttached()
  await expect(page.getByRole('heading', { name: 'Simple, and yours alone' })).toBeAttached()

  await page.getByTestId('landing-open-app').scrollIntoViewIfNeeded()
  await page.getByTestId('landing-open-app').click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('navigation', { name: 'Main navigation' }).first()).toBeVisible()
})

test('Profile links to the landing page', async ({ page }) => {
  await page.goto('/profile')
  await page.getByRole('link', { name: 'Meet Zico and the tour of Readhound' }).click()
  await expect(page).toHaveURL(/\/welcome\/$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hi, I’m Zico!')
})
