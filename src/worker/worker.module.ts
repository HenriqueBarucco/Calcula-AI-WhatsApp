import { Module, forwardRef } from '@nestjs/common'
import { WorkerService } from './worker.service'
import { CommandModule } from 'src/command/command.module'
import { MessageModule } from 'src/message/message.module'

@Module({
  imports: [CommandModule, forwardRef(() => MessageModule)],
  providers: [WorkerService],
  exports: [WorkerService],
})
export class WorkerModule {}
