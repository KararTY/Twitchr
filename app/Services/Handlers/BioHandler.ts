import { ExtendedWebSocket, ResSchema } from '../Ws'
import DefaultHandler from './DefaultHandler'
import { BIO, MessageType } from 'befriendlier-shared'
import Handler from '../Handler'

export default class BioHandler extends DefaultHandler {
  public messageType = MessageType.BIO

  public async onClientResponse (socket: ExtendedWebSocket, res: ResSchema) {
    if (res.data !== undefined) {
      const data: BIO = JSON.parse(res.data)

      if (data.bio.length > 0) {
        const bioRes = await Handler.setBio(data)
        const bio = bioRes.split(' ').map(word => `${word.substr(0, 1)}\u{E0000}${word.substr(1)}`).join(' ')

        data.result = { value: `Successfully set your ${data.global === true ? 'global' : 'profile'} bio. Here's a part of it: ${bio.length > 32 ? `${bio.substr(0, 32)}...` : bio}` }
      } else {
        const bioRes = await Handler.getBio(data)
        const bio = bioRes.split(' ').map(word => `${word.substr(0, 1)}\u{E0000}${word.substr(1)}`).join(' ')

        data.result = { value: `your ${data.global === true ? 'global' : 'profile'} bio: ${bio}` }
      }

      socket.send(this.ws.socketMessage(MessageType.BIO, JSON.stringify(data)))
    }
  }
}
