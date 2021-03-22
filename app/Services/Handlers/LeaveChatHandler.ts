import { ExtendedLEAVECHAT, ExtendedWebSocket, ResSchema } from '../Ws'
import DefaultHandler from './DefaultHandler'
import { MessageType } from 'befriendlier-shared'
import Handler from '../Handler'

export default class LeaveChatHandler extends DefaultHandler {
  public messageType = MessageType.LEAVECHAT

  public async onClientResponse (socket: ExtendedWebSocket, res: ResSchema): Promise<void> {
    if (res.data === undefined) {
      return
    }

    const data: ExtendedLEAVECHAT = JSON.parse(res.data)
    const user = await Handler.findUserByTwitchID(data.leaveUserTwitch.id)

    data.socketId = socket.id

    if (user === null) {
      data.result = {
        value: 'user does not exist in the database. ' +
          'Can only remove favorited or otherwise registered users.'
      }
      socket.send(this.ws.socketMessage(MessageType.ERROR, JSON.stringify(data)))
      return
    }

    user.host = false
    await user.save()

    // When the bot gets banned, the userTwitch's variables are empty.
    if (data.userTwitch.name.length > 0 && data.userTwitch.id.length > 0) {
      data.result = {
        value: `leaving ${data.leaveUserTwitch.name}...`
      }

      socket.send(this.ws.socketMessage(MessageType.SUCCESS, JSON.stringify(data)))
    }

    this.ws.request(data, this.ws.removeHost)
  }
}
