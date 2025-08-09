declare module 'node-persist' {
  interface InitOptions {
    dir?: string
    stringify?: (data: unknown) => string
    parse?: (text: string) => unknown
    encoding?: string
    forgiveParseErrors?: boolean
  }
  export function init(options?: InitOptions): Promise<void>
  export function getItem<T = unknown>(key: string): Promise<T | undefined>
  export function setItem<T = unknown>(key: string, value: T): Promise<void>
  export function removeItem(key: string): Promise<void>
}
