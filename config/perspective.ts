import Env from '@ioc:Adonis/Core/Env'

const PerspectiveAPIConfig = {
  /**
   * Perspective API Token.
   */
  token: Env.get('PERSPECTIVE_API_TOKEN'),

  /**
   * Perspective API throttling. Normal accounts have 1 query per second.
   */
  throttleInMs: Number(Env.get('PERSPECTIVE_API_THROTTLE', 1000)),

  /**
   * Perspective API threshold. This is for TOXICITY only.
   */
  thresholdTOXICITY: Number(Env.get('PERSPECTIVE_API_THRESHOLD_TOXICITY', 0.75)),

  /**
   * HTTP request headers.
   */
  headers: {
    'user-agent': 'befriendlierapp (https://github.com/kararty/befriendlier-web)',
  },
}

export default PerspectiveAPIConfig
