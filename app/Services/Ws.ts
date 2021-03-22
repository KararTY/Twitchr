import bourne from '@hapi/bourne'
import Env from '@ioc:Adonis/Core/Env'
import Logger from '@ioc:Adonis/Core/Logger'
import Server from '@ioc:Adonis/Core/Server'
import { schema, validator } from '@ioc:Adonis/Core/Validator'
import {
  BASE,
  JOINCHAT,
  LEAVECHAT,
  MessageType,
  NameAndId,
  REQUESTRESPONSE,
  TwitchAuth,
} from 'befriendlier-shared'
import { readdirSync, readFileSync } from 'fs'
import { IncomingMessage } from 'http'
import { Socket } from 'net'
import PQueue from 'p-queue'
import path from 'path'
import WS from 'ws'
import TwitchConfig from '../../config/twitch'
import DefaultHandler from './Handlers/DefaultHandler'

// Add command directory, we filter by .js because tsc converts files to .js
const commandDirectory = path.join(__dirname, 'Handlers')
const commandFiles = readdirSync(commandDirectory, 'utf-8').filter(fileName => fileName.endsWith('.js'))

interface Token {
  expiration: Date
  superSecret: string
  refreshToken: string
}

interface REQUEST {
  id: string
  sockets: Array<{ id: string, value: any }>
  func: Function
  value: any
  by: any
  total: number
}

export interface ExtendedWebSocket extends WS {
  id: string
  connection: Socket
  channels: NameAndId[]
  isAlive: boolean
}

export interface ExtendedJOINCHAT extends JOINCHAT {
  socketId: string
}

export interface ExtendedLEAVECHAT extends LEAVECHAT {
  socketId: string
}

export interface ResSchema {
  type: MessageType
  data: string | undefined
  timestamp: number
}

class WebSocketServer {
  private twitchAPI: TwitchAuth
  private reconnectTimeout: NodeJS.Timeout
  private readonly requests = new Map<string, REQUEST>()

  public isReady = false
  public server: WS.Server
  public token: Token
  public handlers: DefaultHandler[] = []
  public readonly queue = new PQueue({ concurrency: 1 })

  public start (callback: (socket: ExtendedWebSocket, request: IncomingMessage) => void): void {
    this.server = new WS.Server({ server: Server.instance })

    // eslint-disable-next-line no-void
    void this.loadHandlers().then(() => {
      this.server.on('connection', callback)
      this.isReady = true

      this.server.on('close', () => {
        clearInterval(this.interval)
      })

      this.twitchAPI = new TwitchAuth({
        clientToken: TwitchConfig.clientToken,
        clientSecret: TwitchConfig.clientSecret,
        redirectURI: '',
        scope: ['chat:read', 'chat:edit', 'whispers:read', 'whispers:edit'],
        headers: TwitchConfig.headers,
      }, Logger.level)

      try {
        // Define the file.
        const dir = path.join(__dirname, '../../../.supersecret.json')
        const token = JSON.parse(readFileSync(dir.toString(), 'utf-8'))

        // Set the environment variables.
        Env.set('TWITCH_BOT_ACCESS_TOKEN', token.access_token)
        Env.set('TWITCH_BOT_REFRESH_TOKEN', token.refresh_token)
        Env.set('TWITCH_BOT_ACCESS_TOKEN_EXPIRES_IN', new Date(Date.now() + (token.expires_in * 1000)).toUTCString())

        this.updateEnv()
      } catch (error) {
        Logger.error({ err: error }, 'Ws.start(): Could not load .supersecret.json')
        this.startTwitch()
      }
    })
  }

  public updateEnv (): void {
    this.token = {
      expiration: new Date(Env.get('TWITCH_BOT_ACCESS_TOKEN_EXPIRES_IN') as string),
      superSecret: Env.get('TWITCH_BOT_ACCESS_TOKEN') as string,
      refreshToken: Env.get('TWITCH_BOT_REFRESH_TOKEN') as string,
    }

    this.startTwitch()
  }

  public startTwitch (): void {
    if (this.reconnectTimeout !== undefined) {
      clearTimeout(this.reconnectTimeout)
    }

    if (this.token === undefined || this.token.superSecret === undefined) {
      Logger.warn('Ws.startTwitch(): Waiting for bot login...')
      this.reconnectTimeout = setTimeout(() => this.startTwitch(), 1000)
      return
    }

    this.checkTwitchToken(this.token).then(async res => {
      if (res.superSecret !== this.token.superSecret) {
        this.token = res

        Logger.info('Ws.startTwitch(): Attempting to send login information to bots...')
        // Send new token to all clients.
        for (const client of this.server.clients) {
          const socket = client as ExtendedWebSocket

          socket.send(this.socketMessage(MessageType.TOKEN, JSON.stringify(this.token)))
        }
      }

      this.reconnectTimeout = setTimeout(() => this.startTwitch(), 10000)
    }).catch((error) => {
      Logger.error({ err: error }, 'Ws.startTwitch(): Something went wrong trying to refresh or validate token!')
      this.reconnectTimeout = setTimeout(() => this.startTwitch(), 15000)
    })
  }

  // Is called from "start/socket.ts" file.
  public async onMessage (socket: ExtendedWebSocket, msg: WS.Data): Promise<void> {
    return await new Promise((resolve) => {
      Logger.debug({ msg }, 'Ws.onMessage()')
      let json

      try {
        json = bourne.parse(msg, null, { protoAction: 'remove' })
      } catch (error) {
        // Data's not JSON.
        Logger.error({ err: error }, 'Ws.onMessage(): Error with parsing websocket data.')
        return
      }

      validator.validate({
        schema: this.validationSchema,
        data: json,
        messages: {
          type: 'Invalid type.',
        },
        cacheKey: 'websocket',
      }).then(async res => {
        const foundCommand = this.handlers.filter(command => command.messageType.length !== 0)
          .find(command => command.messageType === res.type)

        if (foundCommand !== undefined) {
          await foundCommand.onClientResponse(socket, res)
        }

        // case MessageType.TOKEN: {
        //   socket.send(this.socketMessage(MessageType.TOKEN, JSON.stringify(this.token)))
        //   break
        // }
        resolve()
      }).catch(error => {
        if (error.message === MessageType.UNREGISTERED) {
          socket.send(this.socketMessage(MessageType.UNREGISTERED, JSON.stringify(error.data)))
        } else if (error.message === MessageType.TAKEABREAK) {
          socket.send(this.socketMessage(MessageType.TAKEABREAK, JSON.stringify(error.data)))
        } else if (error.message === MessageType.ERROR && error.data !== undefined) {
          socket.send(this.socketMessage(MessageType.ERROR, JSON.stringify(error.data)))
        } else if (error.message !== undefined) {
          Logger.error({ err: error }, 'Ws.handleMessage()')
          // socket.send(this.socketMessage(MessageType.ERROR, JSON.stringify(error)))
        }
        // Else ignore.
        resolve()
      })
    })
  }

  public onClose (socket: ExtendedWebSocket, code: number, reason: string): void {
    Logger.warn(`WEBSOCKET CLOSED: [${socket.id}] from ${prettySocketInfo(socket.connection)}, code: ${code}${reason.length > 0 ? `, reason:\n${reason}` : ''}`)
  }

  public onError (socket: ExtendedWebSocket, error: Error): void {
    Logger.error({ err: error }, `WEBSOCKET ERROR: [${socket.id}] from ${prettySocketInfo(socket.connection)}.`)
  }

  // https://github.com/websockets/ws#how-to-detect-and-close-broken-connections
  public heartbeat (socket: ExtendedWebSocket, data: Buffer): void {
    if (data.length > 0) {
      Logger.info(`PING MESSAGE: [${socket.id}] from ${prettySocketInfo(socket.connection)} \n${data.toString()}`)
    }
    socket.isAlive = true
  }

  public parseRequestResponse (socket: ExtendedWebSocket, message: REQUESTRESPONSE): void {
    const req = this.requests.get(message.requestTime)

    if (req === undefined) {
      Logger.error(`Ws.parseRequestResponse(): Undefined requestResponse by socket ${socket.id}: %O`, message)
      return
    }

    req.sockets.push({ id: socket.id, value: message.value })

    if (req.sockets.length === req.total) {
      req.func.bind(this)(req)
    }
  }

  public request (by, func, value?): void {
    const requestTime = Date.now().toString()
    this.requests.set(requestTime, {
      id: requestTime,
      sockets: [],
      func,
      value,
      by,
      total: 0,
    })

    // Force into REQUEST because we've defined it above, there's no risk of it being undefined.
    const req = this.requests.get(requestTime) as REQUEST

    this.server.clients.forEach((socket: ExtendedWebSocket) => {
      socket.send(this.socketMessage(MessageType.CHATS, JSON.stringify(requestTime)))
      req.total++
    })
  }

  public socketMessage (type: MessageType, data: string): string {
    return JSON.stringify({ type: type, data: data, timestamp: Date.now() })
  }

  /**
   * Tell a bot to join the following user's chat.
   */
  public addHost (request: REQUEST): void {
    // Make sure channel isn't already added by another bot.
    const foundChannelBot = request.sockets.find(sockRes => sockRes.value.includes(request.by.joinUserTwitch.name))

    if (foundChannelBot !== undefined) {
      for (const client of this.server.clients) {
        const socket = client as ExtendedWebSocket

        if (socket.id === request.by.socketId) {
          const data: BASE = {
            channelTwitch: request.by.channelTwitch,
            userTwitch: request.by.userTwitch,
            result: {
              value: `channel already added by bot "${foundChannelBot.id}".`,
            },
          }

          socket.send(this.socketMessage(MessageType.ERROR, JSON.stringify(data)))
          break
        }
      }

      this.requests.delete(request.id)
      return
    }

    // Get socket with lowest joined channels.
    const sortedAsc = request.sockets.sort((a, b) => {
      return a.value.length - b.value.length
    })

    for (const client of this.server.clients) {
      const socket = client as ExtendedWebSocket

      if (socket.id === sortedAsc[0].id) {
        const data = { joinUserTwitch: request.by.joinUserTwitch }

        socket.channels.push(request.by.joinUserTwitch)

        socket.send(this.socketMessage(MessageType.JOINCHAT, JSON.stringify(data)))

        this.requests.delete(request.id)
        break
      }
    }
  }

  public removeHost (request: REQUEST): void {
    const foundChannelBot = request.sockets.find(sockRes => {
      return sockRes.value.find((r: { name: string, id: string }) => r.name === request.by.leaveUserTwitch.name)
    })

    if (foundChannelBot !== undefined) {
      for (const client of this.server.clients) {
        const socket = client as ExtendedWebSocket

        if (socket.id === foundChannelBot.id) {
          // When the bot gets banned, the userTwitch's variables are empty.
          const data: LEAVECHAT = {
            channelTwitch: request.by.channelTwitch,
            userTwitch: request.by.userTwitch,
            leaveUserTwitch: request.by.leaveUserTwitch,
          }

          socket.send(this.socketMessage(MessageType.LEAVECHAT, JSON.stringify(data)))
          break
        }
      }

      this.requests.delete(request.id)
    }
  }

  private async refreshTwitchToken (token: Token): Promise<Token> {
    const newToken = { ...token }

    // Generate a token!
    const twitch = await this.twitchAPI.refreshToken(this.token.refreshToken)

    if (twitch === null) {
      throw new Error('Couldn\'t login to Twitch!')
    }

    newToken.expiration = new Date(Date.now() + (twitch.expires_in * 1000))
    newToken.superSecret = twitch.access_token
    newToken.refreshToken = twitch.refresh_token

    Logger.debug('Ws.refreshTwitchToken(): Refreshed Twitch token.')

    return newToken
  }

  private async validateTwitchToken (token: Token): Promise<Token> {
    const newToken = { ...token }

    // Validate token
    const twitch = await this.twitchAPI.validateToken(newToken.superSecret)

    if (twitch === null) {
      // Token is bad! Request a new one!
      return await this.refreshTwitchToken(newToken)
    }

    newToken.expiration = new Date(Date.now() + (twitch.expires_in * 1000))

    Logger.debug('Ws.validateTwitchToken(): Validated Twitch token.')

    return newToken
  }

  private async checkTwitchToken (token: Token): Promise<Token> {
    if (token.superSecret !== undefined) {
      return await this.validateTwitchToken(token)
    }

    return await this.refreshTwitchToken(token)
  }

  private readonly validationSchema = schema.create({
    type: schema.enum(Object.values(MessageType)),
    data: schema.string.optional(),
    timestamp: schema.number(),
  })

  private readonly interval = setInterval(() => {
    if (!this.isReady) {
      return
    }

    this.server.clients.forEach((socket: ExtendedWebSocket) => {
      Logger.debug(`PINGING: [${socket.id}] from ${prettySocketInfo(socket.connection)}.`)

      if (!socket.isAlive) {
        Logger.warn(`PING FAILED: [${socket.id}] from ${prettySocketInfo(socket.connection)}. TERMINATING.`)
        return socket.terminate()
      }

      socket.isAlive = false

      // Ping
      socket.ping()
    })
  }, 1000)

  private async loadHandlers (): Promise<void> {
    let currentFileDir: string = ''

    try {
      for (let index = 0; index < commandFiles.length; index++) {
        currentFileDir = commandFiles[index]
        const fullFileName = path.join(commandDirectory.toString(), commandFiles[index])

        // Import
        const Command = (await import(fullFileName)).default
        this.handlers.push(new Command(this))
      }
    } catch (error) {
      Logger.error({ err: error }, `Ws.loadHandlers(): Something went wrong while importing ${String(currentFileDir)}.`)
      setTimeout(() => {
        process.exit(0)
      }, 10000)
    }
  }
}

export function prettySocketInfo (connection: Socket): string {
  return `(${String(connection.remoteFamily)}) ${String(connection.remoteAddress)}:${String(connection.remotePort)}`
}

/**
 * This makes our service a singleton
 */
export default new WebSocketServer()
