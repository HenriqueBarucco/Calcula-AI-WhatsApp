import { Injectable, Logger } from '@nestjs/common'
import { StorageService } from 'src/storage/storage.service'
import { CalculaAiApiService } from 'src/services/calcula-ai-api/calcula-ai-api.service'
import { MessageService } from 'src/message/message.service'
import { Message } from 'easy-whatsapp-lib/lib/cjs/types/message'
import { ConfigService } from '@nestjs/config'
import { formatCurrencyBRL } from 'src/helpers/number'

const SESSION_KEY = 'sessionId'

@Injectable()
export class CommandService {
  private readonly logger = new Logger(CommandService.name)
  // eslint-disable-next-line no-useless-constructor
  constructor(
    private readonly storage: StorageService,
    private readonly calculaAiApi: CalculaAiApiService,
    private readonly messageService: MessageService,
    private readonly config: ConfigService,
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
        this.notify('Esse comando não existe não... 🤔')
        break
    }
  }

  private async startSession(): Promise<void> {
    const existing = await this.storage.get<string>(SESSION_KEY)
    if (existing) {
      this.logger.log('Session already exists, skipping start')
      this.notify('Já existe uma sessão iniciada. Use /end para encerrar.')
      return
    }

    const id = await this.calculaAiApi.createSession()
    await this.storage.set(SESSION_KEY, id)
    this.logger.log(`Session started: ${id}`)
    this.notify('Sessão iniciada com sucesso. 🛒')
  }

  private async endSession(): Promise<void> {
    await this.storage.remove(SESSION_KEY)
    this.logger.log('Session ended and local key cleared')

    this.notify('Sessão encerrada com sucesso. 💰')
  }

  private async handleTotalCommand(message: Message): Promise<void> {
    const sessionId = await this.getSessionId()
    if (!sessionId) return

    try {
      const session = await this.calculaAiApi.getSession({ sessionId })
      const prices = session.prices ?? []
      const successCount = prices.filter(
        (p) => p.status?.toUpperCase() === 'SUCCESS',
      ).length
      const pendingCount = prices.filter(
        (p) => p.status?.toUpperCase() === 'PENDING',
      ).length

      const preview = prices.filter((p) => p.status?.toUpperCase() !== 'FAILED')
      const top5 = preview.slice(0, 5)
      const bullets = top5
        .filter((p) => p.status?.toUpperCase() === 'SUCCESS')
        .map((p) => `• ${p.name ?? '...'} - *${formatCurrencyBRL(p.value)}*`)
        .join('\n')

      const lines = [
        `Valor total: *${formatCurrencyBRL(session.total)}* (${successCount} itens)`,
      ]

      if (pendingCount > 0) {
        lines.push(`Itens aguardando serem processados: ${pendingCount}`)
      }

      lines.push('\n')

      lines.push(
        bullets && bullets.length > 0
          ? bullets
          : 'Não há nenhum item na lista.',
      )

      await this.messageService.sendMessage(
        message.group ?? message.phone,
        lines.join('\n'),
      )
    } catch (e) {
      await this.notify(
        'Não foi possível obter o total. Tente novamente mais tarde.',
      )
    }
  }

  private async handleImageMessage(message: Message): Promise<void> {
    const sessionId = await this.getSessionId()
    if (!sessionId) return

    const { data, mimetype, caption } = message
    if (!data) {
      this.logger.warn('Image message missing data payload.')
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
        this.logger.error('Failed to decode image base64 data')
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
      this.logger.log('Price API success')

      await this.notify('Já estou indo processar essa imagem! 👀')
    } catch (e) {
      this.logger.error(
        'Price API failed',
        e instanceof Error ? e.stack : String(e),
      )
    }
  }

  private async getSessionId(): Promise<string | undefined> {
    const sessionId = await this.storage.get<string>(SESSION_KEY)
    if (!sessionId) {
      await this.notify('Nenhuma sessão iniciada. Use /start primeiro.')
      return undefined
    }
    return sessionId
  }

  private async notify(message: string) {
    const group = this.config.get<string>('GROUP')
    await this.messageService.sendMessage(group, message)
  }
}
