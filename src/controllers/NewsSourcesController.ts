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

  async getBuiltInNewsSourcesList(trx?: Transaction): Promise<INewsSourcesList> {
    const { NewsSource } = this.stoxyModel

    const list = await NewsSource.query(trx).where({ isBuiltIn: true }).orderBy('title', 'ASC')

    return {
      data: list,
      hasMore: false
    }
  }
}
