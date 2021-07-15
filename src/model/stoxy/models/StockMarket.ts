import Knex from 'knex'
import { ModelWithCreatedAndUpdatedAt } from '@radx/radx-backend-knex'

// Type imports
import { ExpressRunnerModule } from '@radx/radx-backend-express'

export type StockMarketId = string

export class StockMarketModel extends ModelWithCreatedAndUpdatedAt {
  static tableName = 'stock_markets'
  static idColumn = 'mic'

  mic?: StockMarketId
  operatingMic?: StockMarketId
  name?: string
  acronym?: string
  countryCode?: string
  website?: string
  createdAt?: Date
  updatedAt?: Date

  static jsonSchema = {
    type: 'object',

    properties: {
      mic: { type: 'string', maxLength: 16 },
      operatingMic: { type: 'string', maxLength: 16 },
      name: { type: 'string', maxLength: 255 },
      acronym: { type: 'string', maxLength: 32 },
      countryCode: { type: 'string', maxLength: 2 },
      website: { type: 'string', maxLength: 255 }
    }
  }
}

export default function defineStockMarketModel(
  runner: ExpressRunnerModule,
  knex: Knex
): typeof StockMarketModel {
  const _StockMarket = StockMarketModel.bindKnex(knex)

  // Make sure we always create different class (and it consequently has a different config).
  // Can't rely on bindKnex() for this, as it uses a cache internally, it will return same class
  // for the same knex instance.
  class StockMarket extends _StockMarket {}

  runner.beforeStart(async () => {
    StockMarket.relationMappings = {}
  })

  return StockMarket
}
