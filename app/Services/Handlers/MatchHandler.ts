import { ExtendedWebSocket, ResSchema } from '../Ws'
import DefaultHandler from './DefaultHandler'
import { BASE, MessageType } from 'befriendlier-shared'
import Handler from '../Handler'

export default class MatchHandler extends DefaultHandler {
  public messageType = MessageType.MATCH

  public async onClientResponse (socket: ExtendedWebSocket, res: ResSchema) {
    if (res.data !== undefined) {
      const data: BASE = JSON.parse(res.data)
      const result = await Handler.match(data)

      switch (result.attempt) {
        case MessageType.MATCH: {
          // Attempted to match. Must wait for receiving end.
          data.result = {
            value: `you are attempting to match with a ${data.global === true ? 'global ' : ''}user. Good luck! ` +
            'You will receive a notification on a successful match!',
          }
          socket.send(this.ws.socketMessage(MessageType.MATCH, JSON.stringify(data)))
          break
        }
        case MessageType.SUCCESS: {
          if (result.matchUser !== undefined) {
            // Successfully matched!
            data.result = {
              matchUsername: result.matchUser.name,
              value: 'you have matched with %s%! Send them a message?',
            }
            socket.send(this.ws.socketMessage(MessageType.SUCCESS, JSON.stringify(data)))
          }
          break
        }
      }
    }
  }
}
