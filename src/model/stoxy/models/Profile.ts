import Knex from 'knex'
import { ModelWithCreatedAndUpdatedAt } from '@radx/radx-backend-knex'

// Type imports
import { ExpressRunnerModule } from '@radx/radx-backend-express'

export type ProfileId = number

export class ProfileModel extends ModelWithCreatedAndUpdatedAt {
  static tableName = 'profiles'
  static idColumn = 'id'

  id?: ProfileId
  firstName?: string
  lastName?: string
  birthday?: Date
  createdAt?: Date
  updatedAt?: Date

  static jsonSchema = {
    type: 'object',

    properties: {
      id: { type: 'number' },
      firstName: { type: 'string', maxLength: 255 },
      lastName: { type: 'string', maxLength: 255 },
      birthday: { type: 'date' }
    }
  }
}

export default function defineProfileModel(
  runner: ExpressRunnerModule,
  knex: Knex
): typeof ProfileModel {
  const _Profile = ProfileModel.bindKnex(knex)

  // Make sure we always create different class (and it consequently has a different config).
  // Can't rely on bindKnex() for this, as it uses a cache internally, it will return same class
  // for the same knex instance.
  class Profile extends _Profile {}

  runner.beforeStart(async () => {
    Profile.relationMappings = {}
  })

  return Profile
}
