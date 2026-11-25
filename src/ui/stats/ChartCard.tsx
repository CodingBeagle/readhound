import { motion } from 'motion/react'
import { useRef } from 'react'

import { t } from '@/i18n'
import { cn } from '@/lib/utils'
import { CountUp } from '@/ui/motion/CountUp'
import { motionSkipped, useRevealed } from '@/ui/motion/useRevealed'

export interface TableData {
  headers: string[]
  rows: (string | number)[][]
}

/** A titled card holding one stat. Charts pass `table` so the numbers are also readable as text (WCAG). */
export function ChartCard({
  title,
  summary,
  table,
  children,
  className,
}: {
  title: string
  summary?: React.ReactNode
  table?: TableData
  children?: React.ReactNode
  className?: string
}) {
  const ref = useRef<HTMLElement>(null)
  const inView = useRevealed(ref)
  return (
    <motion.section
      ref={ref}
      className={cn('flex min-w-0 flex-col gap-3 surface p-4', className)}
      initial={motionSkipped ? false : { opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <div>
        <h3 className="card-title text-sm font-semibold">{title}</h3>
        {summary && <div className="mt-0.5 text-sm text-muted-foreground">{summary}</div>}
      </div>
      {/* Charts draw themselves the moment the card scrolls into view, not off screen. */}
      <div key={inView ? 'shown' : 'waiting'} className="contents">
        {children}
      </div>
      {table && table.rows.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer py-1 text-xs text-muted-foreground">{t.screens.stats.showTable}</summary>
          <table className="mt-2 w-full text-left tabular-nums">
            <thead>
              <tr>
                {table.headers.map((h) => (
                  <th key={h} scope="col" className="border-b py-1 pr-2 text-xs font-medium text-muted-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} className="border-b py-1 pr-2">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </motion.section>
  )
}

/** A headline number with a label and an optional detail line. */
export function StatTile({ label, value, detail }: { label: string; value: React.ReactNode; detail?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col surface p-4">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="stat-value text-2xl font-bold tracking-tight">{typeof value === 'string' ? <CountUp value={value} /> : value}</span>
      {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
    </div>
  )
}
