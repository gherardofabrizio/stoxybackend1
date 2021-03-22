import moment from 'moment'

import request from 'request'

// Types imports
import { raw, Transaction } from 'objection'
import { ExpressRunnerModule } from '@radx/radx-backend-express'
import { KnexModule } from '@radx/radx-backend-knex'
import { StoxyModelModule, ITickerPriceInfo } from '_app/model/stoxy'
import KeyValueCache from '../services/KeyValueCache'

export interface TickerPricesControllerConfig {
  finnhub: {
    useSandbox: boolean
    APIKey: string
  }
}

export default class TickerPricesController {
  private runner: ExpressRunnerModule
  private database: KnexModule
  private stoxyModel: StoxyModelModule
  private cache: KeyValueCache
  private config: TickerPricesControllerConfig

  constructor(
    runner: ExpressRunnerModule,
    database: KnexModule,
    stoxyModel: StoxyModelModule,
    cache: KeyValueCache,
    config: TickerPricesControllerConfig
  ) {
    this.runner = runner
    this.database = database
    this.stoxyModel = stoxyModel
    this.cache = cache
    this.config = config
  }

  async getPriceForTickers(tickerSymbols: Array<string>): Promise<Array<ITickerPriceInfo>> {
    const result = await Promise.all(
      tickerSymbols.map(async tickerSymbol => {
        return this.getPriceForSymbol(tickerSymbol)
      })
    )

    return result
  }

  private async getPriceForSymbol(tickerSymbol: string): Promise<ITickerPriceInfo> {
    const cachedValue = await this.cache.getValueForKey('priceInfo:' + tickerSymbol)
    // Use cached info
    if (cachedValue) {
      try {
        const obj = JSON.parse(cachedValue)
        let info = this.parsePriceInfoFromResponse(tickerSymbol, obj)
        return info
      } catch {}
    }

    // Fetch info from Finnhub
    const priceInfo = await this.fetchPriceForSymbol(tickerSymbol)

    this.cache.setValueForKey(
      this.priceInfoToString(priceInfo),
      'priceInfo:' + tickerSymbol,
      5 * 60 // Cache for 5 minutes
    )

    return priceInfo
  }

  private async fetchPriceForSymbol(tickerSymbol: string): Promise<ITickerPriceInfo> {
    const response: any = await new Promise<void>(async (resolve, reject) => {
      request.get(
        {
          url:
            'https://finnhub.io/api/v1/quote?symbol=' +
            tickerSymbol +
            '&token=' +
            this.config.finnhub.APIKey,
          json: true
        },
        function (error, response, body) {
          if (error) {
            reject(error)
          } else {
            resolve(body)
          }
        }
      )
    })

    return this.parsePriceInfoFromResponse(tickerSymbol, response)
  }

  private parsePriceInfoFromResponse(tickerSymbol: string, response: any) {
    const parseResponseField = (fieldName: string): number | null => {
      return response[fieldName] !== undefined ? response[fieldName] : null
    }

    const priceChange = (): number | null => {
      const previousClose = parseResponseField('pc')
      const currentPrice = parseResponseField('c')

      if (previousClose !== null && currentPrice !== null) {
        return this.roundNumberToTwoDigits(currentPrice - previousClose)
      }

      return null
    }

    const pricePercentageChange = (): number | null => {
      const previousClose = parseResponseField('pc')
      const currentPrice = parseResponseField('c')

      if (previousClose !== null && currentPrice !== null) {
        return this.roundNumberToTwoDigits(((currentPrice - previousClose) / previousClose) * 100)
      }

      return null
    }

    const info: ITickerPriceInfo = {
      tickerSymbol,
      openPrice: parseResponseField('o'),
      highPrice: parseResponseField('h'),
      lowPrice: parseResponseField('l'),
      currentPrice: parseResponseField('c'),
      previousClose: parseResponseField('pc'),
      priceChange: priceChange(),
      pricePercentageChange: pricePercentageChange(),
      updatedAt:
        parseResponseField('t') !== null
          ? moment.unix(parseResponseField('t')!).toDate()
          : new Date()
    }

    return info
  }

  private priceInfoToString(info: ITickerPriceInfo) {
    return JSON.stringify({
      s: info.tickerSymbol,
      o: info.openPrice,
      h: info.highPrice,
      l: info.lowPrice,
      c: info.currentPrice,
      pc: info.previousClose,
      t: moment(info.updatedAt).unix()
    })
  }

  private roundNumberToTwoDigits(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100
  }
}
