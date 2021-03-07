import moment from 'moment'

// Types imports
import { Transaction } from 'objection'
import { ExpressRunnerModule } from '@radx/radx-backend-express'
import { KnexModule } from '@radx/radx-backend-knex'
import { StoxyModelModule, IWatchlist } from '_app/model/stoxy'

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
}
