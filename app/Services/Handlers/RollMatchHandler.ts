import { ExtendedWebSocket, ResSchema } from '../Ws'
import DefaultHandler from './DefaultHandler'
import { MessageType, More, ROLLMATCH } from 'befriendlier-shared'
import Handler from '../Handler'

export default class RollMatchHandler extends DefaultHandler {
  public messageType = MessageType.ROLLMATCH

  public async onClientResponse(socket: ExtendedWebSocket, res: ResSchema): Promise<void> {
    if (res.data === undefined) return

    const rm: ROLLMATCH = JSON.parse(res.data)
    const { user, profile } = await Handler.rollMatch(rm)

    const bio = profile.bio.split(' ').map(word => `${word.substr(0, 1)}\u{E0000}${word.substr(1)}`).join(' ')

    switch (rm.more) {
      case More.NONE:
        rm.result = {
          value: `new ${rm.global === true ? 'global ' : ''}match's bio: ` +
            `${profile.bio.length > 32 ? `${bio.substr(0, 32)}...` : bio}, reply with %prefix%more, %prefix%match or %prefix%no`,
        }
        socket.send(this.ws.socketMessage(MessageType.ROLLMATCH, JSON.stringify(rm)))
        break
      case More.BIO:
        rm.result = {
          value: `${rm.global === true ? 'global\'s ' : ''}full bio: ` +
            `${bio}`,
        }
        socket.send(this.ws.socketMessage(MessageType.ROLLMATCH, JSON.stringify(rm)))
        break
      case More.FAVORITEEMOTES:
        rm.result = {
          value: `${rm.global === true ? 'global ' : ''}match's favorite emotes: ` +
            `${profile.favoriteEmotes.length > 0 ? profile.favoriteEmotes.map(emote => emote.name).join(' ') : 'None.'}`,
        }
        socket.send(this.ws.socketMessage(MessageType.ROLLMATCH, JSON.stringify(rm)))
        break
      case More.FAVORITESTREAMERS: {
        await user.preload('favoriteStreamers')

        const favoriteStreamers = user.favoriteStreamers.map(streamer => `${streamer.name.substr(0, 1)}\u{E0000}${streamer.name.substr(1)}`).join(', ')

        rm.result = {
          value: `${rm.global === true ? 'global ' : ''}match's favorite streamers: ` +
            `${user.favoriteStreamers.length > 0 ? favoriteStreamers : 'None'}.`,
        }
        socket.send(this.ws.socketMessage(MessageType.ROLLMATCH, JSON.stringify(rm)))
      }
    }
  }
}
