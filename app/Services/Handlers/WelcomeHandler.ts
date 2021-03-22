import { ExtendedWebSocket, ResSchema } from '../Ws'
import DefaultHandler from './DefaultHandler'
import { MessageType } from 'befriendlier-shared'

export default class WelcomeHandler extends DefaultHandler {
  public messageType = MessageType.WELCOME

  public async onClientResponse (socket: ExtendedWebSocket, res: ResSchema) {
    if (res.data === undefined) {
      // A new websocket has connected/reconnected.

      // Send the current Twitch chat connection token
      socket.send(this.ws.socketMessage(MessageType.TOKEN, JSON.stringify(this.ws.token)))

      // Request an array of all chats client is connected to.
      socket.send(this.ws.socketMessage(MessageType.CHATS, JSON.stringify('')))
    }
  }
}
