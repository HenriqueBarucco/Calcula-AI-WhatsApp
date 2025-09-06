import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class CalculaAiApiService {
  private readonly baseUrl: string
  private readonly logger = new Logger(CalculaAiApiService.name)

  // eslint-disable-next-line no-useless-constructor
  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.get<string>('CALCULA_AI_API_URL')
  }

  private buildUrl(path: string): string {
    const base = this.baseUrl.replace(/\/$/, '')
    const p = path.startsWith('/') ? path : `/${path}`
    return `${base}${p}`
  }

  async createSession(hasClub: boolean): Promise<string> {
    const res = await fetch(this.buildUrl('/v1/sessions'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        has_club: hasClub,
      }),
    })
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

    const maxRetries = parseInt(
      this.config.get<string>('CALCULA_AI_API_UPLOAD_RETRIES') ?? '3',
      10,
    )
    const baseDelayMs = 300
    let lastErr: unknown
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const started = Date.now()
      try {
        const form = new FormData()
        form.append(
          'file',
          new Blob([arrayBuffer], { type: contentType }),
          filename,
        )
        if (caption) form.append('quantity', caption)
        const res = await fetch(this.buildUrl('/v1/sessions/prices'), {
          method: 'POST',
          headers: { session: sessionId },
          body: form,
        })
        if (res.ok && res.status === 202) {
          const elapsed = Date.now() - started
          this.logger.log(
            `uploadPricesImage success (status=204, size=${arrayBuffer.byteLength} bytes, attempt=${attempt}, elapsed=${elapsed}ms)`,
          )
          return
        }
        const bodyText = await res.text().catch(() => '')
        throw new Error(
          `Unexpected response (status=${res.status}, ok=${res.ok}) ${bodyText?.slice(0, 500)}`,
        )
      } catch (err) {
        lastErr = err
        if (attempt >= maxRetries) break
        const delay =
          baseDelayMs * 2 ** (attempt - 1) + Math.floor(Math.random() * 100)
        this.logger.warn(
          `uploadPricesImage attempt ${attempt} failed: ${
            err instanceof Error ? err.message : String(err)
          } – retrying in ${delay}ms (remaining=${maxRetries - attempt})`,
        )
        await this.sleep(delay)
      }
    }
    throw new Error(
      `Price API upload failed after ${maxRetries} attempts: ${
        lastErr instanceof Error ? lastErr.message : String(lastErr)
      }`,
    )
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  async addPrice(options: {
    sessionId: string
    name: string
    value: number
    quantity: number
  }): Promise<void> {
    const { sessionId, name, value, quantity } = options

    const form = new FormData()
    form.append('name', name)
    form.append('value', value.toString())
    form.append('quantity', quantity.toString())

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

  async deletePrice(options: {
    sessionId: string
    priceId: string
  }): Promise<void> {
    const { sessionId, priceId } = options

    const res = await fetch(this.buildUrl(`/v1/sessions/prices/${priceId}`), {
      method: 'DELETE',
      headers: {
        session: sessionId,
      },
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
