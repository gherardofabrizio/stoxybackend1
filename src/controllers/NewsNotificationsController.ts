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
import { SubscriptionStatus } from '../model/stoxy/models/SubscriptionInfo'

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
    this.newsSourcesController = new NewsSourcesController(runner, database, stoxyModel, {})
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
    const { News, Profile, WatchlistItem } = this.stoxyModel
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

        while (newsList.length) {
          const news = newsList.pop()
          if (!news!.newsSource) {
            continue
          }

          let lastProcessedProfileId = 0
          const tickerSymbols = news!.tickers!.map(ticker => ticker.symbol!)

          // Get users for news tickers
          let needToProceedProfiles = true
          const profilesLimit = 100
          do {
            const profiles = await Profile.query()
              .select('profiles.*')
              .rightJoin('profile_news_sources', joinBuilder => {
                return joinBuilder.on('profiles.id', '=', 'profile_news_sources.profileId')
              })
              .rightJoin('watchlist', joinBuilder => {
                return joinBuilder.on('profiles.id', '=', 'watchlist.profileId')
              })
              .rightJoin('subscription_info', joinBuilder => {
                return joinBuilder.on('profiles.id', '=', 'subscription_info.profileId')
              })
              .where('profiles.id', '>', lastProcessedProfileId)
              .where('profile_news_sources.newsSourceId', news!.newsSource!.id!)
              .whereIn('watchlist.tickerId', tickerSymbols)
              .where('watchlist.isNotificationsEnabled', 1)
              .where(whereBuilder => {
                return whereBuilder
                  .where('subscription_info.until', '>', new Date())
                  .orWhere(
                    'subscription_info.status',
                    '=',
                    SubscriptionStatus.SubscriptionStatusSubscribed
                  )
              })
              .groupBy('profiles.id')
              .orderBy('profiles.id', 'ASC')
              .limit(profilesLimit + 1)

            if (profiles.length === 0) {
              break
            }
            if (profiles.length > profilesLimit) {
              profiles.pop()
            } else {
              needToProceedProfiles = false
            }

            lastProcessedProfileId = profiles[profiles.length - 1].id!

            await Promise.all(
              profiles.map(async profile => {
                const userTickers = await WatchlistItem.query()
                  .where('profileId', profile.id!)
                  .where('watchlist.isNotificationsEnabled', 1)
                  .whereIn('watchlist.tickerId', tickerSymbols)
                const userTickersSymbols = userTickers.map(ticker => ticker.tickerId)

                const title = userTickersSymbols.join(', ')
                const body = `[${news!.newsSource!.title}] ${news!.title}`

                await this.fcm.sendNotificationToUser(profile.id!, undefined, {
                  body,
                  title,
                  icon: 'ic_notification',
                  data: {
                    type: 'news_notification',
                    newsId: news!.id!.toString(),
                    newsURL: news!.link || null
                  }
                })
              })
            )
          } while (needToProceedProfiles)

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
