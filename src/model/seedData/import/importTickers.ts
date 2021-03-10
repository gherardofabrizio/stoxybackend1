const fs = require('fs')
const Papa = require('papaparse')
import request from 'request'

import { ExpressRunnerModule } from '@radx/radx-backend-express'
import { AuthModule } from '@radx/radx-backend-auth'
import { StoxyModelModule } from '../../stoxy'
import { transaction, Transaction } from 'objection'
import { KnexModule } from '@radx/radx-backend-knex'

export default function importMICs(
  runner: ExpressRunnerModule,
  database: KnexModule,
  auth: AuthModule,
  stoxyModel: StoxyModelModule,
  config: {
    finnhub: {
      useSandbox: boolean
      APIKey: string
    }
  }
) {
  async function importTickersFromExchange(exchangeCode: string) {
    const { Ticker, StockMarket } = stoxyModel

    const rawTickersList: any = await new Promise<void>(async (resolve, reject) => {
      request.get(
        {
          url:
            'https://finnhub.io/api/v1/stock/symbol?exchange=' +
            exchangeCode +
            '&token=' +
            config.finnhub.APIKey,
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

    // console.log('rawTickersList: ', rawTickersList)

    while (rawTickersList.length) {
      const item = rawTickersList.shift()

      let payload = {
        symbol: item['symbol'] + '',
        description: item['description'] ? item['description'] + '' : undefined,
        displaySymbol: item['displaySymbol'] ? item['displaySymbol'] + '' : undefined,
        currency: item['currency'] ? item['currency'] + '' : undefined,
        stockMarketId: item['mic'] || undefined,
        type: item['type']
      }

      // console.log('-------------------')
      // console.log('payload: ', payload)

      if (!payload.stockMarketId) {
        continue
      }

      const checkMic = await StockMarket.query().where({ mic: payload.stockMarketId }).first()
      if (!checkMic) {
        continue
      }

      const checkTicker = await Ticker.query().where({ symbol: payload.symbol }).first()
      if (checkTicker) {
        await Ticker.query().update(payload).where({ symbol: payload.symbol })
      } else {
        await Ticker.query().insert(payload)
      }
    }
  }

  async function getExchangeCodesList(xmlFilename: string): Promise<Array<string>> {
    console.log('getExchangeCodesList from xmlFilename: ', xmlFilename)

    return new Promise<Array<string>>(async (resolve, reject) => {
      try {
        Papa.parse(fs.createReadStream(xmlFilename), {
          header: true,
          complete: (results: any) => {
            const { data } = results
            const codes: Array<string> = data.map((row: any) => row['code'])
            resolve(codes)
          },
          error: function (error: any) {
            reject(error)
          }
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  const importWithExchangesFromFile = async (xmlFilename: string) => {
    console.log('importExchangesFromFile xmlFilename: ', xmlFilename)

    const exchangesCodesList = await getExchangeCodesList(xmlFilename)

    while (exchangesCodesList.length) {
      let executionStart = process.hrtime()

      const exchangeCode = exchangesCodesList.shift()

      console.log('Importing tickers for exchange: ', exchangeCode)

      await importTickersFromExchange(exchangeCode!)

      const executionDiff = process.hrtime(executionStart)

      if (config.finnhub.useSandbox) {
        const finnhubRequestRateDelay = (delay: number) =>
          new Promise<void>((resolve, reject) => {
            setTimeout(function () {
              resolve()
            }, delay)
          })

        const executionTime = executionDiff[0] * 1e3 + executionDiff[1] * 1e-6
        console.log('executionTime: ', executionTime)

        if (executionTime < 1000) {
          console.log('delaying finnhub request')
          await finnhubRequestRateDelay(1000 - executionTime)
        }
      }
    }
  }

  return {
    importWithExchangesFromFile
  }
}
