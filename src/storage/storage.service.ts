import { Injectable, OnModuleInit } from '@nestjs/common'
import * as storage from 'node-persist'

@Injectable()
export class StorageService implements OnModuleInit {
  async onModuleInit() {
    await storage.init({
      dir: '.local-storage',
      stringify: JSON.stringify,
      parse: JSON.parse,
      encoding: 'utf8',
      forgiveParseErrors: true,
    })
  }

  async get<T = unknown>(key: string): Promise<T | undefined> {
    return (await storage.getItem(key)) as T | undefined
  }

  async set<T = unknown>(key: string, value: T): Promise<void> {
    await storage.setItem<T>(key, value)
  }

  async remove(key: string): Promise<void> {
    await storage.removeItem(key)
  }
}
