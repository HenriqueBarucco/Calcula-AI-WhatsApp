import { Injectable } from '@nestjs/common'
import { StorageService } from 'src/storage/storage.service'
import { CalculaAiApiService } from 'src/services/calcula-ai-api/calcula-ai-api.service'
import { MessageService } from 'src/message/message.service'
import { Message } from 'easy-whatsapp-lib/lib/cjs/types/message'

const SESSION_KEY = 'sessionId'

@Injectable()
export class CommandService {
  // eslint-disable-next-line no-useless-constructor
  constructor(
    private readonly storage: StorageService,
    private readonly calculaAiApi: CalculaAiApiService,
    private readonly messageService: MessageService,
  ) {}

  async handleCommand(command: string, message: Message) {
    if (message?.type === 'image') {
      await this.handleImageMessage(message)
      return
    }

    switch (command) {
      case 'start':
        await this.startSession()
        break
      case 'end':
        await this.endSession()
        break
      case 'total':
        await this.handleTotalCommand(message)
        break
      default:
        console.log(`Command ${command} not found`)
        break
    }
  }

  private async startSession(): Promise<void> {
    const existing = await this.storage.get<string>(SESSION_KEY)
    if (existing) {
      console.log('Session already exists, skipping start')
      return
    }

    const id = await this.calculaAiApi.createSession()
    await this.storage.set(SESSION_KEY, id)
    console.log('Session started:', id)
  }

  private async endSession(): Promise<void> {
    await this.storage.remove(SESSION_KEY)
    console.log('Session ended and local key cleared')
  }

  private async handleTotalCommand(message: Message): Promise<void> {
    const sessionId = await this.getSessionId()
    if (!sessionId) {
      await this.messageService.sendMessage(
        message.group ?? message.phone,
        'Nenhuma sessão iniciada. Use /start primeiro.',
      )
      return
    }

    try {
      const session = await this.calculaAiApi.getSession({ sessionId })
      const successCount = session.prices.filter(
        (p) => p.status?.toUpperCase() === 'SUCCESS',
      ).length
      const top5 = session.prices.slice(0, 5)
      const bullets = top5
        .map((p) => {
          const statusLabel =
            p.status?.toUpperCase() === 'SUCCESS' ? 'OK' : 'PROCESSING'
          const name = p.name ?? 'Sem nome'
          const value = typeof p.value === 'number' ? p.value.toFixed(2) : '—'
          return `• ${name} - ${value} (${statusLabel})`
        })
        .join('\n')

      const lines = [
        `Total: ${session.total.toFixed(2)}`,
        `Concluídos: ${successCount}`,
        bullets && bullets.length > 0 ? bullets : '—',
      ]

      await this.messageService.sendMessage(
        message.group ?? message.phone,
        lines.join('\n'),
      )
    } catch (e) {
      await this.messageService.sendMessage(
        message.group ?? message.phone,
        'Não foi possível obter o total. Tente novamente mais tarde.',
      )
    }
  }

  private async handleImageMessage(message: Message): Promise<void> {
    const sessionId = await this.getSessionId()
    if (!sessionId) {
      await this.messageService.sendMessage(
        message.group ?? message.phone,
        'Nenhuma sessão iniciada. Use /start primeiro.',
      )
      return
    }

    const { data, mimetype, caption } = message
    if (!data) {
      console.warn('Image message missing data payload.')
      return
    }

    let buffer: Buffer
    let contentType = mimetype || 'application/octet-stream'
    let filename = 'image'

    const dataUrlMatch = data.match(/^data:([^;]+);base64,(.*)$/)
    if (dataUrlMatch) {
      contentType = dataUrlMatch[1] || contentType
      buffer = Buffer.from(dataUrlMatch[2], 'base64')
      const ext = contentType.split('/')[1] || 'bin'
      filename = `upload.${ext}`
    } else {
      try {
        buffer = Buffer.from(data, 'base64')
      } catch (e) {
        console.error('Failed to decode image base64 data')
        return
      }
      const ext = (contentType.split('/')[1] || 'bin').toLowerCase()
      filename = `upload.${ext}`
    }

    try {
      await this.calculaAiApi.uploadPricesImage({
        sessionId,
        file: buffer,
        contentType,
        filename,
        caption,
      })
      console.log('Price API success')
    } catch (e) {
      console.error('Price API failed:', e)
    }
  }

  async getSessionId(): Promise<string | undefined> {
    return this.storage.get<string>(SESSION_KEY)
  }
}
