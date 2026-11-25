/** A titled block on a screen, with a small uppercase heading. */
export function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}
