import moment from 'moment'

// Types imports
import { Transaction } from 'objection'
import { ExpressRunnerModule } from '@radx/radx-backend-express'
import { KnexModule } from '@radx/radx-backend-knex'
import { StoxyModelModule } from '_app/model/stoxy'
import { INewsSourcesList } from '_app/model/stoxy'

export default class NewsSourcesController {
  private runner: ExpressRunnerModule
  private database: KnexModule
  private stoxyModel: StoxyModelModule

  constructor(runner: ExpressRunnerModule, database: KnexModule, stoxyModel: StoxyModelModule) {
    this.runner = runner
    this.database = database
    this.stoxyModel = stoxyModel
  }

  async getDefaultNewsSourcesList(trx?: Transaction): Promise<INewsSourcesList> {
    const { NewsSource } = this.stoxyModel

    const list = await NewsSource.query(trx).where({ isDefault: true }).orderBy('title', 'ASC')

    return {
      data: list,
      hasMore: false
    }
  }

  async getNewsSourcesListForProfile(
    profileId: number,
    trx?: Transaction
  ): Promise<INewsSourcesList> {
    const { NewsSource } = this.stoxyModel

    const data = await NewsSource.query(trx)
      .joinRaw(
        ' INNER JOIN `profile_news_sources` ON `profile_news_sources`.`newsSourceId` = `news_sources`.`id` '
      )
      .orderBy('title', 'ASC')

    return {
      data,
      hasMore: false
    }
  }

  async addNewsSourceToListForProfile(newsSourceId: number, profileId: number, trx?: Transaction) {
    const { knex } = this.database

    // Check for duplicate
    const possibleDuplicate = await (trx || knex)
      .select('*')
      .from('profile_news_sources')
      .where({
        newsSourceId,
        profileId
      })
      .first()
    if (possibleDuplicate) {
      return
    }

    // Add to list
    await (trx || knex)
      .insert({
        newsSourceId,
        profileId
      })
      .into('profile_news_sources')
  }

  async removeNewsSourceFromListForProfile(
    newsSourceId: number,
    profileId: number,
    trx?: Transaction
  ) {
    const { knex } = this.database
    const { errors } = this.runner

    await (trx || knex)
      .delete()
      .where({
        newsSourceId,
        profileId
      })
      .into('profile_news_sources')

    // Check for at least one news source at list
    const atLeastOneNewsSource = await (trx || knex)
      .select('*')
      .from('profile_news_sources')
      .where({
        newsSourceId,
        profileId
      })
      .first()
    if (!atLeastOneNewsSource) {
      const error = errors.create(
        `You need to have at least one news source at list`,
        'newsSourcesList/canNotBeEmpty',
        {},
        400
      )
      throw error
    }
  }
}
