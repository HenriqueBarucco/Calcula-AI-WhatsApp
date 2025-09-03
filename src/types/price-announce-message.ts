export type PriceStatus = 'FAILED' | 'SUCCESS' | 'PENDING'

export interface PriceAnnounceMessage {
  sessionId: string
  priceId: string
  name?: string | null
  value?: number | null
  status: PriceStatus
  total: number
}
