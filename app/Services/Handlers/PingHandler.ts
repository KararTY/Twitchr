import { ExtendedWebSocket, ResSchema } from '../Ws'
import DefaultHandler from './DefaultHandler'
import { MessageType } from 'befriendlier-shared'

export default class PingHandler extends DefaultHandler {
  public messageType = MessageType.PING

  public async onClientResponse (socket: ExtendedWebSocket, res: ResSchema) {
    if (res.data !== undefined) {
      socket.send(this.ws.socketMessage(MessageType.PING, res.data))
    }
    // TODO: HANDLE HEALTHCHECK
  }
}
