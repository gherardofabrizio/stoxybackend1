import Knex from 'knex'
import { ModelWithCreatedAndUpdatedAt } from '@radx/radx-backend-knex'

// Type imports
import { ExpressRunnerModule } from '@radx/radx-backend-express'
import { StockMarketId } from './StockMarket'

export type TickerId = string

export class TickerModel extends ModelWithCreatedAndUpdatedAt {
  static tableName = 'tickers'
  static idColumn = 'symbol'

  symbol?: TickerId
  description?: string
  displaySymbol?: string
  currency?: string
  stockMarketId?: StockMarketId
  type?: string
  createdAt?: Date
  updatedAt?: Date

  static jsonSchema = {
    type: 'object',

    properties: {
      symbol: { type: 'string', maxLength: 16 },
      description: { type: 'string', maxLength: 64 },
      displaySymbol: { type: 'string', maxLength: 16 },
      currency: { type: 'string', maxLength: 16 },
      stockMarketId: { type: 'string', maxLength: 16 },
      type: { type: 'string', maxLength: 32 }
    }
  }
}

export default function defineTickerModel(
  runner: ExpressRunnerModule,
  knex: Knex
): typeof TickerModel {
  const _TickerModel = TickerModel.bindKnex(knex)

  // Make sure we always create different class (and it consequently has a different config).
  // Can't rely on bindKnex() for this, as it uses a cache internally, it will return same class
  // for the same knex instance.
  class Ticker extends _TickerModel {}

  runner.beforeStart(async () => {
    Ticker.relationMappings = {}
  })

  return Ticker
}
