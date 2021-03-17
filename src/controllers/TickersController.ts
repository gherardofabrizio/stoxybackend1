import moment from 'moment'

// Types imports
import { raw, Transaction } from 'objection'
import { ExpressRunnerModule } from '@radx/radx-backend-express'
import { KnexModule } from '@radx/radx-backend-knex'
import { StoxyModelModule, ITicker } from '_app/model/stoxy'

export default class TickersController {
  private runner: ExpressRunnerModule
  private database: KnexModule
  private stoxyModel: StoxyModelModule

  constructor(runner: ExpressRunnerModule, database: KnexModule, stoxyModel: StoxyModelModule) {
    this.runner = runner
    this.database = database
    this.stoxyModel = stoxyModel
  }

  async searchTickersByText(searchQuery: string, trx?: Transaction): Promise<Array<ITicker>> {
    const { Ticker } = this.stoxyModel

    const tickers = await Ticker.query(trx)
      .where(whereBuilder => {
        return searchQuery.length > 0
          ? whereBuilder
              .where('description', 'LIKE', '%' + searchQuery + '%')
              .orWhere('symbol', 'LIKE', '%' + searchQuery + '%')
          : whereBuilder.where({ isDefault: true })
      })
      .orderByRaw(
        `
        CASE
        WHEN description = :searchQuery THEN 1
        WHEN symbol = :searchQuery THEN 2

        WHEN description LIKE :q2 THEN 3
        WHEN symbol LIKE :q2 THEN 4

        WHEN description LIKE :q3 THEN 5
        WHEN symbol LIKE :q3 THEN 6

        WHEN description LIKE :q1 THEN 7
        WHEN symbol LIKE :q1 THEN 8

        ELSE 100 END,
        length(symbol) ASC,
        description ASC
      `,
        {
          searchQuery: searchQuery,
          q2: searchQuery + '%',
          q3: '%' + searchQuery,
          q1: '%' + searchQuery + '%'
        }
      )
      .limit(100)
      .withGraphFetched('stockMarket')

    return tickers
  }
}
