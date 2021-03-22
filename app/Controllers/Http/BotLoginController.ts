import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Logger from '@ioc:Adonis/Core/Logger'
import { TwitchAuth } from 'befriendlier-shared'
import TwitchConfig from '../../../config/twitch'
import Env from '@ioc:Adonis/Core/Env'
import fs from 'fs'
import path from 'path'
import Ws from 'App/Services/Ws'

export default class BotLoginController {
  private readonly twitchAPI = new TwitchAuth({
    clientToken: TwitchConfig.clientToken,
    clientSecret: TwitchConfig.clientSecret,
    redirectURI: TwitchConfig.botRedirectURI,
    scope: ['chat:read', 'chat:edit', 'whispers:read', 'whispers:edit'],
    headers: TwitchConfig.headers,
  }, Logger.level)

  public async index ({ request, auth, response, session }: HttpContextContract) {
    if (auth.user !== undefined) {
      return response.redirect('/')
    }

    const { code } = request.get()

    const token = await this.twitchAPI.requestToken(code)
    if (token === null) {
      session.flash('message', { error: 'Error: Twitch did not send a token back. Try again later!' })
      return response.redirect('/')
    }

    const twitchUser = await this.twitchAPI.getUser(token.access_token)
    if (
      (twitchUser !== null) &&
      (twitchUser.id === TwitchConfig.user.id) &&
      (twitchUser.login === TwitchConfig.user.name)
    ) {
      // Define the file.
      const dir = path.join(__dirname, '../../../.supersecret.json')

      fs.writeFileSync(dir.toString(), JSON.stringify(token), 'utf-8')

      // Set the environment variables.
      Env.set('TWITCH_BOT_ACCESS_TOKEN', token.access_token)
      Env.set('TWITCH_BOT_REFRESH_TOKEN', token.refresh_token)
      Env.set('TWITCH_BOT_ACCESS_TOKEN_EXPIRES_IN', new Date(Date.now() + (token.expires_in * 1000)).toUTCString())

      // Tell the Ws.
      Ws.updateEnv()

      return response.redirect('/')
    }

    return response.notFound()
  }
}
