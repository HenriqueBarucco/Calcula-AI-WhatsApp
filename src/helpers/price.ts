import { PriceAnnounceMessage } from 'src/types/price-announce-message'

export function isPriceAnnounceMessage(
  payload: unknown,
): payload is PriceAnnounceMessage {
  if (!payload || typeof payload !== 'object') return false
  const p = payload as Record<string, unknown>
  return (
    typeof p.sessionId === 'string' &&
    typeof p.priceId === 'string' &&
    (p.name === undefined || p.name === null || typeof p.name === 'string') &&
    (p.value === undefined ||
      p.value === null ||
      typeof p.value === 'number') &&
    typeof p.status === 'string' &&
    typeof p.total === 'number'
  )
}
