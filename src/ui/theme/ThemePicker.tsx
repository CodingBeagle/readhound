import { Check } from 'lucide-react'

import { t } from '@/i18n'
import { cn } from '@/lib/utils'

import { THEME_PREVIEW, THEMES, type Swatch, type ThemeId } from './themes'
import { useTheme } from './useTheme'

const a = t.screens.profile.appearance

/** Theme cards with a small preview of each; picking one applies it at once. */
export function ThemePicker() {
  const [current, setTheme] = useTheme()
  return (
    <fieldset>
      <legend className="sr-only">{a.title}</legend>
      <div className="grid grid-cols-2 gap-3">
        {THEMES.map((id) => (
          <label
            key={id}
            className={cn(
              'group relative flex cursor-pointer flex-col gap-2 rounded-[var(--radius)] border-2 p-2 transition-[border-color,scale] duration-200 active:scale-[0.98]',
              'has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50',
              current === id ? 'border-primary' : 'border-transparent hover:border-border',
            )}
          >
            <input type="radio" name="theme" value={id} checked={current === id} onChange={() => setTheme(id)} className="sr-only" />
            <Preview id={id} />
            <span className="flex items-center justify-between gap-1 px-1 text-sm font-semibold">
              {a.themes[id].name}
              {current === id && <Check aria-hidden className="animate-pop size-4 text-primary" />}
            </span>
            <span className="px-1 pb-1 text-xs text-muted-foreground">{a.themes[id].description}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

/** A miniature screen in the theme's colours: light on the left, dark on the right. */
function Preview({ id }: { id: ThemeId }) {
  const { light, dark, darkOnly } = THEME_PREVIEW[id]
  return (
    <div aria-hidden className="flex h-20 overflow-hidden rounded-[calc(var(--radius)-4px)] border">
      <Mini swatch={light} font={id} />
      {!darkOnly && <Mini swatch={dark} font={id} />}
    </div>
  )
}

const FONTS: Record<ThemeId, string> = {
  classic: 'ui-sans-serif, system-ui, sans-serif',
  aurora: "'Plus Jakarta Sans Variable', sans-serif",
  bookshop: "'Fraunces Variable', Georgia, serif",
  midnight: "'Space Grotesk Variable', sans-serif",
}

function Mini({ swatch, font }: { swatch: Swatch; font: ThemeId }) {
  return (
    <div className="flex flex-1 flex-col gap-1 p-2 transition-transform duration-300 group-hover:scale-[1.03]" style={{ background: swatch.bg }}>
      <span className="text-sm leading-none font-bold" style={{ color: swatch.ink, fontFamily: FONTS[font] }}>
        Aa
      </span>
      <span className="flex flex-1 flex-col justify-end gap-1 rounded-md p-1.5" style={{ background: swatch.card }}>
        <span className="h-1.5 w-3/4 rounded-full" style={{ background: `linear-gradient(90deg, ${swatch.accent}, ${swatch.accent2})` }} />
        <span className="h-1.5 w-1/2 rounded-full opacity-40" style={{ background: swatch.ink }} />
      </span>
    </div>
  )
}
