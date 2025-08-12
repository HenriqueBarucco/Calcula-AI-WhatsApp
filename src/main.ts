import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { ConfigService } from '@nestjs/config'
import { createAppLogger } from './logger/logger'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: createAppLogger(),
  })
  const config = app.get(ConfigService)
  const port = config.get<number>('PORT', 3000)
  await app.listen(port)
}
bootstrap()
