import { KnexModule } from '@radx/radx-backend-knex'

import defineSessionWithFCMTokenModel from './SessionWithFCMToken'

import migration_1_0_0_create_firebase_messaging from './migrations/1.0.0_create_firebase_messaging'

// Types import
import { UserModelClass, SessionModelClass } from '@radx/radx-backend-auth'
import { ExpressRunnerModule } from '@radx/radx-backend-express'

export type FCMModelConfig = {
  storeNotifications?: boolean
}

export default function fcmModelModule(
  runner: ExpressRunnerModule,
  database: KnexModule,
  User: UserModelClass,
  config: FCMModelConfig
) {
  const SessionWithFCMToken = defineSessionWithFCMTokenModel(runner, database.knex, User)

  const migrations: any = {
    '1.0.0_create_firebase_messaging': migration_1_0_0_create_firebase_messaging
  }

  const migrationConfig = {
    tableName: 'knex_migrations_firebase_messaging',
    migrationSource: {
      getMigrations: async () => Object.keys(migrations).sort(),
      getMigrationName: (migration: string) => migration,
      getMigration: (name: string) => migrations[name]
    }
  }
  database.registerMigration(
    {
      name: 'firebase_messaging',
      version: 1,
      dependencies: [{ name: 'auth' }]
    },
    migrationConfig
  )

  return {
    SessionWithFCMToken
  }
}

export type FCMModelModule = ReturnType<typeof fcmModelModule>
