import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { rules, schema } from '@ioc:Adonis/Core/Validator'
import Database from '@ioc:Adonis/Lucid/Database'
import Profile from 'App/Models/Profile'
import User from 'App/Models/User'
import { DateTime } from 'luxon'

export default class ProfilesController {
  public async read ({ params, auth, view, session, response }: HttpContextContract) {
    if (auth.user === undefined) {
      return
    }

    const { id } = params

    if (id === undefined) {
      // Show all user's profiles.
      const profiles = await this.getAllProfilesForUser(auth.user)

      return view.render('core', {
        user: auth.user.toJSON(),
        profiles,
        web: {
          template: 'profiles',
          title: 'Profiles',
        },
      })
    } else {
      // Request has an id in parameter (url): We're looking for a profile...
      const authID = auth.user.id

      const idNumber = Number(id)
      if (Number.isNaN(idNumber)) {
        session.flash('message', { error: this.Error.parameterBadRequest })
        return response.redirect('/')
      }

      const profile = await Profile.find(Number(id))

      if (profile === null) {
        session.flash('message', { error: this.Error.notFound })
        return response.redirect('/')
      }

      const ownProfile = profile.userId === authID

      let chat: User | null = null
      // "chatUserId === 0" notates a global profile. It doesn't exist by design, so don't check for it.
      if (profile.chatUserId !== 0) {
        chat = await User.find(profile.chatUserId)
        // Should not happen, ever.
        if (chat === null) {
          session.flash('message', { error: this.Error.noOwner })
          return response.redirect('/profile/')
        }
      }

      await auth.user.preload('favoriteStreamers')

      const userJSON = auth.user.toJSON()
      const profileJSON = profile.toJSON()

      profileJSON.matches = await this.getMatchesList(auth.user, profile, 0)

      if (ownProfile) {
        // If own, allow access.
        return view.render('core', {
          user: userJSON,
          profile: profileJSON,
          profileUser: userJSON,
          web: {
            template: 'profile',
            title: chat !== null ? `Your profile in ${chat.name}'s chat` : 'Your global profile',
          },
        })
      } else {
        // If someone else's, check if the requested profile has matched this requesting user.
        const match = await Database.query().from('matches_lists').where({
          profile_id: profile.id,
          match_user_id: authID,
        }).first()

        if (match === null) {
          // The requested profile hasn't matched with this requesting user.
          session.flash('message', { error: this.Error.forbidden })
          return response.redirect('/')
        }

        // And check if the requesting user has matched for that specific profile.
        const hasMatched = await Database.query().from('matches_lists').where({
          user_id: auth.user.id,
          match_profile_id: profile.id,
        }).first()

        if (hasMatched === null) {
          // This requesting user hasn't matched with the requested profile.
          session.flash('message', { error: this.Error.forbidden })
          return response.redirect('/')
        }

        const userOfProfile = await User.find(profile.userId)

        if (userOfProfile === null) {
          // The requested profile doesn't have an existing owner? This shouldn't happen.
          session.flash('message', { error: this.Error.noOwner })
          return response.redirect('/profile')
        }

        await userOfProfile.preload('favoriteStreamers')

        return view.render('core', {
          user: userJSON,
          profile: profileJSON,
          profileUser: userOfProfile.toJSON(),
          web: {
            template: 'profile',
            title: chat !== null
              ? `${userOfProfile.name}'s profile in ${chat.name}'s chat`
              : `${userOfProfile.name}'s global profile`,
          },
        })
      }
    }
  }

  public async update ({ params, request, session, auth, response }: HttpContextContract) {
    if (auth.user === undefined) {
      return
    }

    const id = params.id as string

    const idNumber = Number(id)
    if (Number.isNaN(idNumber)) {
      session.flash('message', { error: this.Error.parameterBadRequest })
      return response.redirect('/profile/')
    }

    const profile = await Profile.find(idNumber)

    if (profile === null) {
      session.flash('message', { error: this.Error.notFound })
      return response.redirect('/profile/')
    }

    const ownProfile = profile.userId === auth.user.id

    if (ownProfile) {
      if (profile.updatedAt.diffNow('seconds').seconds > -60) {
        session.flash('message', {
          error: 'Error: Profile has recently been changed. ' +
          'Please wait at least 1 minute before updating your profile.',
        })

        return response.redirect(`/profile/${id}`)
      }

      profile.updatedAt = DateTime.fromJSDate(new Date())
      await profile.save()

      // Validate input
      const validated = await request.validate({
        schema: this.profilesSchema,
        cacheKey: 'profilesSchema',
      }) // Request may fail here if values do not pass validation.

      profile.color = validated.color
      profile.bio = validated.bio

      await profile.save()
      session.flash('message', { message: 'Successfully updated your profile.' })
      return response.redirect(`/profile/${id}`)
    } else {
      session.flash('message', { error: this.Error.forbidden })
      return response.redirect('/profile/')
    }
  }

  public async delete ({ params, auth, response, session }: HttpContextContract) {
    if (auth.user === undefined) {
      return
    }

    const { id } = params

    const idNumber = Number(id)
    if (Number.isNaN(idNumber)) {
      session.flash('message', { error: this.Error.parameterBadRequest })
      return response.redirect('/profile/')
    }

    await auth.user.preload('profile')

    const profile = auth.user.profile.find(profile => profile.id === idNumber)
    if (profile !== undefined) {
      await profile.related('matches').detach()

      // Remove all matches to this profile.
      await Database.query().from('matches_lists').where('match_profile_id', profile.id).delete()

      // Anonymize profile
      profile.bio = 'Hello!'
      profile.favoriteEmotes = []
      profile.color = '#ffffff'
      profile.enabled = false
      profile.userId = -1
      profile.createdAt = DateTime.fromJSDate(new Date())
      // profile.updatedAt automatically changes as soon as we save this.

      await profile.save()

      session.flash('message', { message: 'Profile has been deleted.' })
    }

    return response.redirect('/profile/')
  }

  public async matchesJSONPagination ({ params, request, auth, response }: HttpContextContract) {
    if (auth.user === undefined) {
      return
    }

    const method = request.intended()
    if (method !== 'POST') {
      return
    }

    const { id } = params
    const { pagination } = request.get()

    const idNumber = Number(id)
    if (Number.isNaN(idNumber)) {
      return response.badRequest({ error: this.Error.parameterBadRequest })
    }

    const paginationNumber = Number(pagination)
    if (Number.isNaN(paginationNumber)) {
      return response.badRequest({ error: this.Error.paginationGetBadRequest })
    }

    const profile = await Profile.find(idNumber)

    if (profile === null) {
      return response.notFound({ error: this.Error.notFound })
    }

    const ownProfile = profile.userId === auth.user.id

    if (ownProfile) {
      const matchesJSON = await this.getMatchesList(auth.user, profile, paginationNumber)

      return response.json(matchesJSON)
    } else {
      return response.forbidden({ error: this.Error.forbidden })
    }
  }

  public async unmatch ({ params, request, auth, response }: HttpContextContract) {
    if (auth.user === undefined) {
      return
    }

    const method = request.intended()
    if (method !== 'POST') {
      return
    }

    const { id } = params
    const { profileID } = request.post()

    if (profileID === undefined) {
      return response.badRequest({ error: this.Error.bodyBadRequest })
    }

    const profileIDNumber = Number(profileID)
    if (Number.isNaN(profileIDNumber)) {
      return response.badRequest({ error: this.Error.idBadRequest })
    }

    const idNumber = Number(id)
    if (Number.isNaN(idNumber)) {
      return response.badRequest({ error: this.Error.parameterBadRequest })
    }

    const profile = await Profile.find(idNumber)

    if (profile === null) {
      return response.notFound({ error: this.Error.notFound })
    }

    const ownProfile = profile.userId === auth.user.id

    if (ownProfile) {
      const match = await profile.related('matches').query().where('id', profileIDNumber).first()

      if (match === null) {
        return response.notFound({ error: this.Error.notFound })
      }

      // We don't want to attempt to match with this user again in the future, so add them to the mismatches list.
      profile.mismatches.push(match.id)

      await profile.save()

      // Remove match from this profile.
      await profile.related('matches').detach([match.id])

      return response.ok({ message: 'Successfully removed match from profile.' })
    } else {
      return response.forbidden({ error: this.Error.forbidden })
    }
  }

  private async getAllProfilesForUser (user: User) {
    const profiles: any[] = []

    await user.preload('profile')

    for (let index = 0; index < user.profile.length; index++) {
      const profile = user.profile[index]
      const profileJSON = profile.toJSON()

      if (profile.chatUserId !== 0) {
        const matchedProfileUser = await User.find(profile.chatUserId)
        if (matchedProfileUser !== null) {
          profileJSON.chat = matchedProfileUser.toJSON()
          profiles.push(profileJSON)
        }
      } else {
        profiles.push(profileJSON)
      }
    }

    // Sort by ascending order.
    profiles.sort((a, b) => a.id - b.id)

    return profiles
  }

  private async getMatchesList (user: User, profile: Profile, pagination = 0): Promise<any[] | undefined> {
    const matches = await profile.related('matches').query().offset(pagination).limit(10)
    const matchesJSON: any[] = []

    if (matches !== null) {
      for (let index = 0; index < matches.length; index++) {
        const profileMatched = matches[index]
        const userMatched = await User.find(profileMatched.userId)

        if (userMatched === null) {
          continue
        }

        /**
         * Make sure user has also matched with us before sending it.
         * Do not ruin the surprise if they're not matched yet.
         */

        // Someone else's, check if the requested profile has matched this requesting user.
        const hasMatched = await Database.query().from('matches_lists').where({
          profile_id: profileMatched.id,
          match_user_id: user.id,
        }).first()

        if (hasMatched === null) {
          continue
        }

        matchesJSON.push({
          profile: profileMatched.toJSON(),
          user: userMatched.toJSON(),
        })
      }

      return matchesJSON
    }
  }

  private readonly profilesSchema = schema.create({
    bio: schema.string({}, [
      rules.maxLength(128),
      rules.minLength(1),
      rules.nonToxicBio(),
    ]),
    color: schema.string({}, [
      rules.hexColorString(),
    ]),
  })

  private readonly Error = {
    forbidden: 'Error: You are not allowed access to that profile!',
    notFound: 'Error: Profile does not exist.',
    parameterBadRequest: 'Error: Parameter is not a number. Profile url can only contain numbers.',
    noOwner: 'Error: Chat owner is missing. Report this error on github.',
    bodyBadRequest: 'Error: Body must contain { profileID: number }.',
    idBadRequest: 'Error: profileID is not a number.',
    paginationGetBadRequest: 'Error: Pagination GET query is not a number.',
  }
}
