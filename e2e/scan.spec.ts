import { barcodeVideo } from './barcode.ts'
import { expect, test } from './fixtures.ts'

test.use({
  permissions: ['camera'],
  launchOptions: {
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${barcodeVideo('9780593135204')}`],
  },
})

test('scan a book barcode with the camera and add that exact edition', async ({ page }) => {
  await page.goto('/search')
  await page.getByRole('button', { name: 'Scan barcode' }).click()
  await expect(page.getByRole('dialog', { name: 'Scan the barcode' })).toBeVisible()

  // The fake camera shows the barcode of Project Hail Mary's first US hardcover.
  await expect(page.getByRole('heading', { name: 'Add to library' })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('Project Hail Mary')).toBeVisible()
  await expect(page.getByText('Ballantine Books')).toBeVisible()
  await page.getByRole('button', { name: 'Add to library' }).click()
  await expect(page.getByRole('heading', { name: 'Project Hail Mary' })).toBeVisible()
})

test('an ISBN Open Library does not know opens manual entry, ready to fill in', async ({ page }) => {
  await page.goto('/add/isbn/9788702173543')
  await expect(page.getByText(/Open Library doesn’t know ISBN 9788702173543/)).toBeVisible()
  await expect(page.getByLabel('ISBN')).toHaveValue('9788702173543')
  await expect(page.getByLabel(/Language code/)).toHaveValue('dan')
})
