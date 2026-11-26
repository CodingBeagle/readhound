import { expect, test } from './fixtures.ts'

/** Local Copenhagen times (the e2e time zone). */
const EVENING = new Date('2026-11-20T20:00:00+01:00')
const MORNING = new Date('2026-11-20T10:00:00+01:00')
const DECEMBER_EVENING = new Date('2026-12-12T20:00:00+01:00')

const addBook = async (page: import('@playwright/test').Page) => {
  await page.goto('/add/manual')
  await page.getByLabel('Title', { exact: true }).fill('Godnathistorier')
  await page.getByLabel('Author').fill('Zico')
  await page.getByRole('button', { name: /Save|Add/ }).last().click()
}

test('in the evening Zico wears pyjamas and a nightcap', async ({ page }) => {
  await page.clock.setFixedTime(EVENING)
  await page.goto('/')
  const logo = page.getByTestId('hound-logo').first()
  await expect(logo.getByTestId('nightcap')).toBeAttached()
  await expect(logo.getByTestId('pyjamas')).toBeAttached()
  await expect(page.getByTestId('santa-hat')).toHaveCount(0)
  // The barking beagle trots on in his pyjamas too.
  await addBook(page)
  const barker = page.getByTestId('barking-beagle')
  await expect(barker.getByTestId('pyjamas')).toBeAttached()
  await expect(barker.getByTestId('nightcap')).toBeAttached()
})

test('during the day there are no pyjamas', async ({ page }) => {
  await page.clock.setFixedTime(MORNING)
  await page.goto('/')
  await expect(page.getByTestId('hound-logo').first()).toBeAttached()
  await expect(page.getByTestId('nightcap')).toHaveCount(0)
  await expect(page.getByTestId('pyjamas')).toHaveCount(0)
})

test('the pyjamas go on at 18:00 and come off at 06:00 while the app is open', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-20T17:59:40+01:00') })
  await page.goto('/')
  const logo = page.getByTestId('hound-logo').first()
  await expect(logo).toBeAttached()
  await expect(page.getByTestId('pyjamas')).toHaveCount(0)
  await page.clock.runFor(30_000)
  await expect(logo.getByTestId('pyjamas')).toBeAttached()

  await page.clock.fastForward('11:59:00')
  await page.clock.runFor(70_000)
  await expect(page.getByTestId('pyjamas')).toHaveCount(0)
})

test('on December evenings the Santa hat stands in for the nightcap', async ({ page }) => {
  await page.clock.setFixedTime(DECEMBER_EVENING)
  await page.goto('/')
  const logo = page.getByTestId('hound-logo').first()
  await expect(logo.getByTestId('santa-hat')).toBeAttached()
  await expect(logo.getByTestId('pyjamas')).toBeAttached()
  await expect(page.getByTestId('nightcap')).toHaveCount(0)
})

test('the demo profile can put Zico in his pyjamas any time', async ({ page }) => {
  await page.clock.setFixedTime(MORNING)
  await page.goto('/demo')
  await page.getByRole('button', { name: 'Start demo mode' }).click()
  await expect(page.getByText('Demo mode: sample data')).toBeVisible()
  await expect(page.getByTestId('buddy-art')).toBeVisible()
  await expect(page.getByTestId('pyjamas')).toHaveCount(0)

  await page.goto('/profile')
  const toggle = page.getByRole('switch', { name: 'Pyjama time' })
  await expect(toggle).not.toBeChecked()
  await toggle.click()
  await expect(toggle).toBeChecked()

  await page.goto('/')
  await expect(page.getByTestId('buddy-art').first().getByTestId('pyjamas')).toBeAttached()
  await expect(page.getByTestId('buddy-art').first().getByTestId('nightcap')).toBeAttached()

  // The toggle lives in the demo data: my own library keeps the real time of day.
  await page.getByRole('button', { name: 'Leave demo mode' }).first().click()
  await expect(page.getByText('Demo mode: sample data')).toHaveCount(0)
  await expect(page.getByTestId('pyjamas')).toHaveCount(0)
  await page.goto('/profile')
  await expect(page.getByRole('switch', { name: 'Pyjama time' })).toHaveCount(0)
})
