import Knex from 'knex'
import { Model } from 'objection'
import { ModelWithCreatedAndUpdatedAt } from '@radx/radx-backend-knex'

// Type imports
import { ExpressRunnerModule } from '@radx/radx-backend-express'
import { ITicker } from '..'
import { TickerModel } from './Ticker'

export type NewsSourceId = number

export class NewsSourceModel extends ModelWithCreatedAndUpdatedAt {
  static tableName = 'news_sources'
  static idColumn = 'id'

  id?: NewsSourceId
  title?: string
  siteURL?: string
  rssFeedURL?: string
  isDefault?: boolean
  createdAt?: Date
  updatedAt?: Date

  static jsonSchema = {
    type: 'object',

    properties: {
      id: { type: 'number' },
      title: { type: 'string' },
      siteURL: { type: 'string' },
      rssFeedURL: { type: 'string' },
      isDefault: { type: 'boolean' }
    }
  }
}

export default function defineNewsSourceModel(
  runner: ExpressRunnerModule,
  knex: Knex
): typeof NewsSourceModel {
  const _NewsSourceModel = NewsSourceModel.bindKnex(knex)

  // Make sure we always create different class (and it consequently has a different config).
  // Can't rely on bindKnex() for this, as it uses a cache internally, it will return same class
  // for the same knex instance.
  class NewsSource extends _NewsSourceModel {}

  runner.beforeStart(async () => {
    NewsSource.relationMappings = {}
  })

  return NewsSource
}
