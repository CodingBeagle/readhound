import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { expect, test } from './fixtures.ts'

const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011']
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111']
const R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100']
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL']

/** The 95 modules of an EAN-13 barcode, 1 for a bar. */
function ean13(code: string): string {
  const d = [...code].map(Number)
  const left = d.slice(1, 7).map((n, i) => (PARITY[d[0]!]![i] === 'L' ? L : G)[n]).join('')
  const right = d.slice(7).map((n) => R[n]).join('')
  return `101${left}01010${right}101`
}

/**
 * A Y4M video of a book barcode, played by Chromium's fake camera, so the
 * scanner reads a real EAN-13 from a live stream (with the ZXing ponyfill:
 * headless Chromium on Linux has no native BarcodeDetector).
 */
function barcodeVideo(code: string): string {
  const [width, height, module] = [640, 480, 4]
  const bars = ean13(code)
  const x0 = (width - bars.length * module) / 2
  const luma = Buffer.alloc(width * height, 235)
  for (let y = 140; y < 340; y++)
    for (let x = 0; x < bars.length * module; x++) if (bars[Math.floor(x / module)] === '1') luma[y * width + x0 + x] = 16
  const chroma = Buffer.alloc((width / 2) * (height / 2) * 2, 128)
  const frame = Buffer.concat([Buffer.from('FRAME\n'), luma, chroma])
  const file = join(tmpdir(), `readhound-barcode-${code}.y4m`)
  writeFileSync(file, Buffer.concat([Buffer.from(`YUV4MPEG2 W${width} H${height} F10:1 Ip A1:1 C420jpeg\n`), ...Array(10).fill(frame)]))
  return file
}

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
