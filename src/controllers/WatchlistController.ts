import moment from 'moment'

// Types imports
import { Transaction } from 'objection'
import { ExpressRunnerModule } from '@radx/radx-backend-express'
import { KnexModule } from '@radx/radx-backend-knex'
import { StoxyModelModule, IWatchlist, IWatchlistItem } from '_app/model/stoxy'

export default class WatchlistController {
  private runner: ExpressRunnerModule
  private database: KnexModule
  private stoxyModel: StoxyModelModule

  constructor(runner: ExpressRunnerModule, database: KnexModule, stoxyModel: StoxyModelModule) {
    this.runner = runner
    this.database = database
    this.stoxyModel = stoxyModel
  }

  async getWatchlistForProfile(profileId: number, trx?: Transaction): Promise<IWatchlist> {
    const { WatchlistItem } = this.stoxyModel

    let hasMore = false
    let totalCount = 0

    // TODO - add pagination
    const data = await WatchlistItem.query(trx)
      .where('profileId', profileId)
      .orderBy('createdAt', 'DESC')
      .withGraphFetched('ticker')

    return {
      data,
      totalCount,
      hasMore
    }
  }

  async removeTickerForProfile(
    tickerSymbol: string,
    profileId: number,
    trx?: Transaction
  ): Promise<void> {
    const { errors } = this.runner
    const { Ticker, WatchlistItem } = this.stoxyModel

    const tickerId = tickerSymbol

    await WatchlistItem.query(trx).delete().where({
      tickerId,
      profileId
    })

    // Check for at least one ticker at watchlist
    const itemFromProfileWatchlist = await WatchlistItem.query(trx)
      .where({
        profileId
      })
      .first()
    if (!itemFromProfileWatchlist) {
      const error = errors.invalidPayload([], `You need to have at least one ticker at watchlist`)
      error.radxCode = 'watchlist/canNotBeEmpty'
      throw error
    }
  }

  async upsertTickerForProfile(
    tickerSymbol: string,
    profileId: number,
    payload: {
      isNotificationsEnabled: boolean
    },
    trx?: Transaction
  ): Promise<IWatchlistItem> {
    const { errors } = this.runner
    const { WatchlistItem } = this.stoxyModel

    const tickerId = tickerSymbol

    const checkItem = await WatchlistItem.query(trx)
      .where({
        profileId,
        tickerId
      })
      .first()

    if (checkItem) {
      // If ticker already added – just update it
      await WatchlistItem.query(trx)
        .update({
          isNotificationsEnabled: payload.isNotificationsEnabled
        })
        .where({ id: checkItem.id })
    } else {
      // Update watchlist item
      await WatchlistItem.query(trx).insert({
        profileId,
        tickerId,
        isNotificationsEnabled: payload.isNotificationsEnabled
      })
    }

    // TODO - update FCM topics (for stock symbol based notifications)

    const updatedItem = await WatchlistItem.query(trx)
      .where({
        profileId,
        tickerId
      })
      .withGraphFetched('ticker')
      .first()

    return updatedItem!
  }
}
