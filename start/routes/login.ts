import Route from '@ioc:Adonis/Core/Route'

Route.get('/register', 'AuthController.register')

Route.post('/logout', 'AuthController.logout').middleware('auth:web')

Route.get('/bot_login', 'BotLoginController.index')
