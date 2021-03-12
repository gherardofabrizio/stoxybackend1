import Knex from 'knex'
import { Model } from 'objection'
import { ModelWithCreatedAndUpdatedAt } from '@radx/radx-backend-knex'

// Type imports
import { ExpressRunnerModule } from '@radx/radx-backend-express'
import { StockMarketId, StockMarketModel } from './StockMarket'
import { IStockMarket, ITicker } from '..'
import { TickerModel } from './Ticker'

export type NewsId = number

export class NewsModel extends ModelWithCreatedAndUpdatedAt {
  static tableName = 'news'
  static idColumn = 'id'

  id?: NewsId
  title?: string
  description?: string
  link?: string
  tickers?: Array<ITicker>
  notificationsWasSent?: boolean
  createdAt?: Date
  updatedAt?: Date

  static jsonSchema = {
    type: 'object',

    properties: {
      id: { type: 'number' },
      title: { type: 'string' },
      description: { type: 'string' },
      link: { type: 'string' },
      notificationsWasSent: { type: 'boolean' }
    }
  }
}

export default function defineNewsModel(
  runner: ExpressRunnerModule,
  knex: Knex,
  Ticker: () => typeof TickerModel
): typeof NewsModel {
  const _NewsModel = NewsModel.bindKnex(knex)

  // Make sure we always create different class (and it consequently has a different config).
  // Can't rely on bindKnex() for this, as it uses a cache internally, it will return same class
  // for the same knex instance.
  class News extends _NewsModel {}

  runner.beforeStart(async () => {
    News.relationMappings = {
      tickers: {
        relation: Model.HasManyRelation,
        modelClass: Ticker,
        join: {
          from: 'profiles.id',
          to: 'profile_multiple_options.profileId'
        }
      }
    }
  })

  return News
}
