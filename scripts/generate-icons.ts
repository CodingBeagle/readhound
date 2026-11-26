/**
 * Regenerates every app icon in `public/` from the logo artwork in
 * `src/ui/brand/houndArt.ts`. Run with `npm run generate-icons` after changing the logo.
 */
import { writeFile } from 'node:fs/promises'

import sharp from 'sharp'

import { houndSvg } from '../src/ui/brand/houndArt.ts'

const out = (name: string) => new URL(`../public/${name}`, import.meta.url)

const rounded = houndSvg({ background: 'rounded' })
// Maskable icons are cropped to a circle of 80% of the width, so the hound sits inside that safe zone.
const maskable = houndSvg({ background: 'square', scale: 0.78 })
// iOS rounds the corners itself and wants an opaque square.
const apple = houndSvg({ background: 'square', scale: 0.9 })

const png = (svg: string, size: number) => sharp(Buffer.from(svg), { density: 300 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer()

/** An .ico holding one PNG image (supported by every current browser). */
function ico(image: Buffer, size: number): Buffer {
  const header = Buffer.alloc(22)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(1, 4) // one image
  header.writeUInt8(size, 6)
  header.writeUInt8(size, 7)
  header.writeUInt16LE(1, 10) // colour planes
  header.writeUInt16LE(32, 12) // bits per pixel
  header.writeUInt32LE(image.length, 14)
  header.writeUInt32LE(22, 18) // image data offset
  return Buffer.concat([header, image])
}

await writeFile(out('logo.svg'), rounded)
await writeFile(out('favicon.svg'), rounded)
for (const size of [64, 192, 512]) await writeFile(out(`pwa-${size}x${size}.png`), await png(rounded, size))
await writeFile(out('maskable-icon-512x512.png'), await png(maskable, 512))
await writeFile(out('apple-touch-icon-180x180.png'), await png(apple, 180))
await writeFile(out('favicon.ico'), ico(await png(rounded, 48), 48))
console.log('Icons written to public/')
