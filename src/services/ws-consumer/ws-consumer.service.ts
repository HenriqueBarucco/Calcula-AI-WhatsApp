import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  forwardRef,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  Client,
  FrameImpl,
  IMessage,
  Stomp,
  IStompSocket,
} from '@stomp/stompjs'
import { WorkerService } from 'src/worker/worker.service'
import { parseJson } from 'src/helpers/json'
import { isPriceAnnounceMessage } from 'src/helpers/price'
import { StorageService } from 'src/storage/storage.service'

interface WsCloseEvent {
  code?: number
  reason?: string
  wasClean?: boolean
}

@Injectable()
export class WsConsumerService implements OnModuleInit {
  private client: Client | null = null
  private currentSessionId: string | null = null
  private sessionCheckTimer: NodeJS.Timeout | null = null
  private unsubscribeFn: (() => void) | null = null
  private readonly logger = new Logger(WsConsumerService.name)

  // eslint-disable-next-line no-useless-constructor
  constructor(
    private readonly config: ConfigService,
    @Inject(forwardRef(() => WorkerService))
    private readonly worker: WorkerService,
    private readonly storage: StorageService,
  ) {}

  async onModuleInit() {
    const url = this.config.get<string>('WS_URL')

    if (!url) {
      this.logger.warn('WS_URL env not set; skipping WS connection')
      return
    }
    this.logger.log(`Scheduling WS connection to ${url}`)
    setTimeout(() => this.connect(url).catch(() => {}), 500)
  }

  private async connect(url: string) {
    if (this.client?.connected) return

    this.logger.log(`Connecting to WebSocket/STOMP at ${url}`)
    this.client = Stomp.over(() => this.createWs(url))

    const reconnectDelay = Number(this.config.get('WS_RECONNECT_DELAY') ?? 5000)
    const heartbeatIncoming = Number(this.config.get('WS_HEARTBEAT_IN') ?? 0)
    const heartbeatOutgoing = Number(
      this.config.get('WS_HEARTBEAT_OUT') ?? 15000,
    )

    this.client.reconnectDelay = Number.isFinite(reconnectDelay)
      ? reconnectDelay
      : 5000
    this.client.heartbeatIncoming = Number.isFinite(heartbeatIncoming)
      ? heartbeatIncoming
      : 0
    this.client.heartbeatOutgoing = Number.isFinite(heartbeatOutgoing)
      ? heartbeatOutgoing
      : 15000
    this.client.appendMissingNULLonIncoming = true
    this.client.forceBinaryWSFrames = false
    this.client.debug = () => {}

    await new Promise<void>((resolve) => {
      this.client!.onConnect = () => {
        this.logger.log('Connected to STOMP broker')
        this.initSessionWatcher()
        this.storage
          .get<string>('sessionId')
          .then((sid) => this.resubscribe(sid || null))
          .catch(() => undefined)
        resolve()
      }
      this.client!.onStompError = (frame: FrameImpl) => {
        this.logger.error(`Broker reported error: ${frame.headers.message}`)
        if (frame.body) this.logger.error(`Details: ${frame.body}`)
      }
      this.client!.onDisconnect = () => {
        this.logger.log('Disconnected from STOMP broker')
      }
      this.client!.onWebSocketClose = (evt: unknown) => {
        const { code, reason, wasClean } = (evt as WsCloseEvent) || {}
        const codeSafe = code ?? -1
        const reasonSafe = reason ?? 'n/a'
        const cleanSafe = wasClean ?? false
        this.logger.warn(
          `WebSocket closed (code=${codeSafe}, clean=${cleanSafe}) reason=${reasonSafe}`,
        )
      }
      this.client!.onWebSocketError = (evt: unknown) => {
        if (evt instanceof Error) {
          this.logger.error('WebSocket error', evt.stack)
        } else {
          this.logger.error(`WebSocket error: ${String(evt)}`)
        }
      }
      this.client!.activate()
    })
  }

  private createWs(url: string): IStompSocket {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const SockJS = require('sockjs-client')

      const transportsEnv = this.config.get<string>('WS_TRANSPORTS')
      const transports = (transportsEnv || 'websocket')
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
      this.logger.log(`Using SockJS transport(s): ${transports.join(',')}`)
      const sock = new SockJS(url, null, { transports })
      return sock as unknown as IStompSocket
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.logger.error(`Failed to initialize SockJS client: ${msg}`)
      throw err
    }
  }

  private initSessionWatcher() {
    const poll = async () => {
      try {
        const newId = (await this.storage.get<string>('sessionId')) || null
        if (newId !== this.currentSessionId && this.client?.connected) {
          this.logger.log('SessionId change detected')
          this.resubscribe(newId)
        }
      } catch (e) {
        // ignore
      }
    }
    poll()
    this.sessionCheckTimer && clearInterval(this.sessionCheckTimer)
    this.sessionCheckTimer = setInterval(poll, 5000)
  }

  private resubscribe(newSessionId: string | null) {
    if (this.unsubscribeFn) {
      try {
        this.unsubscribeFn()
      } catch {}
      this.unsubscribeFn = null
      this.logger.log('Unsubscribed from previous destination')
    }
    this.currentSessionId = newSessionId
    if (!newSessionId) return
    this.logger.log(`Subscribing to destination: ${newSessionId}`)
    this.unsubscribeFn = this.subscribe(newSessionId)
  }

  private subscribe(sessionId: string): () => void {
    const sub = this.client?.subscribe(
      `/topic/${sessionId}`,
      (msg: IMessage) => {
        this.logger.debug(`Received WS message on ${sessionId}`)
        this.handle(msg)
      },
    )
    this.logger.log(`Subscribed to ${sessionId}`)
    return () => sub?.unsubscribe()
  }

  private async handle(msg: IMessage) {
    try {
      const body = (msg.body || '').toString().trim()
      if (!body) return

      const payload = parseJson(body)
      if (!payload) {
        this.logger.warn('WS message is not valid JSON; skipping')
        return
      }

      if (!isPriceAnnounceMessage(payload)) {
        this.logger.warn(
          'WS JSON payload does not match PriceAnnounceMessage; skipping',
        )
        return
      }
      await this.worker.handlePriceAnnounce(payload)
    } catch (e) {
      if (e instanceof Error) {
        this.logger.error('Failed to process WS message', e.stack)
      } else {
        this.logger.error(`Failed to process WS message: ${String(e)}`)
      }
    }
  }
}
