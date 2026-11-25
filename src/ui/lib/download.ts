/** Saves text as a file through the browser's download. */
export function downloadText(filename: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.append(a)
  a.click()
  a.remove()
  // Give the browser a moment to start the download before freeing the blob.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
