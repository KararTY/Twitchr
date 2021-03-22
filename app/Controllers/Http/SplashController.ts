import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
// import Database from '@ioc:Adonis/Lucid/Database'
import User from 'App/Models/User'
import { DateTime } from 'luxon'

let splashLastUpdate = DateTime.fromJSDate(new Date())
let statistics = {
  users: {
    total: 0,
    new: 0,
  },
  channels: {
    total: 0,
    new: 0,
  },
}

export default class SplashController {
  public async index ({ auth, view }: HttpContextContract) {
    if (splashLastUpdate.diffNow('minutes').minutes <= 0) {
      splashLastUpdate = splashLastUpdate.plus({ minutes: 30 })
    }
    await this.refreshStatistics()

    return view.render('core', {
      user: auth.user?.toJSON(),
      web: {
        template: 'splash',
        title: 'Find Twitch people!',
        statistics: statistics,
      },
    })
  }

  private async refreshStatistics () {
    const dateMidnight = DateTime
      .fromJSDate(new Date())
      .set({ hour: 0, minute: 0, second: 0, millisecond: 0 }).toJSDate()

    const countTotalUsers = User.query()
      .where('createdAt', '>', String(DateTime.fromJSDate(new Date('1971')).toSQL()))
      .count('*', 'total')
      .first()
    const countNewUsers = User.query()
      .whereBetween('createdAt', [dateMidnight, new Date()])
      .count('*', 'total')
      .first()

    // const countTotalMatches = Database.query()
    //   .from('matches_lists')
    //   .countDistinct(['user_id', '' ])
    // const countNewMatches = Database.query()
    //   .from('matches_lists')

    const countTotalChannels = User.query()
      .where({ host: true })
      .count('*', 'total')
      .first()
    const countNewChannels = User.query()
      .where({ host: true })
      .whereBetween('createdAt', [dateMidnight, new Date()])
      .count('*', 'total')
      .first()

    const [
      { total: totalUsers }, { total: totalChannels }, { total: totalNewUsers }, { total: totalNewChannels },
    ] = await Promise.all([
      countTotalUsers, countTotalChannels, countNewUsers, countNewChannels,
    ])

    statistics = {
      users: {
        total: totalUsers,
        new: totalNewUsers,
      },
      channels: {
        total: totalChannels,
        new: totalNewChannels,
      },
    }
  }
}
