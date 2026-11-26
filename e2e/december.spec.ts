import { expect, test } from './fixtures.ts'

/** Local Copenhagen times (the e2e time zone). */
const DECEMBER = new Date('2026-12-12T10:00:00+01:00')
const NOVEMBER = new Date('2026-11-20T10:00:00+01:00')

test('in December Zico wears a Santa hat and snow falls', async ({ page }) => {
  await page.clock.setFixedTime(DECEMBER)
  await page.goto('/')
  await expect(page.getByTestId('hound-logo').first().getByTestId('santa-hat')).toBeAttached()
  // The first shower starts a moment after opening the app; the snow never takes taps.
  const snow = page.getByTestId('snowfall')
  await expect(snow).toBeAttached({ timeout: 6000 })
  await expect(snow).toHaveCSS('pointer-events', 'none')
  // The barking beagle trots on in his hat too.
  await page.goto('/add/manual')
  await page.getByLabel('Title', { exact: true }).fill('Juleroser')
  await page.getByLabel('Author').fill('Zico')
  await page.getByRole('button', { name: /Save|Add/ }).last().click()
  await expect(page.getByTestId('barking-beagle').getByTestId('santa-hat')).toBeAttached()
})

test('outside December there is no hat and no snow', async ({ page }) => {
  await page.clock.setFixedTime(NOVEMBER)
  await page.goto('/')
  await expect(page.getByTestId('hound-logo').first()).toBeAttached()
  await page.waitForTimeout(3500)
  await expect(page.getByTestId('santa-hat')).toHaveCount(0)
  await expect(page.getByTestId('snowfall')).toHaveCount(0)
})

test('with reduced motion Zico keeps his hat but it does not snow', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.clock.setFixedTime(DECEMBER)
  await page.goto('/')
  await expect(page.getByTestId('santa-hat').first()).toBeAttached()
  await page.waitForTimeout(3500)
  await expect(page.getByTestId('snowfall')).toHaveCount(0)
})

test('the demo profile can force December mode on', async ({ page }) => {
  await page.clock.setFixedTime(NOVEMBER)
  await page.goto('/demo')
  await page.getByRole('button', { name: 'Start demo mode' }).click()
  await expect(page.getByText('Demo mode: sample data')).toBeVisible()
  await expect(page.getByTestId('buddy-art')).toBeVisible()
  await expect(page.getByTestId('santa-hat')).toHaveCount(0)

  await page.goto('/profile')
  const toggle = page.getByRole('switch', { name: 'December mode' })
  await expect(toggle).not.toBeChecked()
  await toggle.click()
  await expect(toggle).toBeChecked()
  await page.getByRole('button', { name: 'Make it snow' }).click()
  await expect(page.getByTestId('snowfall')).toBeAttached()

  await page.goto('/')
  await expect(page.getByTestId('buddy-art').getByTestId('santa-hat')).toBeAttached()

  // The toggle lives in the demo data: my own library stays in November.
  await page.getByRole('button', { name: 'Leave demo mode' }).first().click()
  await expect(page.getByText('Demo mode: sample data')).toHaveCount(0)
  await expect(page.getByTestId('santa-hat')).toHaveCount(0)
  await page.goto('/profile')
  await expect(page.getByRole('switch', { name: 'December mode' })).toHaveCount(0)
})
