import Twitch from '@ioc:Adonis/Addons/Twitch'
import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { rules, schema } from '@ioc:Adonis/Core/Validator'
import Database from '@ioc:Adonis/Lucid/Database'
import BannedUser from 'App/Models/BannedUser'
import User from 'App/Models/User'
import { TwitchUsersBody } from 'befriendlier-shared' // For type definitions
import { DateTime } from 'luxon'

export default class UsersController {
  private readonly usersSchema = schema.create({
    favoriteStreamers: schema.array.optional([
      rules.maxLength(5),
      rules.distinct('*'),
    ]).members(schema.string({}, [
      rules.maxLength(32),
      rules.validTwitchName(),
    ])),
    streamerMode: schema.boolean.optional(),
    globalProfile: schema.boolean.optional(),
  })

  public async read ({ auth, view }: HttpContextContract) {
    if (auth.user === undefined) {
      return
    }

    await auth.user.preload('profile')
    await auth.user.preload('favoriteStreamers')

    return view.render('core', {
      user: auth.user.toJSON(),
      web: {
        template: 'user',
        title: `User settings - ${auth.user.displayName}`,
      },
    })
  }

  public async update ({ request, session, auth, response }: HttpContextContract) {
    if (auth.user === undefined) {
      return
    }

    // Validate input
    const validated = await request.validate({
      schema: this.usersSchema,
      messages: {
        'favoriteStreamers.maxLength': 'You can only have a maximum of 5 favorite streamers.',
        'favoriteStreamers.distinct': 'Favorite streamers list must have distinct values. No duplicates.',
        'streamerMode.boolean': 'Streamer mode must be a boolean value.',
        'globalProfile.boolean': 'Global profile must be a boolean value.',
      },
      cacheKey: 'usersSchema',
    }) // Request may fail here, if values do not pass validation.

    // TODO: OPTIMIZE CALLS BY FILTERING OUT EXISTING FIELDS & ONLY DETACHING NON-EXISTING FIELDS.
    let newFavoriteStreamers: User[] = []
    if (validated.favoriteStreamers !== undefined && validated.favoriteStreamers.length > 0) {
      const existingUsers = await User.query().whereIn('name', validated.favoriteStreamers)
      newFavoriteStreamers.push(...existingUsers)

      // Check if user is requesting streamers that currently do not exist in the database.
      if (existingUsers.length < validated.favoriteStreamers.length) {
        // Time to get the rest of the streamers, if they exist.
        const existingUsernames = existingUsers.map(user => user.name)

        const streamersToFind = validated.favoriteStreamers.filter(user => !existingUsernames.includes(user))

        // Call Twitch API.
        const streamersToAppend = await Twitch.getUser(session.get('token'), streamersToFind)

        if (streamersToAppend instanceof Array) {
          // Check if banned.
          const bannedUserSessionMessages: string[] = []
          const safeUsers: TwitchUsersBody[] = []
          for (let index = 0; index < streamersToAppend.length; index++) {
            const user = streamersToAppend[index]
            const bannedUser = await BannedUser.findBy('twitchID', user.id)

            if (bannedUser !== null) {
              bannedUserSessionMessages.push(`${user.login} is banned from using this service.`)
            } else {
              safeUsers.push(user)
            }
          }

          if (bannedUserSessionMessages.length > 0) {
            session.flash('message', { error: `Error: ${bannedUserSessionMessages.join(' \n')}` })
            return response.redirect('/user')
          }

          const d = await User.createMany(safeUsers.map(streamer => {
            return {
              twitchID: streamer.id,
              name: streamer.login,
              displayName: streamer.display_name,
              avatar: streamer.profile_image_url,
              createdAt: DateTime.fromJSDate(new Date('1970-01-01 02:00:00')),
            }
          }))

          newFavoriteStreamers.push(...d)
        } else {
          session.flash('message', { error: 'Error: Something went wrong with Twitch. Try again later.' })
          return response.redirect('/user')
        }
      }
    }

    await auth.user.preload('profile')

    const globalProfile = auth.user.profile.find(profile => profile.chatUserId === 0)

    /**
     * Global profile can't be undefined unless database hasn't been seeded,
     * this is here because typescript is strict.
     */
    if (globalProfile !== undefined) {
      globalProfile.enabled = validated.globalProfile !== undefined

      await auth.user.related('profile').save(globalProfile)
    }

    auth.user.streamerMode = validated.streamerMode !== undefined

    /* This is very inefficient. TODO: FIX */
    // Remove all.
    await auth.user.related('favoriteStreamers').detach()

    // Add new.
    if (newFavoriteStreamers.length > 0) {
      // Filter newFavoriteStreamers for possible duplicates.
      newFavoriteStreamers = newFavoriteStreamers.sort((a, b) => {
        return b.updatedAt.toMillis() - a.updatedAt.toMillis()
      }).filter((streamer, pos, self) => {
        const slf = self.findIndex(user => user.name === streamer.name)
        return slf === pos
      })
      await auth.user.related('favoriteStreamers').saveMany(newFavoriteStreamers)
    }
    /**/

    session.flash('message', { message: 'Successfully updated user settings.' })
    await auth.user.save()
    return response.redirect('/user')
  }

  public async delete ({ auth, response, session }: HttpContextContract) {
    if (auth.user === undefined) {
      return
    }

    let accountDeleted = false

    if (auth.user !== null) {
      await auth.user.preload('profile')

      for (let i = 0; i < auth.user.profile.length; i++) {
        const profile = auth.user.profile[i]
        await profile.related('matches').detach()

        // Remove all matches to this user.
        // await Database.query().from('matches_lists').where('match_user_id', user.id).delete()

        // Anonymize profile
        profile.bio = 'Hello!'
        profile.favoriteEmotes = []
        profile.color = '#ffffff'
        profile.enabled = false
        profile.userId = -1
        profile.createdAt = DateTime.fromJSDate(new Date())
        // profile.updatedAt automatically changes as soon as we save this.

        await profile.save()
      }

      // await user.preload('favoriteStreamers')
      await auth.user.related('favoriteStreamers').detach()

      // ANONYMIZE USER ON DELETE
      auth.user.twitchID = ''
      auth.user.name = '$deleted'
      auth.user.displayName = 'Deleted User'
      auth.user.avatar = ''
      auth.user.streamerMode = false
      auth.user.host = false
      auth.user.createdAt = DateTime.fromJSDate(new Date())
      // auth.user.updatedAt automatically changes as soon as we save this.

      await auth.user.save()
      await auth.logout()
      accountDeleted = true
    }

    session.flash('message', accountDeleted
      ? { message: 'Account has been deleted.' }
      : { error: 'Error: Something went wrong, please try again later! Reference: #USERDELETE1' },
    )

    return response.redirect('/')
  }

  public async refresh ({ auth, response, session }: HttpContextContract) {
    if (auth.user === undefined) {
      return
    }

    if (auth.user.updatedAt.diffNow('minutes').minutes > -5) {
      session.flash('message', {
        error: 'Error: Account has recently been changed. ' +
        'Please wait at least 5 minutes before refreshing Twitch data.',
      })
      return response.redirect('/user')
    }

    const twitchBody = await Twitch.getUser(session.get('token'))

    if (twitchBody === null) {
      session.flash('message', {
        error: 'Error: Twitch returned nothing after repeated attempts. ' +
        'Try again later. Reference: #USERREFRESH1',
      })

      return response.redirect('/user')
    }

    auth.user.displayName = twitchBody.display_name
    auth.user.name = twitchBody.login
    auth.user.avatar = twitchBody.profile_image_url
    auth.user.twitchID = twitchBody.id
    auth.user.updatedAt = DateTime.fromJSDate(new Date())
    await auth.user.save()

    session.flash('message', { message: 'Successfully refreshed your Twitch data.' })

    return response.redirect('/user')
  }

  public async requestData ({ auth, response, session }: HttpContextContract) {
    if (auth.user === undefined) {
      return
    }

    if (auth.user.updatedAt.diffNow('minutes').minutes > -60) {
      session.flash('message', {
        error: 'Error: Account has recently been changed. ' +
        'Please wait at least 1 hour before downloading your data.',
      })

      return response.redirect('/user')
    }

    auth.user.updatedAt = DateTime.fromJSDate(new Date())
    await auth.user.save()

    const userData: any = {
      id: auth.user.id,
      name: auth.user.name,
      display_name: auth.user.displayName,
      twitchID: auth.user.twitchID,
      avatar: auth.user.avatar,
      profiles: [],
      streamer_mode: auth.user.streamerMode,
      favorite_streamers: [],
      created_at: auth.user.createdAt.toUTC(),
      updated_at: auth.user.updatedAt.toUTC(),
    }

    await auth.user.preload('profile')

    for (let index = 0; index < auth.user.profile.length; index++) {
      const profile = auth.user.profile[index]
      const profileJSON: any = {
        ...profile.serialize({
          fields: ['created_at', 'updated_at', 'id', 'favorite_emotes', 'color', 'bio', 'enabled', 'chat_user_id'],
        }),
        matches: [],
      }

      await profile.preload('matches')

      for (let index = 0; index < profile.matches.length; index++) {
        const match = profile.matches[index]

        if (match.userId !== -1) {
          const user = await User.find(match.userId)
          if (user === null) {
            continue
          }

          const hasMatched = await Database.query().from('matches_lists').where({
            profile_id: match.id,
            match_user_id: auth.user.id,
          }).first()

          if (hasMatched === null) {
            continue
          }

          profileJSON.matches.push(user.serialize({
            fields: ['name', 'display_name', 'avatar', 'id'],
          }))
        } else {
          // Deleted match user.
          profileJSON.matches.push({
            name: 'Deleted User',
          })
        }
      }

      userData.favorite_streamers.push(profileJSON)
    }

    await auth.user.preload('favoriteStreamers')

    for (let index = 0; index < auth.user.favoriteStreamers.length; index++) {
      const favoriteStreamer = auth.user.favoriteStreamers[index]

      userData.favorite_streamers.push(favoriteStreamer.serialize({
        fields: ['name', 'display_name', 'avatar', 'id'],
      }))
    }

    return response.json(userData)
  }
}
