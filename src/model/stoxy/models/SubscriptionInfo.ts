import Knex from 'knex'
import { Model } from 'objection'
import { ModelWithCreatedAndUpdatedAt } from '@radx/radx-backend-knex'

// Type imports
import { ExpressRunnerModule } from '@radx/radx-backend-express'

export type SubscriptionInfoId = number

export enum SubscriptionStatus {
  SubscriptionStatusTrial = 1,
  SubscriptionStatusSubscribed = 2
}

export function subscriptionStatusFromString(
  subscriptionStatusString: string | undefined
): SubscriptionStatus | undefined {
  switch (subscriptionStatusString) {
    case 'subscribed':
      return SubscriptionStatus.SubscriptionStatusSubscribed
    case 'trial':
      return SubscriptionStatus.SubscriptionStatusTrial
  }
}

export function subscriptionStatusToString(
  subscriptionStatus: SubscriptionStatus | undefined
): string | undefined {
  switch (subscriptionStatus) {
    case SubscriptionStatus.SubscriptionStatusSubscribed:
      return 'subscribed'
    case SubscriptionStatus.SubscriptionStatusTrial:
      return 'trial'
  }
}

export class SubscriptionInfoModel extends ModelWithCreatedAndUpdatedAt {
  static tableName = 'subscription_info'
  static idColumn = 'id'

  id?: SubscriptionInfoId
  profileId?: number
  status?: SubscriptionStatus
  until?: Date
  createdAt?: Date
  updatedAt?: Date

  static jsonSchema = {
    type: 'object',

    properties: {
      id: { type: 'number' },
      profileId: { type: 'number' },
      status: { type: 'number' },
      until: { type: 'date' }
    }
  }
}

export default function defineSubscriptionInfoModel(
  runner: ExpressRunnerModule,
  knex: Knex
): typeof SubscriptionInfoModel {
  const _SubscriptionInfoModel = SubscriptionInfoModel.bindKnex(knex)

  // Make sure we always create different class (and it consequently has a different config).
  // Can't rely on bindKnex() for this, as it uses a cache internally, it will return same class
  // for the same knex instance.
  class SubscriptionInfo extends _SubscriptionInfoModel {}

  runner.beforeStart(async () => {
    SubscriptionInfo.relationMappings = {}
  })

  return SubscriptionInfo
}
