import { Module } from '@nestjs/common'
import { WorkerService } from './worker.service'
import { CommandModule } from 'src/command/command.module'

@Module({
  imports: [CommandModule],
  providers: [WorkerService],
  exports: [WorkerService],
})
export class WorkerModule {}
