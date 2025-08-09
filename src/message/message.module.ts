import { Module, forwardRef } from '@nestjs/common'
import { MessageService } from './message.service'
import { EasyWhatsAppModule } from 'src/services/easy-whatsapp/easy-whatsapp.module'

@Module({
  imports: [forwardRef(() => EasyWhatsAppModule)],
  providers: [MessageService],
  exports: [MessageService],
})
export class MessageModule {}
