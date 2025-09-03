import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Message } from 'easy-whatsapp-lib/lib/cjs/types/message'
import { CommandService } from 'src/command/command.service'
import { MessageService } from 'src/message/message.service'
import { PriceAnnounceMessage } from 'src/types/price-announce-message'
import { getAllowedGroup, isMessageFromAllowedGroup } from 'src/helpers/group'
import { formatCurrencyBRL } from 'src/helpers/number'

@Injectable()
export class WorkerService {
  private readonly logger = new Logger(WorkerService.name)
  // eslint-disable-next-line no-useless-constructor
  constructor(
    private readonly commandService: CommandService,
    private readonly config: ConfigService,
    @Inject(forwardRef(() => MessageService))
    private readonly messageService: MessageService,
  ) {}

  async handleReceivedMessage(message: Message): Promise<void> {
    try {
      if (!isMessageFromAllowedGroup(message?.group, this.getAllowedGroup())) {
        this.logger.debug('Message ignored due to GROUP filter')
        return
      }

      await this.commandService.handleCommand(message)
    } catch (err) {
      const msg = err instanceof Error ? err.stack : String(err)
      this.logger.error('Failed to handle received message', msg)
    }
  }

  async handlePriceAnnounce(payload: PriceAnnounceMessage): Promise<void> {
    try {
      const group = this.getAllowedGroup()
      if (!group) {
        this.logger.warn('GROUP env not set; skipping outbound message')
        return
      }

      const text = this.formatPriceAnnounceMessage(payload)
      await this.messageService.sendMessage(group, text)
      this.logger.debug(`Price announcement sent to group ${group}`)
    } catch (err) {
      const msg = err instanceof Error ? err.stack : String(err)
      this.logger.error('Failed to handle price announcement', msg)
    }
  }

  private getAllowedGroup(): string | null {
    return getAllowedGroup((k) => this.config.get<string>(k))
  }

  private formatPriceAnnounceMessage(price: PriceAnnounceMessage): string {
    if (price.status === 'PENDING') {
      return 'Já estou processando essa imagem! 👀'
    }

    if (price.status === 'FAILED') {
      return 'Não foi possível processar essa foto... 😓'
    }

    const priceBRL = formatCurrencyBRL(price.value)
    const totalBRL = formatCurrencyBRL(price.total)

    const name = (price.name ?? '...').trim() || '...'
    return `"${name}" - *${priceBRL}* foi adicionado na lista! ✅\nValor total atual: *${totalBRL}*`
  }
}
