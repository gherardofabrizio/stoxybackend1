import moment from 'moment'

// Types imports
import { Transaction } from 'objection'
import { ExpressRunnerModule } from '@radx/radx-backend-express'
import { KnexModule } from '@radx/radx-backend-knex'
import { StoxyModelModule } from '_app/model/stoxy'
import { ProfileModel } from '_app/model/stoxy/models/Profile'
import { ISubscriptionInfo } from '_app/model/stoxy'
import { SubscriptionStatus } from '../model/stoxy/models/SubscriptionInfo'

export interface SubscriptionInfo {
  status?: SubscriptionStatus
  until?: Date
}

export default class SubscriptionController {
  constructor(
    private runner: ExpressRunnerModule,
    private database: KnexModule,
    private stoxyModel: StoxyModelModule
  ) {}

  private async createSubscriptionInfoForProfile(profileId: number, trx?: Transaction) {
    const { SubscriptionInfo } = this.stoxyModel

    const checkInfo = await SubscriptionInfo.query(trx).findOne({
      profileId
    })
    if (checkInfo) {
      return
    }

    await SubscriptionInfo.query(trx).insert({
      profileId,
      status: SubscriptionStatus.SubscriptionStatusTrial
    })
  }

  public async updateSubscriptionInfoForProfile(
    profileId: number,
    updateSubscriptionInfo: SubscriptionInfo,
    trx?: Transaction
  ): Promise<ISubscriptionInfo> {
    const { SubscriptionInfo } = this.stoxyModel

    // Lazy subscription info initialization
    await this.createSubscriptionInfoForProfile(profileId, trx)

    await SubscriptionInfo.query(trx).update(updateSubscriptionInfo).where({
      profileId: profileId
    })

    const info = this.getSubscriptionInfoForProfile(profileId, trx)

    return info
  }

  public async getSubscriptionInfoForProfile(
    profileId: number,
    trx?: Transaction
  ): Promise<ISubscriptionInfo> {
    const { SubscriptionInfo } = this.stoxyModel

    // Lazy subscription info initialization
    await this.createSubscriptionInfoForProfile(profileId, trx)

    const info = await SubscriptionInfo.query(trx).findOne({
      profileId
    })

    return info
  }
}
