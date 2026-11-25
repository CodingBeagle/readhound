/**
 * Chart building blocks on Recharts, following the data-viz rules: one
 * series in slot 1, categorical colours in fixed order, thin bars with 4px
 * rounded ends, recessive axes and grid, a tooltip on every mark, and a
 * legend whenever there are two or more series.
 */
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts'

import { formatNumber } from './format'

export { formatNumber }

export const SERIES = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)', 'var(--chart-7)', 'var(--chart-8)']
export const OTHER = 'var(--chart-other)'

const axis = { stroke: 'var(--chart-axis)', tick: { fill: 'var(--muted-foreground)', fontSize: 11 }, tickLine: false } as const
const tooltip = {
  contentStyle: {
    background: 'var(--popover)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--popover-foreground)',
    fontSize: 12,
  },
  itemStyle: { color: 'var(--popover-foreground)' },
  cursor: { fill: 'var(--muted)' },
} as const

/** Legend labels use the text colour; the swatch beside them carries the series colour. */
const legendText = (value: string) => <span style={{ color: 'var(--foreground)' }}>{value}</span>


/** One series of bars, e.g. books per month. */
export function SimpleBarChart({
  data,
  x,
  y,
  name,
  height = 180,
  tickFormatter,
  labelFormatter,
  yDomain,
}: {
  data: readonly object[]
  x: string
  y: string
  name: string
  height?: number
  tickFormatter?: (value: string) => string
  labelFormatter?: (value: string) => string
  yDomain?: [number, number]
}) {
  return (
    <div style={{ height }} className="-ml-3">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data as Record<string, unknown>[]} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey={x} {...axis} tickFormatter={tickFormatter} interval="preserveStartEnd" minTickGap={8} />
          <YAxis {...axis} width={40} allowDecimals={false} axisLine={false} domain={yDomain} />
          <Tooltip {...tooltip} labelFormatter={(v) => (labelFormatter ? labelFormatter(String(v)) : String(v))} formatter={(v) => [formatNumber(Number(v), 1), name]} />
          <Bar dataKey={y} name={name} fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export interface StackSeries {
  key: string
  name: string
  color: string
}

/** Stacked bars with a legend, e.g. genres per month. */
export function StackedBarChart({
  data,
  x,
  series,
  height = 220,
  tickFormatter,
}: {
  data: Record<string, string | number>[]
  x: string
  series: StackSeries[]
  height?: number
  tickFormatter?: (value: string) => string
}) {
  return (
    <div style={{ height }} className="-ml-3">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey={x} {...axis} tickFormatter={tickFormatter} interval="preserveStartEnd" minTickGap={8} />
          <YAxis {...axis} width={40} allowDecimals={false} axisLine={false} />
          <Tooltip {...tooltip} formatter={(v, name) => [formatNumber(Number(v), 1), name]} />
          <Legend iconType="circle" iconSize={8} formatter={legendText} wrapperStyle={{ fontSize: 12 }} />
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.name}
              stackId="a"
              fill={s.color}
              stroke="var(--card)"
              strokeWidth={1}
              radius={i === series.length - 1 ? [4, 4, 0, 0] : 0}
              maxBarSize={28}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** A donut with a legend, for a few categories (e.g. languages). */
export function DonutChart({ data, height = 200 }: { data: { name: string; value: number; color: string }[]; height?: number }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={1} stroke="var(--card)" strokeWidth={2}>
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
          <Tooltip {...tooltip} formatter={(v, name) => [formatNumber(Number(v)), name]} />
          <Legend iconType="circle" iconSize={8} layout="vertical" align="right" verticalAlign="middle" formatter={legendText} wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Rating against page count. */
export function RatingScatter({ data, xName, yName }: { data: { title: string; pages: number; rating: number }[]; xName: string; yName: string }) {
  return (
    <div style={{ height: 220 }} className="-ml-3">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--chart-grid)" />
          <XAxis type="number" dataKey="pages" name={xName} {...axis} />
          <YAxis type="number" dataKey="rating" name={yName} domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} {...axis} width={32} axisLine={false} />
          <ZAxis dataKey="title" name="Book" range={[64, 64]} />
          <Tooltip {...tooltip} cursor={{ stroke: 'var(--chart-axis)' }} />
          <Scatter data={data} fill={SERIES[0]} stroke="var(--card)" strokeWidth={2} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}

/** A single horizontal bar split into parts, with a legend row underneath (e.g. fiction vs non-fiction). */
export function SplitBar({ parts }: { parts: { name: string; value: number; color: string }[] }) {
  const total = parts.reduce((sum, p) => sum + p.value, 0)
  if (!total) return null
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={parts.map((p) => `${p.name} ${p.value}`).join(', ')}>
        {parts
          .filter((p) => p.value > 0)
          .map((p) => (
            <div key={p.name} title={`${p.name}: ${p.value}`} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} />
          ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {parts.map((p) => (
          <li key={p.name} className="flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-full" style={{ background: p.color }} />
            <span className="text-foreground">{p.name}</span> {formatNumber(p.value)} ({Math.round((p.value / total) * 100)}%)
          </li>
        ))}
      </ul>
    </div>
  )
}
