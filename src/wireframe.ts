import express from 'express'

import expressModule from '@radx/radx-backend-express'
import docsModule from '@radx/radx-backend-swagger-docs'
import knexModule from '@radx/radx-backend-knex'
import authModule, { NoopEmailerModule } from '@radx/radx-backend-auth'

import fcmModule from '../dependencies/radx-backend-fcm'

import stoxyModelModule from './model/stoxy'
import seedDataModule from './model/seedData'
import rootRouteModule from './routes/root'
import profilesRouteModule from './routes/profiles'
import watchlistRouterModule from './routes/watchlist'
import tickersRouterModule from './routes/tickers'
import newsRouterModule from './routes/news'
import newsSourcesRouter from './routes/newsSources'
import subscriptionRouter from './routes/subscription'

import ProfileController from './controllers/ProfileController'
import WatchlistController from './controllers/WatchlistController'
import TickersController from './controllers/TickersController'
import NewsParseController from './controllers/NewsParseController'
import NewsController from './controllers/NewsController'
import NewsSourcesController from './controllers/NewsSourcesController'
import TickerPriceController from './controllers/TickerPricesController'
import NewsNotificationsController from './controllers/NewsNotificationsController'
import SubscriptionController from './controllers/SubscriptionController'

import schedulerModule from './scheduler'

import KeyValueCache from './services/KeyValueCache'

export default function (configPath: string) {
  // Config
  const config = {
    ...require(configPath)
  }

  // Services
  const services = (() => {
    const keyValueCache = new KeyValueCache({ redis: config.redis })

    return {
      keyValueCache
    }
  })()

  // Core
  const core = (() => {
    const runner = expressModule(express, {
      port: config.port || 3000,
      corsOrigin: config.cors ? config.cors.origin : undefined,
      runErrorLog: config.runErrorLog
    })

    runner.app.use('/static', runner.express.static(__dirname + '/static'))
    // TODO – move to radx
    runner.app.use(express.json({ limit: '10mb' }))

    const docs = docsModule(runner)
    const knex = knexModule(runner, {
      knexConfig: config.database
    })

    let authConfig = {
      enableOldPasswordConfirmation: true,
      appName: config.common.appName,
      serverUrl: config.common.serverUrl,
      masterToken: {
        secret: config.masterTokenSecret
      }
    }

    authConfig = config.sessionExpirationTime
      ? Object.assign(authConfig, { sessionExpirationTime: config.sessionExpirationTime })
      : authConfig

    const auth = authModule(runner, knex, new NoopEmailerModule(), authConfig, docs)

    const fcm = fcmModule(
      runner,
      knex,
      auth,
      {
        credentialsPath: config.firebase.credentialsPath,
        topicPrefix: config.fcm.topicPrefix
      },
      docs
    )

    return {
      runner,
      docs,
      knex,
      auth,
      fcm
    }
  })()

  // Models
  const models = (() => {
    const stoxy = stoxyModelModule(core.runner, core.knex, core.auth, {})

    const seedData = seedDataModule(core.runner, core.knex, core.auth, stoxy, {
      finnhub: config.finnhub
    })

    return {
      stoxy,
      seedData
    }
  })()

  // Helpers
  const helpers = (() => {})()

  // Controllers
  const controllers = (() => {
    const newsNotifications = new NewsNotificationsController(
      core.runner,
      core.knex,
      core.fcm,
      models.stoxy
    )

    const profile = new ProfileController(core.runner, core.knex, models.stoxy)

    const watchlist = new WatchlistController(
      core.runner,
      core.knex,
      models.stoxy,
      newsNotifications
    )

    const tickers = new TickersController(core.runner, core.knex, models.stoxy)

    const newsParse = new NewsParseController(core.runner, core.knex, models.stoxy)

    const news = new NewsController(core.runner, core.knex, models.stoxy, newsNotifications)

    const newsSources = new NewsSourcesController(core.runner, core.knex, models.stoxy, {})

    const tickerPrices = new TickerPriceController(
      core.runner,
      core.knex,
      models.stoxy,
      services.keyValueCache,
      {
        tickerPriceCacheTime: 10,
        finnhub: config.finnhub
      }
    )

    const subscription = new SubscriptionController(core.runner, core.knex, models.stoxy)

    return {
      profile,
      subscription,
      tickers,
      watchlist,
      newsParse,
      news,
      newsSources,
      tickerPrices,
      newsNotifications
    }
  })()

  // Routes
  const routes = (() => {
    const root = rootRouteModule(core.runner, core.docs, {})

    const profiles = profilesRouteModule(
      core.runner,
      core.knex,
      core.docs,
      core.auth,
      core.fcm,
      models.stoxy,
      controllers.profile,
      controllers.newsSources,
      controllers.newsNotifications,
      {
        apiBaseUrl: config.common.apiBaseUrl
      }
    )

    const watchlist = watchlistRouterModule(
      core.runner,
      core.knex,
      core.docs,
      core.auth,
      models.stoxy,
      controllers.watchlist,
      {}
    )

    const tickers = tickersRouterModule(
      core.runner,
      core.knex,
      core.docs,
      core.auth,
      models.stoxy,
      controllers.tickers,
      controllers.tickerPrices,
      {}
    )

    const news = newsRouterModule(
      core.runner,
      core.knex,
      core.docs,
      core.auth,
      models.stoxy,
      controllers.news,
      {}
    )

    const newsSources = newsSourcesRouter(
      core.runner,
      core.knex,
      core.docs,
      core.auth,
      models.stoxy,
      controllers.newsSources,
      {}
    )

    const subscription = subscriptionRouter(
      core.runner,
      core.knex,
      core.docs,
      core.auth,
      models.stoxy,
      controllers.subscription
    )

    return {
      root,
      profiles,
      subscription,
      tickers,
      watchlist,
      news,
      newsSources
    }
  })()

  // Scheduler
  const scheduler = schedulerModule(
    core.knex,
    models.stoxy,
    controllers.newsParse,
    controllers.newsNotifications,
    {}
  )

  core.runner.afterStart(async () => {
    console.log('Stoxy application started and listening at port:', core.runner.port)

    await controllers.newsParse.initSearchCache()

    await scheduler.start()
  })

  return {
    services,
    core,
    models,
    helpers,
    controllers,
    routes,
    scheduler,

    run: () => core.runner.run()
  }
}
