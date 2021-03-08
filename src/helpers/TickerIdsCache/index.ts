import { ExpressRunnerModule } from '@radx/radx-backend-express'

import TickerIdBySymbolCache from './TickerIdBySymbolCache'

// Types imports
import { StoxyModelModule } from '_app/model/stoxy'
import { Transaction } from 'objection'

export default class TickerIdsCache {
  private runner: ExpressRunnerModule
  private model: StoxyModelModule
  private tickerIdBySymbolCache: TickerIdBySymbolCache

  constructor(runner: ExpressRunnerModule, model: StoxyModelModule) {
    this.runner = runner
    this.model = model
    this.tickerIdBySymbolCache = new TickerIdBySymbolCache()
  }

  async getTickerIdBySymbol(symbol: string, trx?: Transaction): Promise<number> {
    const { Ticker } = this.model
    const { errors } = this.runner

    let tickerId = await this.tickerIdBySymbolCache.getIdForSymbol(symbol)
    if (tickerId) {
      return tickerId
    }

    const ticker = await Ticker.query(trx).where({ symbol }).first()
    if (!ticker) {
      const error = errors.notFound(`Ticker with symbol ${symbol} not found`)
      error.radxCode = 'tickers/notFound'
      throw error
    } else {
      tickerId = ticker.id!
      await this.tickerIdBySymbolCache.setIdForSymbol(tickerId, symbol)
    }

    return tickerId!
  }
}
