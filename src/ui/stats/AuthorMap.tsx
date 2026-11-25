import { geoEqualEarth, geoPath } from 'd3-geo'
import type { FeatureCollection, Geometry } from 'geojson'
import { useEffect, useState } from 'react'
import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'

import { COUNTRY_MAP_IDS } from './countryIds'

const WIDTH = 640
const HEIGHT = 330

type Countries = FeatureCollection<Geometry, { name: string }>

/** World map shaded by finished reads per author country. The map data (about 100 KB) loads only when shown. */
export function AuthorMap({ counts, label }: { counts: Map<string, number>; label: string }) {
  const [countries, setCountries] = useState<Countries>()
  useEffect(() => {
    let live = true
    void import('world-atlas/countries-110m.json').then((m) => {
      const topo = (m.default ?? m) as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>
      if (live) setCountries(feature(topo, topo.objects.countries) as Countries)
    })
    return () => {
      live = false
    }
  }, [])

  if (!countries) return <div style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }} className="rounded-lg bg-muted" />

  const byId = new Map<string, number>()
  for (const [code, n] of counts) {
    const id = COUNTRY_MAP_IDS.get(code)
    if (id) byId.set(id, n)
  }
  const max = Math.max(1, ...byId.values())
  const projection = geoEqualEarth().fitSize([WIDTH, HEIGHT], countries)
  const path = geoPath(projection)
  const level = (n: number) => Math.max(1, Math.ceil((n / max) * 4))

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={label} className="h-auto w-full">
      {countries.features.map((f, i) => {
        const n = f.id !== undefined ? byId.get(String(f.id)) : undefined
        return (
          <path key={f.id ?? i} d={path(f) ?? undefined} fill={n ? `var(--heat-${level(n)})` : 'var(--heat-0)'} stroke="var(--card)" strokeWidth={0.5}>
            <title>{n ? `${f.properties.name}: ${n}` : f.properties.name}</title>
          </path>
        )
      })}
    </svg>
  )
}
