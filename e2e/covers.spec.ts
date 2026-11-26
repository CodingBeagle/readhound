import { readFile } from 'node:fs/promises'
import { crc32, deflateSync } from 'node:zlib'

import { expect, test } from './fixtures.ts'

/** A plain landscape PNG, like a photo of a book lying on a table. */
function png(width: number, height: number): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4)
    length.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(body))
    return Buffer.concat([length, body, crc])
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header.set([8, 2, 0, 0, 0], 8) // 8-bit RGB
  const rows = Buffer.alloc((width * 3 + 1) * height)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) rows.set([200, 40 + (x % 200), 60], y * (width * 3 + 1) + 1 + x * 3)
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))])
}

const photo = { name: 'cover.png', mimeType: 'image/png', buffer: png(1200, 900) }

test('take a cover photo for a book without a cover, crop it, back it up and remove it', async ({ page }, testInfo) => {
  await page.goto('/add/manual')
  await page.getByLabel('Title', { exact: true }).fill('Kongens Fald')
  await page.getByLabel('Author').fill('Johannes V. Jensen')
  await page.getByRole('button', { name: /Save|Add/ }).last().click()
  await expect(page.getByRole('heading', { name: 'Kongens Fald' })).toBeVisible()
  await expect(page.getByLabel('No cover: Kongens Fald')).toBeVisible()

  await page.getByRole('button', { name: 'Add cover photo' }).click()
  await page.getByLabel('Take a cover photo').setInputFiles(photo)
  const dialog = page.getByRole('dialog', { name: 'Crop the cover' })
  await expect(dialog).toBeVisible()
  // Zoom in, drag the photo a little and turn it, then use it.
  await dialog.getByLabel('Zoom').fill('2')
  const preview = dialog.getByRole('img', { name: /Cover preview/ })
  const box = (await preview.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2 + 10)
  await page.mouse.up()
  await dialog.getByRole('button', { name: 'Turn' }).click()
  await dialog.getByRole('button', { name: 'Use photo' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText('Cover photo saved.')).toBeVisible()

  const cover = page.locator('header img')
  await expect(cover).toHaveAttribute('src', /^data:image\/jpeg;base64,/)
  // Cropped to the 2:3 cover shape.
  const size = await cover.evaluate((el) => { const img = el as unknown as { naturalWidth: number; naturalHeight: number }; return [img.naturalWidth, img.naturalHeight] })
  expect(size[0]! / size[1]!).toBeCloseTo(2 / 3, 2)

  // The photo survives a reload and shows in the library.
  await page.reload()
  await expect(page.locator('header img')).toHaveAttribute('src', /^data:image\/jpeg/)
  await page.goto('/library')
  await expect(page.locator('img[src^="data:image/jpeg"]')).toHaveCount(1)

  // It is part of the backup.
  await page.goto('/profile')
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export backup' }).click()
  const file = testInfo.outputPath('backup.json')
  await (await downloading).saveAs(file)
  const backup = JSON.parse(await readFile(file, 'utf8'))
  expect(backup.version).toBe(3)
  expect(backup.data.covers).toHaveLength(1)
  expect(backup.data.covers[0].dataUrl).toMatch(/^data:image\/jpeg;base64,/)

  // Removing it brings back the placeholder.
  await page.goto('/library')
  await page.getByRole('link', { name: /Kongens Fald/ }).click()
  await page.getByRole('button', { name: 'Change cover' }).click()
  await page.getByRole('button', { name: 'Remove photo' }).click()
  await expect(page.getByLabel('No cover: Kongens Fald')).toBeVisible()
})

test('add a cover photo while adding a book by hand', async ({ page }) => {
  await page.goto('/add/manual')
  await page.getByLabel('Title', { exact: true }).fill('Kongens Fald')
  await page.getByLabel('Author').fill('Johannes V. Jensen')
  await page.getByLabel('Choose a cover image').setInputFiles(photo)
  await page.getByRole('dialog', { name: 'Crop the cover' }).getByRole('button', { name: 'Use photo' }).click()
  await expect(page.getByRole('img', { name: 'Cover photo added. It is saved with the book.' })).toBeVisible()
  await page.getByRole('button', { name: /Save|Add/ }).last().click()
  await expect(page.getByRole('heading', { name: 'Kongens Fald' })).toBeVisible()
  await expect(page.locator('header img')).toHaveAttribute('src', /^data:image\/jpeg/)
})
