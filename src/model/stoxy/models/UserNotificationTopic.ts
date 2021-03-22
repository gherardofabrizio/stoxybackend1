import Knex from 'knex'
import { Model } from 'objection'
import { ModelWithCreatedAndUpdatedAt } from '@radx/radx-backend-knex'

// Type imports
import { ExpressRunnerModule } from '@radx/radx-backend-express'

export class UserNotificationTopicModel extends ModelWithCreatedAndUpdatedAt {
  static tableName = 'users_notification_topics'

  userId?: number
  topic?: string
  createdAt?: Date
  updatedAt?: Date

  static jsonSchema = {
    type: 'object',

    properties: {
      userId: { type: 'number' },
      topic: { type: 'string', maxLength: 255 },
      createdAt: { type: 'date-time' },
      updatedAt: { type: 'date-time' }
    }
  }
}

export default function defineUserNotificationTopicModel(
  runner: ExpressRunnerModule,
  knex: Knex
): typeof UserNotificationTopicModel {
  const _UserNotificationTopic = UserNotificationTopicModel.bindKnex(knex)

  // Make sure we always create different class (and it consequently has a different config).
  // Can't rely on bindKnex() for this, as it uses a cache internally, it will return same class
  // for the same knex instance.
  class UserNotificationTopic extends _UserNotificationTopic {}

  runner.beforeStart(async () => {})

  return UserNotificationTopic
}
