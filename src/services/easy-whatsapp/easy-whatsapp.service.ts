import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  forwardRef,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { EasyWhatsApp } from 'easy-whatsapp-lib'
import { Message } from 'easy-whatsapp-lib/lib/cjs/types/message'
import { WorkerService } from 'src/worker/worker.service'

@Injectable()
export class EasyWhatsAppService implements OnModuleInit {
  private connection: EasyWhatsApp
  private readonly logger = new Logger(EasyWhatsAppService.name)

  // eslint-disable-next-line no-useless-constructor
  constructor(
    @Inject(forwardRef(() => WorkerService))
    private readonly workerService: WorkerService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const apiKey = this.config.get<string>('EASY_WHATSAPP_KEY', '')
    this.connection = new EasyWhatsApp(apiKey)

    this.connection.receiveMessage(this.handleReceivedMessage.bind(this))
  }

  private async handleReceivedMessage(message: Message): Promise<void> {
    try {
      await this.workerService.handleReceivedMessage(message)
    } catch (err) {
      this.logger.error(
        'Worker processing failed',
        err instanceof Error ? err.stack : String(err),
      )
    }
  }

  async sendMessage(phone: string, message: string) {
    this.connection.sendMessage(phone, message)
  }
}
