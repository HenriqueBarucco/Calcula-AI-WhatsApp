export type PriceStatus = 'FAILED' | 'SUCCESS'

export interface PriceAnnounceMessage {
  sessionId: string
  priceId: string
  name?: string | null
  value?: number | null
  status: PriceStatus | string
  total: number
}
