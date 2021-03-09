import express from 'express'

import expressModule from '@radx/radx-backend-express'
import docsModule from '@radx/radx-backend-swagger-docs'
import knexModule from '@radx/radx-backend-knex'
import authModule, { NoopEmailerModule } from '@radx/radx-backend-auth'

import TickerIdsCache from './helpers/TickerIdsCache'

import stoxyModelModule from './model/stoxy'
import seedDataModule from './model/seedData'
import rootRouteModule from './routes/root'
import profilesRouteModule from './routes/profiles'
import watchlistRouterModule from './routes/watchlist'

import ProfileController from './controllers/ProfileController'
import WatchlistController from './controllers/WatchlistController'

export default function (configPath: string) {
  // Config
  const config = {
    ...require(configPath)
  }

  // Services
  const services = (() => {
    return {}
  })()

  // Core
  const core = (() => {
    const runner = expressModule(express, {
      port: config.port || 3000,
      corsOrigin: config.cors ? config.cors.origin : undefined,
      runErrorLog: config.runErrorLog
    })

    // TODO – move to radx
    runner.app.use(express.json({ limit: '10mb' }))

    const docs = docsModule(runner)
    const knex = knexModule(runner, {
      knexConfig: config.database
    })

    let authConfig = {
      masterToken: {
        secret: config.masterTokenSecret
      }
    }

    authConfig = config.sessionExpirationTime
      ? Object.assign(authConfig, { sessionExpirationTime: config.sessionExpirationTime })
      : authConfig

    const auth = authModule(
      runner,
      knex,
      new NoopEmailerModule(),
      {
        enableOldPasswordConfirmation: true,
        appName: config.common.appName,
        serverUrl: config.common.serverUrl,
        masterToken: {
          secret: config.masterTokenSecret
        }
      },
      docs
    )

    return {
      runner,
      docs,
      knex,
      auth
    }
  })()

  // Models
  const models = (() => {
    const stoxy = stoxyModelModule(core.runner, core.knex, core.auth, {})

    const seedData = seedDataModule(core.runner, core.knex, core.auth, stoxy, {})

    return {
      stoxy,
      seedData
    }
  })()

  // Helpers
  const helpers = (() => {
    const tickerIdsCache = new TickerIdsCache(core.runner, models.stoxy)

    return {
      tickerIdsCache
    }
  })()

  // Controllers
  const controllers = (() => {
    const profile = new ProfileController(core.runner, core.knex, models.stoxy)

    const watchlist = new WatchlistController(
      core.runner,
      core.knex,
      models.stoxy,
      helpers.tickerIdsCache
    )

    return { profile, watchlist }
  })()

  // Routes
  const routes = (() => {
    const root = rootRouteModule(core.runner, core.docs, {})

    const profiles = profilesRouteModule(
      core.runner,
      core.knex,
      core.docs,
      core.auth,
      models.stoxy,
      controllers.profile,
      {}
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

    return {
      root,
      profiles,
      watchlist
    }
  })()

  core.runner.afterStart(async () => {
    console.log('Stoxy application started and listening at port:', core.runner.port)
  })

  return {
    services,
    core,
    models,
    helpers,
    controllers,
    routes,

    run: () => core.runner.run()
  }
}
