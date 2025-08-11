export function extractCommand(text?: string | null): string | null {
  const value = (text || '').trim()
  if (!value) return null
  const [maybeCommand] = value.split(/\s+/)
  return (maybeCommand || '').replace(/^\//, '').toLowerCase() || null
}
