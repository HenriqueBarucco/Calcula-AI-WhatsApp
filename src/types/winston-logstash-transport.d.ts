declare module 'winston-logstash-transport' {
  import TransportStream from 'winston-transport'
  interface LogstashTransportOptions {
    host: string
    port: number
    retryInterval?: number
    maxRetries?: number
  }
  export class LogstashTransport extends TransportStream {
    constructor(options: LogstashTransportOptions)
  }
  export { LogstashTransport as default }
}
