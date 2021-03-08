import moment from 'moment'

// Types imports
import { Transaction } from 'objection'
import { ExpressRunnerModule } from '@radx/radx-backend-express'
import { KnexModule } from '@radx/radx-backend-knex'
import { StoxyModelModule, IWatchlist } from '_app/model/stoxy'
import TickerIdsCache from '_app/helpers/TickerIdsCache'

export default class WatchlistController {
  private runner: ExpressRunnerModule
  private database: KnexModule
  private stoxyModel: StoxyModelModule
  private tickerIdsCache: TickerIdsCache

  constructor(
    runner: ExpressRunnerModule,
    database: KnexModule,
    stoxyModel: StoxyModelModule,
    tickerIdsCache: TickerIdsCache
  ) {
    this.runner = runner
    this.database = database
    this.stoxyModel = stoxyModel
    this.tickerIdsCache = tickerIdsCache
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

  async removeTickerFromWatchlistForProfile(
    tickerSymbol: string,
    profileId: number,
    trx?: Transaction
  ): Promise<void> {
    const { Ticker, WatchlistItem } = this.stoxyModel

    const tickerId = await this.tickerIdsCache.getTickerIdBySymbol(tickerSymbol, trx)

    await WatchlistItem.query(trx).delete().where({
      tickerId,
      profileId
    })
  }
}
