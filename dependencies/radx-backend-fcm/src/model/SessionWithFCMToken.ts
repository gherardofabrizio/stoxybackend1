import Knex from 'knex'
import { Model } from 'objection'

// Import types
import { SessionModel, UserModelClass } from '../../../radx-backend-auth'
import { ExpressRunnerModule } from '@radx/radx-backend-express'

export class SessionWithFCMTokenModel extends SessionModel {
  fcmToken?: string | null
}

export default function defineSessionWithFCMTokenModel(
  runner: ExpressRunnerModule,
  knex: Knex,
  User: UserModelClass
): typeof SessionWithFCMTokenModel {
  const _SessionWithFCMToken = SessionWithFCMTokenModel.bindKnex(knex)

  // Make sure we always create different class (and it consequently has a different config).
  // Can't rely on bindKnex() for this, as it uses a config internally, it will return same class
  // for the same knex instance.
  class SessionWithFCMToken extends _SessionWithFCMToken {}

  runner.beforeStart(async () => {
    SessionWithFCMToken.relationMappings = {
      user: {
        relation: Model.BelongsToOneRelation,
        modelClass: User,
        join: {
          from: 'sessions.userId',
          to: 'users.id'
        }
      }
    }
  })

  return SessionWithFCMToken
}
