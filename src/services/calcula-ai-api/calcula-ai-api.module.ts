import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { CalculaAiApiService } from './calcula-ai-api.service'

@Module({
  imports: [ConfigModule],
  providers: [CalculaAiApiService],
  exports: [CalculaAiApiService],
})
export class CalculaAiApiModule {}
