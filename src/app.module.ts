import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { EasyWhatsAppModule } from './services/easy-whatsapp/easy-whatsapp.module'
import { CommandModule } from './command/command.module'
import { MessageModule } from './message/message.module'
import { WorkerModule } from './worker/worker.module'
import { StorageModule } from './storage/storage.module'
import { WsConsumerModule } from './services/ws-consumer/ws-consumer.module'
import { HealthModule } from './health/health.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EasyWhatsAppModule,
    CommandModule,
    MessageModule,
    WorkerModule,
    StorageModule,
    WsConsumerModule,
    HealthModule,
  ],
})
export class AppModule {}
