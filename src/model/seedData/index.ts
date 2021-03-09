import moment from 'moment'

import importMICs from './import/importMICs'

// Type imports
import { ExpressRunnerModule } from '@radx/radx-backend-express'
import { AuthModule } from '@radx/radx-backend-auth'
import { StoxyModelModule } from '../stoxy'
import { transaction, Transaction } from 'objection'
import { KnexModule } from '@radx/radx-backend-knex'

export interface SeedDataConfig {}

export default function seedDataModule(
  runner: ExpressRunnerModule,
  database: KnexModule,
  auth: AuthModule,
  stoxyModel: StoxyModelModule,
  config: SeedDataConfig
) {
  const MICsImporter = importMICs(runner, database, auth, stoxyModel)

  const seedTickers = async (trx?: Transaction) => {
    const { Ticker } = stoxyModel
    const { knex } = database

    const atLeastOneTicker = await Ticker.query(trx).first()
    if (atLeastOneTicker) {
      return
    }

    await transaction(knex, async trx => {
      await Promise.all([
        Ticker.query(trx).insert({
          symbol: 'AAPL',
          description: 'APPLE INC',
          displaySymbol: 'AAPL'
        }),
        Ticker.query(trx).insert({
          symbol: 'GOOGL',
          description: 'ALPHABET INC-CL A',
          displaySymbol: 'GOOGL'
        }),
        Ticker.query(trx).insert({
          symbol: 'VLKAF',
          description: 'VOLKSWAGEN AG',
          displaySymbol: 'VLKAF'
        }),
        Ticker.query(trx).insert({
          symbol: 'TSLA',
          description: 'TESLA INC',
          displaySymbol: 'TSLA'
        })
      ])
    })
  }

  const seedMICs = async (trx?: Transaction) => {
    const { StockMarket } = stoxyModel
    const { knex } = database

    await transaction(knex, async trx => {
      const atLeastOneStockMarket = await StockMarket.query(trx).first()
      if (atLeastOneStockMarket) {
        return
      }

      try {
        await MICsImporter.importFromFile(__dirname + '/../../data/ISO10383_MIC.xml')
      } catch (error) {
        console.log('seedMICs error: ', error)
      }
    })
  }

  runner.beforeStart(async () => {
    await seedMICs()

    await seedTickers()

    console.log('Seed data finished')
  })
}
