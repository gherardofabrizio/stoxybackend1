import moment from 'moment'

// Types imports
import { transaction, Transaction } from 'objection'
import { ExpressRunnerModule } from '@radx/radx-backend-express'
import { KnexModule } from '@radx/radx-backend-knex'
import { StoxyModelModule, ITicker, INewsSource } from '_app/model/stoxy'
import { TickerId } from '_app/model/stoxy/models/Ticker'
import { INewsList } from '_app/model/stoxy'
import { FCMModule, FCMMessagePayload, FCMSendToUsersResult } from '_dependencies/radx-backend-fcm'

export default class NewsNotificationsController {
  private runner: ExpressRunnerModule
  private database: KnexModule
  private fcm: FCMModule
  private stoxyModel: StoxyModelModule
  private isProcessing: boolean = false

  constructor(
    runner: ExpressRunnerModule,
    database: KnexModule,
    fcm: FCMModule,
    stoxyModel: StoxyModelModule
  ) {
    this.runner = runner
    this.database = database
    this.stoxyModel = stoxyModel
    this.fcm = fcm
  }

  async subscribeUserOnTicker() {
    // TODO
  }

  async unsubscribeUserOnTicker() {
    // TODO
  }

  private topicForTickerAndNewsSource(ticker: ITicker, newsSource: INewsSource) {
    return ticker.symbol! + '_ns_' + newsSource!.id
  }

  async sendNewsNotifications() {
    console.log('run sendNewsNotifications')
    if (this.isProcessing) {
      console.log('Do not run duplicate task')
      return
    }

    const { knex } = this.database
    const { News } = this.stoxyModel
    const limit = 100
    let needToProceed = true
    this.isProcessing = true

    try {
      while (needToProceed) {
        // Select oldest unprocessed news
        const newsList = await News.query()
          .where({ notificationsWasSent: false })
          .orderBy('publicationDate', 'ASC')
          .withGraphFetched('[newsSource,tickers]')
          .limit(limit + 1)

        if (newsList.length > limit) {
          newsList.pop()
        } else {
          needToProceed = false
        }

        const fcmRequestRateDelay = (delay: number) =>
          new Promise<void>((resolve, reject) => {
            setTimeout(function () {
              resolve()
            }, delay)
          })

        while (newsList.length) {
          const news = newsList.pop()
          if (!news!.newsSource) {
            continue
          }

          const title = news!.title
          const body = news!.tickers
            ?.map(ticker => {
              return ticker.symbol
            })
            .join(', ')
          console.log('Notification title: ', title)
          console.log('Notification body: ', body)
          // TODO - filter topics with subscribed users
          const topics = news!.tickers!.map(ticker => {
            return this.topicForTickerAndNewsSource(ticker, news!.newsSource!)
          })
          console.log('topics: ', topics)

          if (topics.length) {
            await this.fcm.sendNotificationToTopic(topics!.length == 1 ? topics[0] : topics, {
              body,
              title
            })
          }

          if (newsList.length && topics.length) {
            // Set delay from 1 to 5 seconds per notification
            // (to avoid getting TOPICS_MESSAGE_RATE_EXCEEDED)
            // TODO - add cache check for possible TOPICS_MESSAGE_RATE_EXCEEDED error
            const delay = Math.min(5, topics.length) * 1000
            console.log('delay for: ', delay)
            await fcmRequestRateDelay(delay)
            console.log('after delay for: ', delay)
          }

          // Mark News as processed
          await News.query()
            .update({
              notificationsWasSent: true
            })
            .where({
              id: news!.id!
            })
        }
      }
    } finally {
      this.isProcessing = false
    }
  }
}
