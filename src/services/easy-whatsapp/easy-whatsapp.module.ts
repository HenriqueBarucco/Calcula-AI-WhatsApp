import { Module, forwardRef } from '@nestjs/common'
import { EasyWhatsAppService } from './easy-whatsapp.service'
import { CommandModule } from 'src/command/command.module'
import { WorkerModule } from 'src/worker/worker.module'

@Module({
  imports: [CommandModule, forwardRef(() => WorkerModule)],
  providers: [EasyWhatsAppService],
  exports: [EasyWhatsAppService],
})
export class EasyWhatsAppModule {}
