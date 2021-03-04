// Import models
import defineProfileModel, { ProfileModel } from './models/Profile'

// Import migrations
import migration_0001_create_profiles from './migrations/0001_create_profiles'

// Type imports
import { Model } from 'objection'
import { KnexModule } from '@radx/radx-backend-knex'
import { AuthModule } from '@radx/radx-backend-auth'
import { ExpressRunnerModule } from '@radx/radx-backend-express'

export interface UserWithProfile {
  profile?: IProfile
}

export interface StoxyModelConfig {}

export default function stoxyModelModule(
  runner: ExpressRunnerModule,
  database: KnexModule,
  auth: AuthModule,
  config: StoxyModelConfig
) {
  const Profile = defineProfileModel(runner, database.knex)

  const migrations: any = {
    migration_0001_create_profiles
  }

  const migrationConfig = {
    tableName: 'knex_migrations_stoxy',
    migrationSource: {
      getMigrations: async () => Object.keys(migrations).sort(),
      getMigrationName: (migration: string) => migration,
      getMigration: (name: string) => migrations[name]
    }
  }
  database.registerMigration(
    {
      name: 'stoxy',
      version: 1,
      dependencies: [{ name: 'auth' }]
    },
    migrationConfig
  )

  // Install hooks

  auth.model.hooks.afterUserModelInitialized(User => {
    Object.assign(User.relationMappings, {
      profile: {
        relation: Model.HasOneRelation,
        modelClass: Profile,
        join: {
          from: 'users.id',
          to: 'profiles.id'
        }
      }
    })
  })

  auth.model.hooks.onDefaultUserFetchIncludes(includes => {
    Object.assign(includes.relationExpression, {
      profile: true
    })
    return includes
  })

  auth.model.hooks.onDefaultSessionFetchIncludes(includes => {
    const relationExpression = includes.relationExpression as any
    if (relationExpression.user === true) {
      relationExpression.user = {}
    }

    Object.assign(relationExpression.user, {
      profile: true
    })
    return includes
  })

  return {
    Profile
  }
}

export type IProfile = ProfileModel

export type StoxyModelModule = ReturnType<typeof stoxyModelModule>
