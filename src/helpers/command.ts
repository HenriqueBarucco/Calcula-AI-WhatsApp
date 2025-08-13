export function extractCommand(text?: string | null): string | undefined {
  const value = (text ?? '').trim()
  if (!value.startsWith('/')) return undefined

  const match = value.match(/^\/([a-zA-Z0-9_-]+)/)
  return match?.[1]?.toLowerCase() || undefined
}
