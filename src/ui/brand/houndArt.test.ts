import favicon from '../../../public/favicon.svg?raw'
import logo from '../../../public/logo.svg?raw'

import { houndSvg } from './houndArt'

describe('houndSvg', () => {
  it('draws a rounded gradient badge by default', () => {
    const svg = houndSvg()
    expect(svg).toContain('<linearGradient id="rh-bg"')
    expect(svg).toContain('rx="112"')
    expect(svg).not.toContain('transform=')
  })

  it('draws a full-bleed square with the artwork shrunk into the safe zone', () => {
    const svg = houndSvg({ background: 'square', scale: 0.8 })
    expect(svg).not.toContain('rx="112"')
    const offset = (512 * 0.2) / 2
    expect(svg).toContain(`transform="translate(${offset} ${offset}) scale(0.8)"`)
  })

  it('draws only the hound and book without a background', () => {
    expect(houndSvg({ background: 'none' })).not.toContain('<rect')
  })

  it('matches the icons in public/ (run `npm run generate-icons` after changing the logo)', () => {
    expect(logo).toBe(houndSvg())
    expect(favicon).toBe(houndSvg())
  })
})
