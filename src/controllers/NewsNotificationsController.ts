import moment from 'moment'

import NewsSourcesController from './NewsSourcesController'

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
  private newsSourcesController: NewsSourcesController

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
    this.newsSourcesController = new NewsSourcesController(runner, database, stoxyModel)
  }

  async getCurrentUserTopics(userId: number, transaction?: Transaction): Promise<Array<string>> {
    const { UserNotificationTopic } = this.stoxyModel

    // Get current topics list for user
    const result = await UserNotificationTopic.query(transaction).where({
      userId
    })
    const topics = result.map(notificationTopic => notificationTopic.topic!)

    return topics
  }

  async subscribeUserToTickerNotifications(
    profileId: number,
    tickerSymbol: string,
    trx?: Transaction
  ) {
    const { knex } = this.database

    const userNewsSources = await this.newsSourcesController.getNewsSourcesListForProfile(
      profileId,
      trx
    )

    await Promise.all(
      userNewsSources.data.map(async userNewsSource => {
        const topic = this.topicForTickerAndNewsSource(tickerSymbol, userNewsSource.newsSourceId!)

        await Promise.all([
          this.fcm.subscribeUserToTopic(profileId, topic),
          (async () => {
            const rawQuery =
              knex('users_notification_topics')
                .insert({
                  userId: profileId,
                  topic
                })
                .toQuery() + ' ON DUPLICATE KEY UPDATE updatedAt = CURRENT_TIMESTAMP() '
            trx ? await trx.raw(rawQuery) : await knex.raw(rawQuery)
          })()
        ])
      })
    )
  }

  async unsubscribeUserFromTickerNotifications(
    profileId: number,
    tickerSymbol: string,
    trx?: Transaction
  ) {
    const { UserNotificationTopic } = this.stoxyModel

    const userNewsSources = await this.newsSourcesController.getNewsSourcesListForProfile(
      profileId,
      trx
    )

    await Promise.all(
      userNewsSources.data.map(async userNewsSource => {
        const topic = this.topicForTickerAndNewsSource(tickerSymbol, userNewsSource.newsSourceId!)
        await Promise.all([
          this.fcm.unsubscribeUserFromTopic(profileId, topic),
          UserNotificationTopic.query(trx).delete().where({
            userId: profileId,
            topic
          })
        ])
      })
    )
  }

  private topicForTickerAndNewsSource(tickerSymbol: string, newsSourceId: number) {
    return tickerSymbol + '_ns_' + newsSourceId
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
            return this.topicForTickerAndNewsSource(ticker.symbol!, news!.newsSource!.id!)
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
