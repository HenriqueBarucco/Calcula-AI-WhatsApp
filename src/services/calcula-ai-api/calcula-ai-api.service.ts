import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class CalculaAiApiService {
  private readonly baseUrl: string

  // eslint-disable-next-line no-useless-constructor
  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.get<string>('CALCULA_AI_API_URL')
  }

  private buildUrl(path: string): string {
    const base = this.baseUrl.replace(/\/$/, '')
    const p = path.startsWith('/') ? path : `/${path}`
    return `${base}${p}`
  }

  async createSession(): Promise<string> {
    const res = await fetch(this.buildUrl('/v1/sessions'), { method: 'POST' })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Start session failed: ${res.status} ${body}`)
    }
    const data = (await res.json()) as { id?: string }
    if (!data?.id)
      throw new Error('Start session failed: missing id in response body')
    return data.id
  }

  async uploadPricesImage(options: {
    sessionId: string
    file: ArrayBuffer | Uint8Array | Buffer
    contentType: string
    filename: string
    caption?: string
  }): Promise<void> {
    const { sessionId, file, contentType, filename, caption } = options

    let arrayBuffer: ArrayBuffer
    if (file instanceof ArrayBuffer) {
      arrayBuffer = file
    } else if (file instanceof Uint8Array) {
      arrayBuffer = file.buffer.slice(
        file.byteOffset,
        file.byteOffset + file.byteLength,
      ) as ArrayBuffer
    } else {
      const buf = file as Buffer
      arrayBuffer = buf.buffer.slice(
        buf.byteOffset,
        buf.byteOffset + buf.byteLength,
      ) as ArrayBuffer
    }

    const form = new FormData()
    form.append(
      'file',
      new Blob([arrayBuffer], { type: contentType }),
      filename,
    )
    if (caption) form.append('caption', caption)

    const res = await fetch(this.buildUrl('/v1/sessions/prices'), {
      method: 'POST',
      headers: {
        session: sessionId,
      },
      body: form,
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Price API failed: ${res.status} ${body}`)
    }
  }

  async getSession(options: { sessionId: string }): Promise<{
    id: string
    total: number
    prices: Array<{
      id: string
      name: string | null
      value: number | null
      quantity: number
      status: string
    }>
  }> {
    const { sessionId } = options
    const res = await fetch(this.buildUrl('/v1/sessions'), {
      method: 'GET',
      headers: { session: sessionId },
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Get session failed: ${res.status} ${body}`)
    }

    const data = (await res.json()) as {
      id: string
      total: number
      prices: Array<{
        id: string
        name: string | null
        value: number | null
        quantity: number
        status: string
      }>
    }
    return data
  }
}
