import { AuthenticationException } from '@adonisjs/auth/build/standalone'
import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

/**
 * Auth middleware is meant to restrict un-authenticated access to a given route
 * or a group of routes.
 *
 * You must register this middleware inside `start/kernel.ts` file under the list
 * of named middleware.
 */
export default class AuthMiddleware {
  /**
  * The URL to redirect to when request is Unauthorized
  */
  protected redirectTo = '/'

  /**
   * Authenticates the current HTTP request against a custom set of defined
   * guards.
   *
   * The authentication loop stops as soon as the user is authenticated using any
   * of the mentioned guards and that guard will be used by the rest of the code
   * during the current request.
   */
  protected async authenticate ({ request, auth, session }: HttpContextContract, guards: any[]) {
    /**
     * Hold reference to the guard last attempted within the for loop. We pass
     * the reference of the guard to the "AuthenticationException", so that
     * it can decide the correct response behavior based upon the guard
     * driver
     */
    let guardLastAttempted: string | undefined

    for (const guard of guards) {
      guardLastAttempted = guard

      // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
      if (await auth.use(guard).check()) {
        /**
         * Instruct auth to use the given guard as the default guard for
         * the rest of the request, since the user authenticated
         * succeeded here
         */
        auth.defaultGuard = guard
        return true
      }
    }

    /**
     * Unable to authenticate using any guard
     */
    if (session.get('message') === undefined) {
      session.flash('message', { error: 'Error: Please login to perform that action.' })
    }

    session.put('redirectURL', request.parsedUrl.href)
    throw new AuthenticationException(
      'Unauthorized access',
      'E_UNAUTHORIZED_ACCESS',
      guardLastAttempted,
      this.redirectTo,
    )
  }

  /**
   * Handle request
   */
  public async handle (ctx: HttpContextContract, next: () => Promise<void>, customGuards: string[]) {
    /**
     * Uses the user defined guards or the default guard mentioned in
     * the config file
     */
    const guards = customGuards.length > 0 ? customGuards : [ctx.auth.name]
    await this.authenticate(ctx, guards)
    await next()
  }
}
