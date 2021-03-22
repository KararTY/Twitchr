import { ExtendedJOINCHAT, ExtendedWebSocket, ResSchema } from '../Ws'
import DefaultHandler from './DefaultHandler'
import { MessageType } from 'befriendlier-shared'
import Handler from '../Handler'

export default class JoinChatHandler extends DefaultHandler {
  public messageType = MessageType.JOINCHAT

  public async onClientResponse (socket: ExtendedWebSocket, res: ResSchema): Promise<void> {
    if (res.data === undefined) {
      return
    }

    const data: ExtendedJOINCHAT = JSON.parse(res.data)
    const user = await Handler.findUserByTwitchID(data.joinUserTwitch.id)

    data.socketId = socket.id

    if (user === null) {
      data.result = {
        value: 'user does not exist in the database. ' +
          'Can only add favorited or otherwise registered users.'
      }
      socket.send(this.ws.socketMessage(MessageType.ERROR, JSON.stringify(data)))
      return
    }

    user.host = true
    await user.save()

    if (data.userTwitch.name.length > 0 && data.userTwitch.id.length > 0) {
      data.result = {
        value: `joining ${data.joinUserTwitch.name}...`
      }

      socket.send(this.ws.socketMessage(MessageType.SUCCESS, JSON.stringify(data)))
    }

    this.ws.request(data, this.ws.addHost)
  }
}
