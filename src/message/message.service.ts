import { Inject, Injectable, forwardRef } from '@nestjs/common'
import { EasyWhatsAppService } from 'src/services/easy-whatsapp/easy-whatsapp.service'

@Injectable()
export class MessageService {
  // eslint-disable-next-line no-useless-constructor
  constructor(
    @Inject(forwardRef(() => EasyWhatsAppService))
    private readonly easyWhatsAppService: EasyWhatsAppService,
  ) {}

  async sendMessage(phone: string, message: string) {
    this.easyWhatsAppService.sendMessage(phone, message)
  }
}
