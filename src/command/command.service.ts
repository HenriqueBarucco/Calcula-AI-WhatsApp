import { Injectable, Logger } from '@nestjs/common'
import { StorageService } from 'src/storage/storage.service'
import { CalculaAiApiService } from 'src/services/calcula-ai-api/calcula-ai-api.service'
import { MessageService } from 'src/message/message.service'
import { Message } from 'easy-whatsapp-lib/lib/cjs/types/message'
import { ConfigService } from '@nestjs/config'
import {
  formatCurrencyBRL,
  parseCurrencyToNumber,
  parseInteger,
} from 'src/helpers/number'
import { extractCommand } from 'src/helpers/command'
import { AddState } from 'src/types/add-state'

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

  async handleCommand(message: Message) {
    if (message?.type === 'image') {
      await this.handleImageMessage(message)
      return
    }

    const isCommandLike = message?.message?.trim().startsWith('/')
    if (!isCommandLike) {
      const continued = await this.processAddFlow(message)
      if (continued) return
    }

    const command = extractCommand(message.message)

    if (!command) return

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
      case 'list':
        await this.handleListCommand(message)
        break
      case 'add':
        await this.handleAddCommand(message)
        break
      case 'remove':
        await this.handleRemoveCommand(message)
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
        .map(
          (p) =>
            `• ${p.quantity > 1 ? `${p.quantity}x` : ''} ${p.name ?? '...'} - *${formatCurrencyBRL(p.value)}*`,
        )
        .join('\n')

      const lines = [
        `Valor total: *${formatCurrencyBRL(session.total)}* (${successCount} itens)`,
      ]

      if (pendingCount > 0) {
        lines.push(`Itens sendo processados: ${pendingCount}`)
      }

      lines.push('\n')

      lines.push(
        bullets && bullets.length > 0
          ? bullets
          : 'Não há nenhum item na lista.',
      )

      await this.messageService.sendMessage(message.group, lines.join('\n'))
    } catch (e) {
      await this.notify(
        'Não foi possível obter o total. Tente novamente mais tarde.',
      )
    }
  }

  private async handleListCommand(message: Message): Promise<void> {
    const sessionId = await this.getSessionId()
    if (!sessionId) return

    try {
      const session = await this.calculaAiApi.getSession({ sessionId })
      const prices = (session.prices ?? []).filter(
        (p) => p.status.toUpperCase() === 'SUCCESS',
      )

      const lines: string[] = [
        'Produtos na lista 📃',
        `Valor total atual: *${formatCurrencyBRL(session.total)}*`,
        '',
      ]

      if (prices.length === 0) {
        lines.push('Não há nenhum item na lista.')
      } else {
        lines.push(
          ...prices.map((p) => {
            const id = p.id.slice(0, 3)
            const quantityPart = p.quantity > 1 ? `${p.quantity}x ` : ''
            const name = p.name
            const price = formatCurrencyBRL(p.value)
            return `(*${id}*) - ${quantityPart}${name} - *${price}*`
          }),
        )
      }

      await this.messageService.sendMessage(message.group, lines.join('\n'))
    } catch (e) {
      await this.notify(
        'Não foi possível obter a lista. Tente novamente mais tarde.',
      )
    }
  }

  private async handleAddCommand(message: Message): Promise<void> {
    const sessionId = await this.getSessionId()
    if (!sessionId) return

    const key = this.buildAddStateKey(message.phone)

    const state: AddState = { step: 'NAME' }
    await this.storage.set(key, state)
    await this.messageService.sendMessage(
      message.group,
      'Qual o nome do produto que deseja adicionar?',
    )
  }

  private async handleRemoveCommand(message: Message): Promise<void> {
    const sessionId = await this.getSessionId()
    if (!sessionId) return

    const raw = (message.message || '').trim()
    const match = raw.match(/^\/remove\s+([a-zA-Z0-9_-]{1,})/)
    if (!match) {
      await this.messageService.sendMessage(message.group, 'Uso: /remove <id>')
      return
    }
    const prefix = match[1].toLowerCase()

    try {
      const session = await this.calculaAiApi.getSession({ sessionId })
      const candidates = session.prices.filter((p) =>
        p.id?.toLowerCase().startsWith(prefix),
      )

      if (candidates.length === 0) {
        await this.messageService.sendMessage(
          message.group,
          'Não encontrei nenhum item com esse id.',
        )
        return
      }

      if (candidates.length > 1) {
        const sample = candidates
          .slice(0, 5)
          .map((p) => `(${p.id.slice(0, 3)}) ${p.name ?? '...'}`)
          .join(', ')
        await this.messageService.sendMessage(
          message.group,
          `Existe mais de um item com esse prefixo. Especifique melhor. Opções: ${sample}`,
        )
        return
      }

      const target = candidates[0]
      await this.calculaAiApi.deletePrice({
        sessionId,
        priceId: target.id,
      })

      await this.messageService.sendMessage(
        message.group,
        `Item (${target.id.slice(0, 3)}) '${target.name ?? '...'}' removido ✅`,
      )
    } catch (e) {
      this.logger.error(
        'Failed to remove price',
        e instanceof Error ? e.stack : String(e),
      )
      await this.messageService.sendMessage(
        message.group,
        'Não foi possível remover o item agora.',
      )
    }
  }

  private buildAddStateKey(phone: string): string {
    return `add:${phone}`
  }

  private async processAddFlow(message: Message): Promise<boolean> {
    if (!message?.phone) return false
    const key = this.buildAddStateKey(message.phone)
    const state = await this.storage.get<AddState>(key)
    if (!state) return false

    const text = (message.message || '').trim()
    if (!text) return true

    try {
      if (state.step === 'NAME') {
        state.name = text
        state.step = 'VALUE'
        await this.storage.set(key, state)
        await this.messageService.sendMessage(
          message.group,
          'Qual o valor desse produto?',
        )
        return true
      }

      if (state.step === 'VALUE') {
        const value = parseCurrencyToNumber(text)
        if (value == null) {
          await this.messageService.sendMessage(
            message.group,
            'Valor inválido. Tente novamente. Ex: 12,34',
          )
          return true
        }
        state.value = value
        state.step = 'QUANTITY'
        await this.storage.set(key, state)
        await this.messageService.sendMessage(
          message.group,
          'Qual a quantidade que deseja adicionar deste produto?',
        )
        return true
      }

      if (state.step === 'QUANTITY') {
        const qty = parseInteger(text)
        if (qty == null || qty <= 0) {
          await this.messageService.sendMessage(
            message.group,
            'Quantidade inválida. Digite um número inteiro maior que 0.',
          )
          return true
        }
        state.quantity = qty

        await this.calculaAiApi.addPrice({
          sessionId: await this.getSessionId(),
          name: state.name,
          value: state.value,
          quantity: state.quantity,
        })

        this.logger.log('Price API success')

        await this.storage.remove(key)
        return true
      }
    } catch (err) {
      this.logger.error(
        'Failed processing add flow',
        err instanceof Error ? err.stack : String(err),
      )
      await this.storage.remove(key)
    }

    return true
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
