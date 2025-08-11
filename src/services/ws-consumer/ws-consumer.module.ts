import { Module, forwardRef } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { StorageModule } from 'src/storage/storage.module'
import { WorkerModule } from 'src/worker/worker.module'
import { WsConsumerService } from './ws-consumer.service'

@Module({
  imports: [ConfigModule, forwardRef(() => WorkerModule), StorageModule],
  providers: [WsConsumerService],
})
export class WsConsumerModule {}
