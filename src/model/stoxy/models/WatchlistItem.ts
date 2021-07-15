import Knex from 'knex'
import { Model } from 'objection'
import { ModelWithCreatedAndUpdatedAt } from '@radx/radx-backend-knex'

// Type imports
import { ExpressRunnerModule } from '@radx/radx-backend-express'
import { TickerModel } from './Ticker'
import { ITicker } from '..'

export type WatchlistItemId = number

export class WatchlistItemModel extends ModelWithCreatedAndUpdatedAt {
  static tableName = 'watchlist'
  static idColumn = 'id'

  id?: WatchlistItemId
  profileId?: number
  tickerId?: string
  ticker?: ITicker
  isNotificationsEnabled?: boolean
  order?: number
  createdAt?: Date
  updatedAt?: Date

  static jsonSchema = {
    type: 'object',

    properties: {
      id: { type: 'number' },
      profileId: { type: 'number' },
      tickerId: { type: 'string' },
      isNotificationsEnabled: { type: 'boolean' },
      order: { type: 'number' }
    }
  }
}

export default function defineWatchlistItemModel(
  runner: ExpressRunnerModule,
  knex: Knex,
  Ticker: () => typeof TickerModel
): typeof WatchlistItemModel {
  const _WatchlistItem = WatchlistItemModel.bindKnex(knex)

  // Make sure we always create different class (and it consequently has a different config).
  // Can't rely on bindKnex() for this, as it uses a cache internally, it will return same class
  // for the same knex instance.
  class WatchlistItem extends _WatchlistItem {}

  runner.beforeStart(async () => {
    WatchlistItem.relationMappings = {
      ticker: {
        relation: Model.BelongsToOneRelation,
        modelClass: Ticker,
        join: {
          from: 'watchlist.tickerId',
          to: 'tickers.symbol'
        }
      }
    }
  })

  return WatchlistItem
}
