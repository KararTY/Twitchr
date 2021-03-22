import Env from '@ioc:Adonis/Core/Env'

const TwitchConfig = {
  /**
   * Twitch client ID token.
   */
  clientToken: Env.get('TWITCH_CLIENT_TOKEN'),

  /**
   * Twitch client secret token.
   */
  clientSecret: Env.get('TWITCH_CLIENT_SECRET'),

  /**
   * Redirect URI.
   */
  redirectURI: Env.get('TWITCH_REDIRECT_URI'),

  /**
   * Bot Login Redirect URI.
   */
  botRedirectURI: Env.get('TWITCH_BOT_REDIRECT_URI'),

  /**
   * Twitch username. Used to make bot join default channel.
   */
  user: {
    name: Env.get('TWITCH_BOT_NAME'),
    id: Env.get('TWITCH_BOT_ID'),
  },

  /**
   * Scopes to ask for.
   */
  scope: [],

  /**
   * HTTP request headers.
   */
  headers: {
    'user-agent': 'befriendlierapp (https://github.com/kararty/befriendlier-web)',
  },
}

export default TwitchConfig
