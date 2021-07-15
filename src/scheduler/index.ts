import schedule, { Job } from 'node-schedule'
import moment from 'moment'
import { transaction, Transaction } from 'objection'

// Type imports
import { KnexModule } from '@radx/radx-backend-knex'
import { StoxyModelModule } from '_app/model/stoxy'
import NewsParseController from '../controllers/NewsParseController'
import NewsNotificationsController from '../controllers/NewsNotificationsController'

export interface SchedulerModuleConfig {}

export default function schedulerModule(
  dataBase: KnexModule,
  model: StoxyModelModule,
  newsParseController: NewsParseController,
  newsNotificationsController: NewsNotificationsController,
  config: SchedulerModuleConfig
) {
  let rssFeedObserver: Job | undefined
  let newsObserver: Job | undefined

  const { NewsSource } = model
  const { knex } = dataBase

  // Observe RSS feeds every 10 seconds
  function startObservingRSSFeeds() {
    rssFeedObserver = schedule.scheduleJob('*/10 * * * * *', async () => {
      console.log('ObservingRSSFeeds')
      await transaction(knex, async trx => {
        // Get news for built in news source
        await newsParseController.getNewsForOldestUpdatedNewsSource(true, trx)

        // Proceed custom news source at separate "queue"
        await newsParseController.getNewsForOldestUpdatedNewsSource(false, trx)
      })
    })
  }

  // Observe RSS feeds every 10 seconds
  function startObservingNews() {
    newsObserver = schedule.scheduleJob('*/10 * * * * *', async () => {
      console.log('ObservingNews')
      await newsNotificationsController.sendNewsNotifications()
    })
  }

  async function start() {
    startObservingRSSFeeds()
    startObservingNews()
  }

  return {
    start
  }
}
