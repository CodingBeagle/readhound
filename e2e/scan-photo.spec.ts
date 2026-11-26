import { barcodePhoto, blankVideo } from './barcode.ts'
import { expect, test } from './fixtures.ts'

// The live camera sees no barcode here, so only the photo can find the book.
test.use({
  permissions: ['camera'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${blankVideo()}`] },
})

test('a photo of the barcode works when the live camera can not read it', async ({ page }) => {
  await page.goto('/search?scan=1')
  const dialog = page.getByRole('dialog', { name: 'Scan the barcode' })
  // After a few seconds without a read, tips on holding the book appear.
  await expect(dialog.getByText('Can’t read it yet?')).toBeVisible({ timeout: 10_000 })
  await dialog.getByLabel('Photo of the barcode').setInputFiles({ name: 'barcode.png', mimeType: 'image/png', buffer: barcodePhoto('9780593135204') })
  await expect(page.getByRole('heading', { name: 'Add to library' })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('Project Hail Mary')).toBeVisible()
})
