import { Module } from '@nestjs/common'
import { CommandService } from './command.service'
import { StorageModule } from 'src/storage/storage.module'
import { CalculaAiApiModule } from 'src/services/calcula-ai-api/calcula-ai-api.module'
import { MessageModule } from 'src/message/message.module'

@Module({
  imports: [StorageModule, CalculaAiApiModule, MessageModule],
  providers: [CommandService],
  exports: [CommandService],
})
export class CommandModule {}
