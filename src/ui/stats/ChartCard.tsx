import { t } from '@/i18n'
import { cn } from '@/lib/utils'

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
  return (
    <section className={cn('flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4', className)}>
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {summary && <div className="mt-0.5 text-sm text-muted-foreground">{summary}</div>}
      </div>
      {children}
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
    </section>
  )
}

/** A headline number with a label and an optional detail line. */
export function StatTile({ label, value, detail }: { label: string; value: React.ReactNode; detail?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col rounded-xl border bg-card p-4">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold tracking-tight">{value}</span>
      {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
    </div>
  )
}
