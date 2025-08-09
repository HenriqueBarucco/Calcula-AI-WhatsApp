import { Inject, Injectable, OnModuleInit, forwardRef } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { EasyWhatsApp } from 'easy-whatsapp-lib'
import { Message } from 'easy-whatsapp-lib/lib/cjs/types/message'
import { WorkerService } from 'src/worker/worker.service'

@Injectable()
export class EasyWhatsAppService implements OnModuleInit {
  private connection: EasyWhatsApp

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
      console.error('Worker processing failed:', err)
    }
  }

  async sendMessage(phone: string, message: string) {
    this.connection.sendMessage(phone, message)
  }
}
