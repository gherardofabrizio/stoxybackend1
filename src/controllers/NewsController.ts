import moment from 'moment'

// Types imports
import { raw, Transaction } from 'objection'
import { ExpressRunnerModule } from '@radx/radx-backend-express'
import { KnexModule } from '@radx/radx-backend-knex'
import { StoxyModelModule, ITicker } from '_app/model/stoxy'
import { TickerId } from '_app/model/stoxy/models/Ticker'
import WatchlistController from './WatchlistController'
import { INewsList } from '_app/model/stoxy'

export default class NewsController {
  private runner: ExpressRunnerModule
  private database: KnexModule
  private stoxyModel: StoxyModelModule
  private watchlistController: WatchlistController

  constructor(runner: ExpressRunnerModule, database: KnexModule, stoxyModel: StoxyModelModule) {
    this.runner = runner
    this.database = database
    this.stoxyModel = stoxyModel

    this.watchlistController = new WatchlistController(runner, database, stoxyModel)
  }

  async getNewsListForProfile(
    profileId: number,
    tickerIds: Array<TickerId>,
    publishedBeforeDate: Date | undefined,
    publishedAfterDate: Date | undefined,
    limit?: number,
    trx?: Transaction
  ): Promise<INewsList> {
    const { News, Ticker } = this.stoxyModel

    const usersWatchlist = await this.watchlistController.getWatchlistForProfile(profileId, trx)
    const userWatchedTickerSymbols = usersWatchlist.data.map(item => {
      return item.ticker!.symbol!
    })

    if (!limit) {
      limit = 100
    }

    // Get news list
    let hasMore = false
    const newsList = await News.query(trx)
      .joinRaw(' LEFT JOIN `news_tickers` ON `news`.`id` = `news_tickers`.`newsId` ')
      .whereIn('news_tickers.tickerId', tickerIds.length ? tickerIds : userWatchedTickerSymbols)
      .andWhere(whereBuilder => {
        if (publishedBeforeDate !== undefined) {
          return whereBuilder.where('news.publicationDate', '<', publishedBeforeDate)
        }
      })
      .andWhere(whereBuilder => {
        if (publishedAfterDate !== undefined) {
          return whereBuilder.where('news.publicationDate', '>', publishedAfterDate)
        }
      })
      .limit(limit + 1)
      .orderBy('publicationDate', 'DESC')
      .withGraphFetched('tickers.stockMarket')

    if (newsList.length > limit) {
      newsList.pop()
      hasMore = true
    }

    // Filter user tickers
    newsList.forEach(newsItem => {
      if (newsItem.tickers) {
        newsItem.tickers = newsItem.tickers?.filter(ticker => {
          return userWatchedTickerSymbols.includes(ticker.symbol!)
        })
      }
    })

    return {
      hasMore,
      data: newsList
    }
  }
}
