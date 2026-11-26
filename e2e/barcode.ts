import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { crc32, deflateSync } from 'node:zlib'

/** Generated barcode pictures for the scanner tests. */
const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011']
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111']
const R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100']
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL']

/** The 95 modules of an EAN-13 barcode, 1 for a bar. */
export function ean13(code: string): string {
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
export function barcodeVideo(code: string): string {
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

/** A greyscale PNG photo of a barcode, large like a phone photo, with the code small in it. */
export function barcodePhoto(code: string): Buffer {
  const [width, height, module] = [2400, 1800, 3]
  const bars = ean13(code)
  const x0 = Math.round((width - bars.length * module) / 2)
  const rows = Buffer.alloc((width + 1) * height, 200)
  for (let y = 0; y < height; y++) {
    rows[y * (width + 1)] = 0
    if (y > 800 && y < 1000) for (let x = 0; x < bars.length * module; x++) if (bars[Math.floor(x / module)] === '1') rows[y * (width + 1) + 1 + x0 + x] = 30
  }
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
  header.set([8, 0, 0, 0, 0], 8) // 8-bit greyscale
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))])
}

/** A Y4M video of a plain grey surface: a camera that sees no barcode. */
export function blankVideo(): string {
  const [width, height] = [640, 480]
  const frame = Buffer.concat([Buffer.from('FRAME\n'), Buffer.alloc(width * height, 120), Buffer.alloc((width / 2) * (height / 2) * 2, 128)])
  const file = join(tmpdir(), 'readhound-blank.y4m')
  writeFileSync(file, Buffer.concat([Buffer.from(`YUV4MPEG2 W${width} H${height} F10:1 Ip A1:1 C420jpeg\n`), frame, frame]))
  return file
}
