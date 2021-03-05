import Knex from 'knex'
import { ModelWithCreatedAndUpdatedAt } from '@radx/radx-backend-knex'

// Type imports
import { ExpressRunnerModule } from '@radx/radx-backend-express'

export type TickerId = number

export class TickerModel extends ModelWithCreatedAndUpdatedAt {
  static tableName = 'tickers'
  static idColumn = 'id'

  id?: TickerId
  symbol?: string
  description?: string
  displaySymbol?: string
  createdAt?: Date
  updatedAt?: Date

  static jsonSchema = {
    type: 'object',

    properties: {
      id: { type: 'number' },
      symbol: { type: 'string', maxLength: 16 },
      description: { type: 'string', maxLength: 64 },
      displaySymbol: { type: 'string', maxLength: 16 }
    }
  }
}

export default function defineTickerModel(
  runner: ExpressRunnerModule,
  knex: Knex
): typeof TickerModel {
  const _TickerModel = TickerModel.bindKnex(knex)

  // Make sure we always create different class (and it consequently has a different config).
  // Can't rely on bindKnex() for this, as it uses a cache internally, it will return same class
  // for the same knex instance.
  class Ticker extends _TickerModel {}

  runner.beforeStart(async () => {
    Ticker.relationMappings = {}
  })

  return Ticker
}
