import { Camera, ImageUp, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'

import type { CoverPhotoInput } from '@/db'
import { t } from '@/i18n'
import { Button } from '@/ui/components/ui/button'

import { CoverCropper } from './CoverCropper'

const c = t.covers

/**
 * Take a photo with the camera or pick an image, then crop it. Phones open
 * the back camera for "Take photo"; elsewhere both buttons open a file picker.
 */
export function CoverPhotoPicker({ onPhoto, onRemove }: { onPhoto: (photo: CoverPhotoInput) => Promise<void> | void; onRemove?: () => Promise<void> | void }) {
  const [file, setFile] = useState<File | null>(null)
  const camera = useRef<HTMLInputElement>(null)
  const library = useRef<HTMLInputElement>(null)

  function picked(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = e.target.files?.[0]
    // Clear the input so picking the same file again still fires a change.
    e.target.value = ''
    if (chosen) setFile(chosen)
  }

  return (
    <div className="flex flex-wrap gap-2">
      <input ref={camera} type="file" accept="image/*" capture="environment" aria-label={c.takePhotoLabel} className="hidden" onChange={picked} />
      <input ref={library} type="file" accept="image/*" aria-label={c.chooseImageLabel} className="hidden" onChange={picked} />
      <Button type="button" variant="outline" onClick={() => camera.current?.click()}>
        <Camera />
        {c.takePhoto}
      </Button>
      <Button type="button" variant="outline" onClick={() => library.current?.click()}>
        <ImageUp />
        {c.chooseImage}
      </Button>
      {onRemove && (
        <Button type="button" variant="ghost" className="text-destructive" onClick={() => onRemove()}>
          <Trash2 />
          {c.remove}
        </Button>
      )}
      {file && (
        <CoverCropper
          file={file}
          onCancel={() => setFile(null)}
          onDone={async (photo) => {
            await onPhoto(photo)
            setFile(null)
          }}
        />
      )}
    </div>
  )
}
