import moment from 'moment'

import NewsNotificationsController from '_app/controllers/NewsNotificationsController'

// Types imports
import { Transaction } from 'objection'
import { ExpressRunnerModule } from '@radx/radx-backend-express'
import { KnexModule } from '@radx/radx-backend-knex'
import { StoxyModelModule, IWatchlist, IWatchlistItem } from '_app/model/stoxy'

export default class WatchlistController {
  private runner: ExpressRunnerModule
  private database: KnexModule
  private stoxyModel: StoxyModelModule
  private newsNotificationsController: NewsNotificationsController

  constructor(
    runner: ExpressRunnerModule,
    database: KnexModule,
    stoxyModel: StoxyModelModule,
    newsNotificationsController: NewsNotificationsController
  ) {
    this.runner = runner
    this.database = database
    this.stoxyModel = stoxyModel
    this.newsNotificationsController = newsNotificationsController
  }

  async getWatchlistForProfile(profileId: number, trx?: Transaction): Promise<IWatchlist> {
    const { WatchlistItem } = this.stoxyModel

    let hasMore = false
    let totalCount = 0

    // TODO - add pagination
    const data = await WatchlistItem.query(trx)
      .where('profileId', profileId)
      .orderBy('order', 'ASC')
      .withGraphFetched('ticker.stockMarket')

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

    // Update FCM topics (for stock symbol based notifications)
    await this.newsNotificationsController.unsubscribeUserFromTickerNotifications(
      profileId,
      tickerSymbol,
      trx
    )
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
      // Insert new watchlist item
      const lastItem = await WatchlistItem.query(trx)
        .where({
          profileId
        })
        .orderBy('order', 'DESC')
        .first()
      const order = lastItem ? (lastItem.order || 0) + 1 : 0

      await WatchlistItem.query(trx).insert({
        profileId,
        tickerId,
        isNotificationsEnabled: payload.isNotificationsEnabled,
        order
      })
    }

    // Update FCM topics (for stock symbol based notifications)
    if (payload.isNotificationsEnabled) {
      await this.newsNotificationsController.subscribeUserToTickerNotifications(
        profileId,
        tickerSymbol,
        trx
      )
    } else {
      await this.newsNotificationsController.unsubscribeUserFromTickerNotifications(
        profileId,
        tickerSymbol,
        trx
      )
    }

    const updatedItem = await WatchlistItem.query(trx)
      .where({
        profileId,
        tickerId
      })
      .withGraphFetched('ticker.stockMarket')
      .first()

    return updatedItem!
  }

  async batchUpdateWatchlistForProfile(
    profileId: number,
    tickersUpdate: Array<{
      tickerId: string
      isNotificationsEnabled: boolean
    }>,
    trx?: Transaction
  ): Promise<IWatchlist> {
    const { errors } = this.runner
    const { Ticker, WatchlistItem } = this.stoxyModel

    // Check for at least one ticker at watchlist
    if (tickersUpdate.length === 0) {
      const error = errors.invalidPayload([], `You need to have at least one ticker at watchlist`)
      error.radxCode = 'watchlist/canNotBeEmpty'
      throw error
    }

    const watchlistBeforeUpdate = await this.getWatchlistForProfile(profileId, trx)
    const tickersBeforeUpdate = watchlistBeforeUpdate.data.map(item => item.tickerId!)

    await WatchlistItem.query(trx).delete().where({
      profileId
    })

    await Promise.all(
      tickersUpdate.map(async (item, order) => {
        await WatchlistItem.query(trx).insert({
          profileId,
          tickerId: item.tickerId,
          isNotificationsEnabled: item.isNotificationsEnabled,
          order
        })
      })
    )

    const updatedWatchlist = await this.getWatchlistForProfile(profileId, trx)
    const tickersAfterUpdate = updatedWatchlist.data.map(item => item.tickerId!)

    const tickersToUnsubscribe = tickersBeforeUpdate.filter(tickerSymbol => {
      return !tickersAfterUpdate.includes(tickerSymbol)
    })

    const tickersToSubscribe = tickersAfterUpdate.filter(tickerSymbol => {
      return !tickersBeforeUpdate.includes(tickerSymbol)
    })

    // Update FCM topics (for stock symbol based notifications)
    await Promise.all([
      Promise.all(
        tickersToUnsubscribe.map(ticker => {
          return this.newsNotificationsController.unsubscribeUserFromTickerNotifications(
            profileId,
            ticker,
            trx
          )
        })
      ),
      Promise.all(
        tickersToSubscribe.map(ticker => {
          return this.newsNotificationsController.subscribeUserToTickerNotifications(
            profileId,
            ticker,
            trx
          )
        })
      )
    ])

    return updatedWatchlist
  }
}
