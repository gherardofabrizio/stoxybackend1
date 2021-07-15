import moment from 'moment'

import request from 'request'

// Types imports
import { raw, Transaction } from 'objection'
import { ExpressRunnerModule } from '@radx/radx-backend-express'
import { KnexModule } from '@radx/radx-backend-knex'
import { StoxyModelModule, ITickerPriceInfo } from '_app/model/stoxy'
import KeyValueCache from '../services/KeyValueCache'
import { TickerPriceInfo } from '_app/model/stoxy/models/TickerPriceInfo'

export interface TickerPricesControllerConfig {
  tickerPriceCacheTime: number
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
    const rawResult = await Promise.all(
      tickerSymbols.map(async tickerSymbol => {
        return this.getPriceForSymbol(tickerSymbol)
      })
    )

    const result: Array<ITickerPriceInfo> = []
    rawResult.forEach(info => {
      if (info !== null) {
        result.push(info)
      }
    })

    return result
  }

  private async getPriceForSymbol(tickerSymbol: string): Promise<ITickerPriceInfo | null> {
    const cachedValue = await this.cache.getValueForKey('priceInfo:' + tickerSymbol)
    let cachedInfo: TickerPriceInfo | undefined
    // Use cached info
    if (cachedValue) {
      try {
        const obj = JSON.parse(cachedValue)
        cachedInfo = this.parsePriceInfoFromResponse(tickerSymbol, obj)
        const cacheStoredFor = moment
          .duration(moment(new Date()).diff(cachedInfo.fetchedAt))
          .asSeconds()

        if (cacheStoredFor < this.config.tickerPriceCacheTime) {
          return cachedInfo
        }
      } catch {}
    }

    // Fetch info from Finnhub
    const fetchedPriceInfo = await this.fetchPriceForSymbol(tickerSymbol)

    if (fetchedPriceInfo) {
      this.cache.setValueForKey(
        this.priceInfoToString(fetchedPriceInfo, new Date()),
        'priceInfo:' + tickerSymbol
      )

      return fetchedPriceInfo
    }

    // Return cachedInfo if API rate limits were exceeded
    if (cachedInfo) {
      return cachedInfo
    }

    return null
  }

  private async fetchPriceForSymbol(tickerSymbol: string): Promise<ITickerPriceInfo | null> {
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
            // API limits exceeded
            if (response.statusCode === 429) {
              resolve()
            }
            resolve(body)
          }
        }
      )
    })

    return response ? this.parsePriceInfoFromResponse(tickerSymbol, response) : null
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
      fetchedAt:
        parseResponseField('_f') !== null ? moment.unix(parseResponseField('_f')!).toDate() : null,
      updatedAt:
        parseResponseField('t') !== null
          ? moment.unix(parseResponseField('t')!).toDate()
          : new Date()
    }

    return info
  }

  private priceInfoToString(info: ITickerPriceInfo, fetchedAt: Date) {
    return JSON.stringify({
      _f: moment(fetchedAt).unix(),
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
