import Knex from 'knex'
import { Model } from 'objection'
import { ModelWithCreatedAndUpdatedAt } from '@radx/radx-backend-knex'

// Type imports
import { ExpressRunnerModule } from '@radx/radx-backend-express'
import { ITicker } from '..'
import { TickerModel } from './Ticker'
import { NewsSourceId, NewsSourceModel } from './NewsSource'

export type NewsId = number

export class NewsModel extends ModelWithCreatedAndUpdatedAt {
  static tableName = 'news'
  static idColumn = 'id'

  id?: NewsId
  newsSourceId?: NewsSourceId
  publicationDate?: Date
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
      publicationDate: { type: 'date-time' },
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
  NewsSource: () => typeof NewsSourceModel,
  Ticker: () => typeof TickerModel
): typeof NewsModel {
  const _NewsModel = NewsModel.bindKnex(knex)

  // Make sure we always create different class (and it consequently has a different config).
  // Can't rely on bindKnex() for this, as it uses a cache internally, it will return same class
  // for the same knex instance.
  class News extends _NewsModel {}

  runner.beforeStart(async () => {
    News.relationMappings = {
      newsSource: {
        relation: Model.BelongsToOneRelation,
        modelClass: NewsSource,
        join: {
          from: 'news.newsSourceId',
          to: 'news_sources.id'
        }
      },
      tickers: {
        relation: Model.ManyToManyRelation,
        modelClass: Ticker,
        join: {
          from: 'news.id',
          through: {
            from: 'news_tickers.newsId',
            to: 'news_tickers.tickerId'
          },
          to: 'tickers.symbol'
        }
      }
    }
  })

  return News
}
