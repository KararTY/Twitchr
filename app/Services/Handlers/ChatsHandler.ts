import { ExtendedWebSocket, ResSchema } from '../Ws'
import DefaultHandler from './DefaultHandler'
import { MessageType, NameAndId } from 'befriendlier-shared'
import Handler from '../Handler'

export default class ChatsHandler extends DefaultHandler {
  public messageType = MessageType.CHATS

  public async onClientResponse (socket: ExtendedWebSocket, res: ResSchema): Promise<void> {
    if (res.data === undefined) {
      return
    }

    const data = JSON.parse(res.data)

    if (data.requestTime !== undefined) {
      // This is a request, probably by the "@@join" command.
      this.ws.parseRequestResponse(socket, data)
      return
    }

    // Client has sent back a list of all channels.
    const socketChannels: Array<{ id: string, channels: string[] }> = []

    /**
      * Make a validation check to make sure that this bot
      * hasn't joined any duplicate channels from other bots.
      */

    for (const client of this.ws.server.clients) {
      const sock = client as ExtendedWebSocket

      socketChannels.push({ id: sock.id, channels: sock.channels.map(channel => channel.id) })
    }

    for (let index = 0; index < data.value.length; index++) {
      const channel = data.value[index]

      const foundChannel = socketChannels.find(sock => sock.channels.includes(channel.id))

      if (foundChannel !== undefined) {
        const data = { leaveUserTwitch: channel }
        socket.send(this.ws.socketMessage(MessageType.LEAVECHAT, JSON.stringify(data)))
      } else {
        socket.channels.push({ id: channel.id, name: channel.name })
      }
    }

    // WARNING: THE FOLLOWING CODE IS SPAGHETTI. TODO: FIX THIS MESS.

    // Add channels not yet handled by any client.
    const allHostedUsers = (await Handler.findAllHostedChannels()).map(user => {
      return { id: user.twitchID, name: user.name }
    })

    const flattenedArrayOfJoinedChannelIds =
        socketChannels.map(sock => sock.channels).flat()

    const userIdsNotHosted =
        allHostedUsers
          .filter(user => !flattenedArrayOfJoinedChannelIds.includes(user.id))
          .map(user => user.id)

    for (let index = 0; index < userIdsNotHosted.length; index++) {
      const userIdNotHosted = userIdsNotHosted[index]
      const userNotHosted = allHostedUsers.find(user => user.id === userIdNotHosted) as NameAndId

      // Get socket with lowest joined channels.
      socketChannels.sort((a, b) => {
        return a.channels.length - b.channels.length
      })

      // Udate current temporary array with channel count
      socketChannels[0].channels.push(userNotHosted.id)

      for (const client of this.ws.server.clients) {
        const sock = client as ExtendedWebSocket
        if (sock.id === socketChannels[0].id) {
          const data = { joinUserTwitch: userNotHosted }

          sock.channels.push(userNotHosted)

          sock.send(this.ws.socketMessage(MessageType.JOINCHAT, JSON.stringify(data)))
          break
        }
      }
    }
  }
}
