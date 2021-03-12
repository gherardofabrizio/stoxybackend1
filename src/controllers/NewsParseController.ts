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

  private companyTitleSearchFilterWords = [
    '-A',
    'ACC',
    'ADR',
    'AG',
    '-B',
    '-C',
    '-CL',
    'CO-A',
    'CO',
    'COO',
    'CEO',
    'CORP',
    'INC',
    'INC-A',
    'INC-CL',
    'ETF',
    'EUR',
    'EUR-H',
    'EUR-HA',
    'EUR-HD',
    'EST-A',
    'L-A',
    'LTD-A',
    'LTD-CL',
    'LTD-CLASS',
    'LTD-ADR',
    'LTD',
    'NV',
    'N.V.',
    'P-A',
    'PLC',
    'PLC-',
    'PLC-A',
    'PLC-B',
    'PLC-ADR',
    'PLC-SP',
    'SA',
    'S.A.',
    'SHS'
  ]

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

  private removeSpecialCharactersFromText(text: string) {
    let parsedText = text

    parsedText = parsedText.replace(/["'”]/g, '')

    // Remove punctuation marks
    parsedText = parsedText.replace(/[.,\/#!$%\^&\*|;:{}=\-_`~()]/g, ' ')

    // Remove line breaks
    parsedText = parsedText.replace(/\n/g, ' ')

    return parsedText
  }

  private async getTickersForText(
    text: string,
    decodeHTML: boolean = false,
    trx?: Transaction
  ): Promise<Set<string>> {
    const { Ticker } = this.stoxyModel
    const { knex } = this.database

    const associatedTickerSymbols: Set<string> = new Set()

    // Decode HTMl description
    let parsedText = decodeHTML
      ? htmlToText(decode(text), {
          tables: true,
          ignoreHref: true,
          tags: { img: { format: 'skip' } }
        })
      : text

    // Remove special characters
    parsedText = this.removeSpecialCharactersFromText(parsedText)

    // Split words
    const stringElements = parsedText.split(' ')

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
    const searchQuery = stringElements
      .filter(element => {
        if (element.length >= 3) {
          return true
        }
      })
      .join(' ')
    if (searchQuery.length) {
      const textWithoutDuplicateSpaces = stringElements
        .filter(element => element.length > 1)
        .join(' ')
        .toUpperCase()

      const tickerByWordsResults = await Ticker.query(trx)
        .select(
          knex.raw(
            'tickers.*, MATCH(description) AGAINST(:searchQuery IN NATURAL LANGUAGE MODE) AS relevance',
            {
              searchQuery
            }
          )
        )
        .where(
          knex.raw('MATCH(description) AGAINST(:searchQuery IN NATURAL LANGUAGE MODE)', {
            searchQuery
          })
        )
        .orderBy('relevance', 'DESC')
        .limit(32)

      tickerByWordsResults.forEach(ticker => {
        const tickerNameWithoutSpecialWords = this.removeSpecialCharactersFromText(
          ticker.description!
        )
          .toUpperCase()
          .split(' ')
          .filter(element => {
            return element.length > 1 && !this.companyTitleSearchFilterWords.includes(element)
          })
          .join(' ')

        if (textWithoutDuplicateSpaces.indexOf(tickerNameWithoutSpecialWords) >= 0) {
          associatedTickerSymbols.add(ticker.symbol!)
        }
      })
    }

    return associatedTickerSymbols
  }

  private async parseNewsItem(item: any, trx?: Transaction) {
    const { knex } = this.database
    const { News } = this.stoxyModel

    const title = item['title']
    const description = item['description']
    const link = item['link']
    let tickerSymbolsFromDescription: Set<string> = new Set()
    let tickerSymbolsFromTitle: Set<string> = new Set()
    let tickerSymbolsFromCategories: Set<string> = new Set()

    // Parse ticker symbols from description
    if (description && typeof description) {
      tickerSymbolsFromDescription = await this.getTickersForText(item['description'], true, trx)
    }

    // Parse ticker symbols from title
    if (title && typeof title === 'string') {
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
      description,
      link,
      tickerSymbolsFromDescription,
      tickerSymbolsFromTitle,
      tickerSymbolsFromCategories
    })

    const tickerSymbols: Set<string> = new Set([
      ...tickerSymbolsFromDescription,
      ...tickerSymbolsFromTitle,
      ...tickerSymbolsFromCategories
    ])

    // No tickers found for news
    if (tickerSymbols.size === 0) {
      return
    }

    // Check for possible duplicate
    const checkNews = await News.query(trx)
      .where({
        title
      })
      .andWhere('createdAt', '>', moment().subtract(1, 'month').toDate())
      .first()
    if (checkNews) {
      return
    }

    const addedNews = await News.query(trx).insert({
      title,
      description: decode(description),
      link
    })

    // Add tickers to news
    await Promise.all(
      Array.from(tickerSymbols).map((tickerSymbol: string) =>
        (trx || knex)
          .insert({
            newsId: addedNews.id,
            tickerId: tickerSymbol
          })
          .into('news_tickers')
      )
    )
  }

  async parseRSSFeed(feedURL: string, trx?: Transaction) {
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
