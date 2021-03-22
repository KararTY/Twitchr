import WebsocketServer, { ExtendedWebSocket, ResSchema } from '../Ws'

export default class DefaultHandler {
  public messageType = 'DEFAULT'
  protected readonly ws: typeof WebsocketServer

  constructor (ws: typeof WebsocketServer) {
    this.ws = ws
  }

  public async onClientResponse (_socket: ExtendedWebSocket, _res: ResSchema): Promise<void> {}
}
