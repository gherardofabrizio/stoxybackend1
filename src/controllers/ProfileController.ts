import moment from 'moment'

// Types imports
import { Transaction } from 'objection'
import { ExpressRunnerModule } from '@radx/radx-backend-express'
import { KnexModule } from '@radx/radx-backend-knex'
import { StoxyModelModule } from '_app/model/stoxy'
import { ProfileModel } from '_app/model/stoxy/models/Profile'

export interface ProfileUpdate {
  firstName?: string
  lastName?: string
  birthday?: Date
}

export interface ProfileCreate extends ProfileUpdate {}

export default class ProfileController {
  private runner: ExpressRunnerModule
  private database: KnexModule
  private stoxyModel: StoxyModelModule

  constructor(runner: ExpressRunnerModule, database: KnexModule, stoxyModel: StoxyModelModule) {
    this.runner = runner
    this.database = database
    this.stoxyModel = stoxyModel
  }

  async getProfile(profileId: number, trx?: Transaction): Promise<ProfileModel> {
    let { errors } = this.runner
    let { Profile } = this.stoxyModel

    const profile = await Profile.query(trx).findById(profileId)

    if (!profile) {
      throw errors.notFound(`Profile not found: ${profileId}`)
    }

    return profile
  }

  async createProfile(
    userId: number,
    createProfile: ProfileCreate,
    trx: Transaction
  ): Promise<ProfileModel> {
    const { Profile } = this.stoxyModel

    let newProfile = await Profile.query(trx).insert({
      id: userId
    })

    newProfile = await this.updateProfile(userId, createProfile, trx)

    return newProfile
  }

  async updateProfile(
    profileId: number,
    updateProfile: ProfileUpdate,
    trx: Transaction
  ): Promise<ProfileModel> {
    const { errors } = this.runner
    const { Profile } = this.stoxyModel
    let updatedProfile

    try {
      updatedProfile = await Profile.query(trx).patchAndFetchById(profileId, {
        firstName: updateProfile.firstName || undefined,
        lastName: updateProfile.lastName || undefined,
        birthday: updateProfile.birthday || undefined
      })

      return updatedProfile!
    } catch (error) {
      throw error
    }
  }
}
