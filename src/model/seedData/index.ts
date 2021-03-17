import moment from 'moment'

import importMICs from './import/importMICs'
import importTickers from './import/importTickers'
import { builtInNewsSources } from './builtInNewsSources'

// Type imports
import { ExpressRunnerModule } from '@radx/radx-backend-express'
import { AuthModule } from '@radx/radx-backend-auth'
import { StoxyModelModule } from '../stoxy'
import { transaction, Transaction } from 'objection'
import { KnexModule } from '@radx/radx-backend-knex'

export interface SeedDataConfig {
  finnhub: {
    useSandbox: boolean
    APIKey: string
  }
}

export default function seedDataModule(
  runner: ExpressRunnerModule,
  database: KnexModule,
  auth: AuthModule,
  stoxyModel: StoxyModelModule,
  config: SeedDataConfig
) {
  const MICsImporter = importMICs(runner, database, auth, stoxyModel)
  const TickersImporter = importTickers(runner, database, auth, stoxyModel, config)

  const seedDefaultNewsSources = async () => {
    const { NewsSource } = stoxyModel
    const { knex } = database

    await transaction(knex, async trx => {
      const atLeastOneNewsSource = await NewsSource.query(trx).first()
      if (atLeastOneNewsSource) {
        return
      }

      await Promise.all(
        builtInNewsSources.map(async payload => {
          return NewsSource.query(trx).insert(Object.assign({ isBuiltIn: true }, payload))
        })
      )
    })
  }

  const seedTickers = async () => {
    const { Ticker } = stoxyModel
    const { knex } = database

    const atLeastOneTicker = await Ticker.query().first()
    if (atLeastOneTicker) {
      return
    }

    try {
      await TickersImporter.importWithExchangesFromFile(
        __dirname + '/../../data/FinnhubExchanges.csv'
      )
    } catch (error) {
      console.log('seedMICs error: ', error)
    }
  }

  const seedMICs = async () => {
    const { StockMarket } = stoxyModel
    const { knex } = database

    await transaction(knex, async trx => {
      const atLeastOneStockMarket = await StockMarket.query(trx).first()
      if (atLeastOneStockMarket) {
        return
      }

      try {
        await MICsImporter.importFromFile(__dirname + '/../../data/ISO10383_MIC.xml', trx)
      } catch (error) {
        console.log('seedMICs error: ', error)
      }
    })
  }

  runner.beforeStart(async () => {
    await seedMICs()

    await seedTickers()

    await seedDefaultNewsSources()

    console.log('Seed data finished')
  })
}
