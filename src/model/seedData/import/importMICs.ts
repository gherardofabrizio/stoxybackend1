const fs = require('fs')
import xmlParser from 'fast-xml-parser'

import { ExpressRunnerModule } from '@radx/radx-backend-express'
import { AuthModule } from '@radx/radx-backend-auth'
import { StoxyModelModule } from '../../stoxy'
import { transaction, Transaction } from 'objection'
import { KnexModule } from '@radx/radx-backend-knex'

export default function importMICs(
  runner: ExpressRunnerModule,
  database: KnexModule,
  auth: AuthModule,
  stoxyModel: StoxyModelModule
) {
  // Parsing mics list from https://www.iso20022.org/market-identifier-codes (https://www.iso20022.org/sites/default/files/ISO10383_MIC/ISO10383_MIC.xml)
  const importFromFile = async (xmlFilename: string, trx?: Transaction) => {
    const { StockMarket } = stoxyModel

    console.log('importMICs from xmlFilename: ', xmlFilename)

    return new Promise<void>(async (resolve, reject) => {
      try {
        fs.readFile(xmlFilename, 'utf8', async function (error: any, data: any) {
          if (error) {
            reject(error)
            return
          }

          let jsonObj = xmlParser.parse(data, {})
          const parsedData: any[] =
            jsonObj['dataroot'] && jsonObj['dataroot']['MICs_x0020_List_x0020_by_x0020_Country']
              ? jsonObj['dataroot']['MICs_x0020_List_x0020_by_x0020_Country']
              : []

          while (parsedData.length) {
            let promisesBatch: Array<Promise<any>> = []

            while (promisesBatch.length < 100 && parsedData.length) {
              const item = parsedData.shift()

              let payload = {
                mic: item['MIC'] + '',
                operatingMic: item['OPERATING_x0020_MIC'] + '',
                name: item['NAME-INSTITUTION_x0020_DESCRIPTION'] + '',
                acronym: item['ACRONYM'] ? item['ACRONYM'] + '' : '',
                countryCode:
                  item['ISO_x0020_COUNTRY_x0020_CODE_x0020__x0028_ISO_x0020_3166_x0029_'] + '',
                website: item['WEBSITE'] ? item['WEBSITE'] + '' : ''
              }
              Object.keys(payload).forEach(key => {
                if (key in payload && (payload as any)[key].length === 0) {
                  delete (payload as any)[key]
                }
              })

              let promise = StockMarket.query(trx).insert(payload)

              promisesBatch.push(promise)
            }

            await Promise.all(promisesBatch)
          }

          resolve()
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  return {
    importFromFile
  }
}
