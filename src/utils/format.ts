export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

export function formatPercent(value: number, digits = 2): string {
  return `${value.toFixed(digits)}%`
}

/** Formats a duration given in milliseconds as e.g. "2h 34m" or "45m" or "12s". */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

export function formatShortDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  if (hours > 0) return `${hours}h${minutes.toString().padStart(2, '0')}m`
  return `${minutes}m`
}

export function formatDate(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatDateShort(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Local (browser-timezone) calendar date as YYYY-MM-DD - matches the value
 * shape of a native <input type="date">, so a date-range filter's bounds
 * compare correctly against what formatDate()/formatDateShort() display
 * (both also local time), rather than the raw UTC date. */
export function localDateKey(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function isWithinDateRange(iso: string, range: { from: string; to: string }): boolean {
  if (!range.from && !range.to) return true
  const key = localDateKey(iso)
  if (range.from && key < range.from) return false
  if (range.to && key > range.to) return false
  return true
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
