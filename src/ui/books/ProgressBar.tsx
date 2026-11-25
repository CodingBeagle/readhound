export function ProgressBar({ value, label }: { value: number; label: string }) {
  const percent = Math.round(value * 100)
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className="h-2 w-full overflow-hidden rounded-full bg-muted"
    >
      <div className="fill-bar animate-grow h-full rounded-full transition-[width] duration-500" style={{ width: `${percent}%` }} />
    </div>
  )
}
