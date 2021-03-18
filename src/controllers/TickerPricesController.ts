import moment from 'moment'

import request from 'request'

// Types imports
import { raw, Transaction } from 'objection'
import { ExpressRunnerModule } from '@radx/radx-backend-express'
import { KnexModule } from '@radx/radx-backend-knex'
import { StoxyModelModule, ITickerPriceInfo } from '_app/model/stoxy'

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
  private config: TickerPricesControllerConfig

  constructor(
    runner: ExpressRunnerModule,
    database: KnexModule,
    stoxyModel: StoxyModelModule,
    config: TickerPricesControllerConfig
  ) {
    this.runner = runner
    this.database = database
    this.stoxyModel = stoxyModel
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
    // TODO - add caching
    return this.fetchPriceForSymbol(tickerSymbol)
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

    console.log('finnhubResponse: ', response)

    const parseResponseField = (fieldName: string): number | null => {
      return response[fieldName] !== undefined ? response[fieldName] : null
    }

    const priceChange = (): number | null => {
      const previousClose = parseResponseField('pc')
      const currentPrice = parseResponseField('c')

      if (previousClose !== null && currentPrice !== null) {
        return this.roundNumberToDigits(currentPrice - previousClose)
      }

      return null
    }

    const pricePercentageChange = (): number | null => {
      const previousClose = parseResponseField('pc')
      const currentPrice = parseResponseField('c')

      if (previousClose !== null && currentPrice !== null) {
        return this.roundNumberToDigits(((currentPrice - previousClose) / previousClose) * 100)
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
      pricePercentageChange: pricePercentageChange()
    }

    console.log('info: ', info)

    return info
  }

  private roundNumberToDigits(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100
  }
}
