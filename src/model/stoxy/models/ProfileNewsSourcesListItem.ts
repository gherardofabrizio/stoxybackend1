import Knex from 'knex'
import { Model } from 'objection'
import { ModelWithCreatedAndUpdatedAt } from '@radx/radx-backend-knex'

// Type imports
import { ExpressRunnerModule } from '@radx/radx-backend-express'
import { NewsSourceId, NewsSourceModel } from './NewsSource'
import { INewsSource } from '..'

export class ProfileNewsSourcesListItemModel extends ModelWithCreatedAndUpdatedAt {
  static tableName = 'profile_news_sources'

  profileId?: number
  newsSourceId?: NewsSourceId
  newsSource?: INewsSource
  createdAt?: Date
  updatedAt?: Date

  static jsonSchema = {
    type: 'object',

    properties: {
      profileId: { type: 'number' },
      newsSourceId: { type: 'number' },
      isNotificationsEnabled: { type: 'boolean' }
    }
  }
}

export default function defineProfileNewsSourcesListItemModel(
  runner: ExpressRunnerModule,
  knex: Knex,
  NewsSource: () => typeof NewsSourceModel
): typeof ProfileNewsSourcesListItemModel {
  const _ProfileNewsSourcesListItem = ProfileNewsSourcesListItemModel.bindKnex(knex)

  // Make sure we always create different class (and it consequently has a different config).
  // Can't rely on bindKnex() for this, as it uses a cache internally, it will return same class
  // for the same knex instance.
  class ProfileNewsSourcesListItem extends _ProfileNewsSourcesListItem {}

  runner.beforeStart(async () => {
    ProfileNewsSourcesListItem.relationMappings = {
      newsSource: {
        relation: Model.BelongsToOneRelation,
        modelClass: NewsSource,
        join: {
          from: 'profile_news_sources.newsSourceId',
          to: 'news_sources.id'
        }
      }
    }
  })

  return ProfileNewsSourcesListItem
}
