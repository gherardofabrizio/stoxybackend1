import moment from 'moment'
import request from 'request'
import xmlParser from 'fast-xml-parser'
import { decode } from 'html-entities'
import { htmlToText } from 'html-to-text'

// Types imports
import { raw, Transaction } from 'objection'
import { ExpressRunnerModule } from '@radx/radx-backend-express'
import { KnexModule } from '@radx/radx-backend-knex'
import { StoxyModelModule, ITicker } from '_app/model/stoxy'

export default class NewsParseController {
  private runner: ExpressRunnerModule
  private database: KnexModule
  private stoxyModel: StoxyModelModule

  private tickerSymbolsSet: Set<string> = new Set()

  constructor(runner: ExpressRunnerModule, database: KnexModule, stoxyModel: StoxyModelModule) {
    this.runner = runner
    this.database = database
    this.stoxyModel = stoxyModel
  }

  async initSearchCache() {
    const { Ticker } = this.stoxyModel

    let needToProceed = true
    let dataRoughSize = 0
    const pageSize = 1000
    let offset = 0
    while (needToProceed) {
      console.log('initSearchCache tickers offset: ', offset)

      let tickers = await Ticker.query().orderBy('symbol', 'ASC').offset(offset).limit(pageSize)
      if (tickers.length === 0) {
        // Tickers not found – immediately breaks cycle
        break
      } else if (tickers.length < pageSize) {
        // Tickers ended – prevent from excess query
        needToProceed = false
      }

      tickers.forEach(ticker => {
        if (ticker.symbol) {
          dataRoughSize += ticker.symbol.length * 2
          this.tickerSymbolsSet.add(ticker.symbol)
        }
      })

      offset += pageSize
    }

    console.log('NewsParseController cache rough size: ', dataRoughSize)
  }

  private async getTickersForText(
    text: string,
    decodeHTML: boolean = false,
    trx?: Transaction
  ): Promise<Set<string>> {
    console.log(' - - - ')

    const associatedTickerSymbols: Set<string> = new Set()

    // Decode HTMl description
    let parsedText = decodeHTML
      ? htmlToText(decode(text), {
          tables: true,
          ignoreHref: true,
          tags: { img: { format: 'skip' } }
        })
      : text

    // Remove quotes
    parsedText = parsedText.replace(/["'”]/g, '')

    // Remove punctuation marks
    parsedText = parsedText.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')

    // Remove line breaks
    parsedText = parsedText.replace(/\n/g, ' ')

    console.log('parsedText: ', parsedText)

    // Split words
    const stringElements = parsedText.split(' ')
    console.log('stringElements: ', stringElements)

    // Parse tickers from text
    stringElements.forEach(element => {
      if (element.length >= 3) {
        // We just can't parse short tickers similar to short words
        if (this.tickerSymbolsSet.has(element)) {
          associatedTickerSymbols.add(element)
        }
      }
    })

    // Search tickers by company name
    // TODO

    console.log('associatedTickerSymbols: ', associatedTickerSymbols)
    console.log(' - - - ')

    return associatedTickerSymbols
  }

  private async parseNewsItem(item: any, trx?: Transaction) {
    const title = item['title']
    const link = item['link']
    let tickerSymbolsFromDescription: Set<string> = new Set()
    let tickerSymbolsFromTitle: Set<string> = new Set()
    let tickerSymbolsFromCategories: Set<string> = new Set()

    // Parse ticker symbols from description
    if (item['description'] && typeof item['description'] === 'string') {
      tickerSymbolsFromDescription = await this.getTickersForText(item['description'], true, trx)
    }

    // Parse ticker symbols from title
    if (item['title'] && typeof item['title'] === 'string') {
      tickerSymbolsFromTitle = await this.getTickersForText(item['title'], false, trx)
    }

    // Parse ticker symbols from categories
    if (item['category'] && Array.isArray(item['category'])) {
      item['category'].forEach((category: string) => {
        if (this.tickerSymbolsSet.has(category)) {
          tickerSymbolsFromCategories.add(category)
        }
      })
    }

    console.log({
      title,
      link,
      tickerSymbolsFromDescription,
      tickerSymbolsFromTitle,
      tickerSymbolsFromCategories
    })
  }

  async parseRSSFeed(feedURL: string, trx?: Transaction) {
    // TODO

    const rssRaw: any = await new Promise<void>(async (resolve, reject) => {
      request.get(
        {
          url: feedURL
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

    let rssObj = xmlParser.parse(rssRaw, {})

    console.log(' * * * ')

    console.log('feedURL: ', feedURL)

    // console.log('rssRaw: ', rssRaw)

    console.log('rssObj: ', rssObj)

    const newsItems =
      rssObj['rss'] && rssObj['rss']['channel'] && rssObj['rss']['channel']['item']
        ? rssObj['rss']['channel']['item']
        : []

    console.log('newsItems: ', newsItems)

    try {
      await Promise.all(newsItems.map((item: any) => this.parseNewsItem(item)))
    } catch (error) {
      console.log('error: ', error)
    }

    console.log(' * * * ')
  }
}
