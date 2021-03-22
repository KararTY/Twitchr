import { ExtendedWebSocket, ResSchema } from '../Ws'
import DefaultHandler from './DefaultHandler'
import { MessageType, UNMATCH } from 'befriendlier-shared'
import Handler from '../Handler'

export default class UnmatchHandler extends DefaultHandler {
  public messageType = MessageType.UNMATCH

  public async onClientResponse (socket: ExtendedWebSocket, res: ResSchema) {
    if (res.data !== undefined) {
      const data: UNMATCH = JSON.parse(res.data)
      const hasUnmatched = await Handler.unmatch(data)
      data.result = {
        value: `you have ${hasUnmatched
          ? `successfully unmatched with ${String(data.matchUserTwitch.name)}.`
          : 'unsuccessfully unmatched. FeelsBadMan In fact, you were never matched with them to begin with...'
        }`,
      }
      socket.send(this.ws.socketMessage(MessageType.UNMATCH, JSON.stringify(data)))
    }
  }
}
