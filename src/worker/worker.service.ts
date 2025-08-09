import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Message } from 'easy-whatsapp-lib/lib/cjs/types/message'
import { CommandService } from 'src/command/command.service'

@Injectable()
export class WorkerService {
  // eslint-disable-next-line no-useless-constructor
  constructor(
    private readonly commandService: CommandService,
    private readonly config: ConfigService,
  ) {}

  async handleReceivedMessage(message: Message): Promise<void> {
    const isAllowedGroup = this.config.get<string>('ALLOWED_GROUP')
    if (isAllowedGroup && message?.group !== isAllowedGroup) return

    const text = (message.message || '').trim()
    if (!text) return

    const [maybeCommand] = text.split(/\s+/)
    const command = maybeCommand.replace(/^\//, '').toLowerCase()

    await this.commandService.handleCommand(command, message)
  }
}
