/*
|--------------------------------------------------------------------------
| Validating Environment Variables
|--------------------------------------------------------------------------
|
| In this file we define the rules for validating environment variables.
| By performing validation we ensure that your application is running in
| a stable environment with correct configuration values.
|
| This file is read automatically by the framework during the boot lifecycle
| and hence do not rename or move this file to a different location.
|
*/

import Env from '@ioc:Adonis/Core/Env'

export default Env.rules({
  HOST: Env.schema.string({ format: 'host' }),
  PORT: Env.schema.number(),
  APP_KEY: Env.schema.string(),

  NODE_ENV: Env.schema.enum(['production', 'development', 'testing'] as const),
  LOG_LEVEL: Env.schema.enum(['info', 'debug', 'warning', 'error'] as const),

  SESSION_DRIVER: Env.schema.enum(['cookie', 'file', 'redis'] as const),

  DB_CONNECTION: Env.schema.enum(['sqlite', 'pg', 'mysql', 'mssql', 'oracle'] as const),
  DB_HOST: Env.schema.string({ format: 'host' }),
  DB_USER: Env.schema.string(),
  DB_PASSWORD: Env.schema.string.optional(),
  DB_NAME: Env.schema.string(),
  DB_HEALTHCHECK: Env.schema.boolean.optional(),
  HASH_DRIVER: Env.schema.enum(['argon', 'bcrypt'] as const),

  TWITCH_CLIENT_TOKEN: Env.schema.string(),
  TWITCH_CLIENT_SECRET: Env.schema.string(),
  TWITCH_REDIRECT_URI: Env.schema.string(),
  TWITCH_BOT_REDIRECT_URI: Env.schema.string(),
  TWITCH_BOT_NAME: Env.schema.string(),
  TWITCH_BOT_ID: Env.schema.string(),

  PERSPECTIVE_API_TOKEN: Env.schema.string.optional(),
  PERSPECTIVE_API_THROTTLE: Env.schema.number(),
  PERSPECTIVE_API_THRESHOLD_TOXICITY: Env.schema.number(),
})
