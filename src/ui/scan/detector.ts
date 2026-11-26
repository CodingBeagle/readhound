/** Reads barcodes from a video frame or a photo. */
export interface BarcodeReader {
  detect(source: HTMLVideoElement | HTMLCanvasElement | ImageBitmap | Blob): Promise<{ rawValue: string }[]>
}

/** Book barcodes are EAN-13; UPC-A covers some US paperbacks that carry an ISBN in it too. */
const FORMATS = ['ean_13', 'upc_a'] as const

interface NativeDetectorClass {
  new (opts: { formats: readonly string[] }): BarcodeReader
  getSupportedFormats(): Promise<string[]>
}

/**
 * The browser's own BarcodeDetector where it reads EAN-13 (Chrome on
 * Android, macOS), otherwise the ZXing WebAssembly ponyfill (iOS Safari,
 * Firefox, desktop Chrome on Windows and Linux). The ponyfill and its .wasm
 * file are bundled with the app and load only the first time a scan starts,
 * so nothing is fetched from a CDN.
 */
export async function createBarcodeReader(): Promise<BarcodeReader> {
  const Native = (globalThis as { BarcodeDetector?: NativeDetectorClass }).BarcodeDetector
  if (Native) {
    try {
      const formats = await Native.getSupportedFormats()
      if (formats.includes('ean_13')) return new Native({ formats: FORMATS.filter((f) => formats.includes(f)) })
    } catch {
      // Fall through to the ponyfill.
    }
  }
  const [{ BarcodeDetector, prepareZXingModule }, { default: wasmUrl }] = await Promise.all([
    import('barcode-detector/ponyfill'),
    import('zxing-wasm/reader/zxing_reader.wasm?url'),
  ])
  await prepareZXingModule({
    overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) },
    fireImmediately: true,
  })
  return new BarcodeDetector({ formats: [...FORMATS] })
}

/** Longest side of the scaled copies a photo is also read at. */
const PHOTO_SIZES = [1600, 1000]

/**
 * Reads a photo of a barcode. A phone photo is 12 megapixels or more, and
 * barcode readers often do better on a smaller copy, so when the full photo
 * gives nothing it is read again at smaller sizes.
 */
export async function readPhoto(reader: BarcodeReader, photo: Blob): Promise<{ rawValue: string }[]> {
  const full = await reader.detect(photo).catch(() => [])
  if (full.length > 0) return full
  const bitmap = await createImageBitmap(photo)
  try {
    for (const size of PHOTO_SIZES) {
      const scale = Math.min(1, size / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(bitmap.width * scale)
      canvas.height = Math.round(bitmap.height * scale)
      canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      const codes = await reader.detect(canvas).catch(() => [])
      if (codes.length > 0) return codes
    }
    return []
  } finally {
    bitmap.close()
  }
}
