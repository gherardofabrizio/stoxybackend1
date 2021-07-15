import { NextFunction, Request, Response, Application } from 'express'
import { transaction, Transaction } from 'objection'

import serializeWatchlist from '../serialization/Watchlist'
import serializeWatchlistItem from '../serialization/WatchlistItem'

// Types imports
// import { ProfileModel } from '_app/model/stoxy/models/Profile'
import { ExpressRunnerModule } from '@radx/radx-backend-express'
import { KnexModule } from '@radx/radx-backend-knex'
import { DocsModule } from '@radx/radx-backend-swagger-docs'
import { AuthModule, AccessRule } from '@radx/radx-backend-auth'
import WatchlistController from '_app/controllers/WatchlistController'
import { StoxyModelModule, IProfile, IWatchlist, IWatchlistItem } from '_app/model/stoxy'

export interface WatchlistRouterConfig {}

// Common access rules
const allowForMyself: AccessRule = {
  description: 'Allow for myself',
  priority: 'allow',
  condition: (req: Request) => req.user!.id!.toString() === req.params.profileId
}

export default function watchlistRouter(
  runner: ExpressRunnerModule,
  database: KnexModule,
  docs: DocsModule,
  auth: AuthModule,
  stoxyModel: StoxyModelModule,
  watchlistController: WatchlistController,
  config: WatchlistRouterConfig
) {
  const { errors, validate } = runner
  const { Profile } = stoxyModel
  const { accessRules } = auth
  const { authenticate, requireAuthorization, requireAuthentication } = auth.middleware

  // Documentation
  docs.composeWithDirectory(__dirname + '/docs')
  docs.composeWithDirectory(__dirname + '/schemas', '/components/schemas')

  // Routes
  async function readWatchlistRoute(req: Request, res: Response, next: NextFunction) {
    try {
      const { knex } = database

      const profileId = parseInt(req.params.profileId, 10)

      let watchlist: IWatchlist

      await transaction(knex, async trx => {
        watchlist = await watchlistController.getWatchlistForProfile(profileId, trx)
      })

      res.send(serializeWatchlist(watchlist!))
    } catch (error) {
      return next(error)
    }
  }

  async function addItemToWatchlistRoute(req: Request, res: Response, next: NextFunction) {
    try {
      const { knex } = database

      const profileId = parseInt(req.params.profileId, 10)
      const tickerSymbol = req.params.tickerSymbol ? req.params.tickerSymbol.toUpperCase() : ''
      const isNotificationsEnabled = req.body.isNotificationsEnabled === true ? true : false

      let item: IWatchlistItem | undefined

      await transaction(knex, async trx => {
        await watchlistController.upsertTickerForProfile(
          tickerSymbol,
          profileId,
          { isNotificationsEnabled },
          trx
        )
      })

      await transaction(knex, async trx => {
        item = await watchlistController.getWatchListItem(tickerSymbol, profileId, trx)
      })

      res.send(serializeWatchlistItem(item!))
    } catch (error) {
      return next(error)
    }
  }

  async function removeItemFromWatchlistRoute(req: Request, res: Response, next: NextFunction) {
    try {
      const { knex } = database

      const profileId = parseInt(req.params.profileId, 10)
      const tickerSymbol = req.params.tickerSymbol ? req.params.tickerSymbol.toUpperCase() : ''

      await transaction(knex, async trx => {
        await watchlistController.removeTickerForProfile(tickerSymbol, profileId, trx)
      })

      res.sendStatus(204)
    } catch (error) {
      return next(error)
    }
  }

  async function batchWatchlistUpdateRoute(req: Request, res: Response, next: NextFunction) {
    try {
      const { knex } = database

      const profileId = parseInt(req.params.profileId, 10)
      const tickersUpsert = req.body

      let watchlist: IWatchlist

      await transaction(knex, async trx => {
        watchlist = await watchlistController.batchUpdateWatchlistForProfile(
          profileId,
          tickersUpsert,
          trx
        )
      })

      res.send(serializeWatchlist(watchlist!))
    } catch (error) {
      return next(error)
    }
  }

  // Router
  const watchlist = runner.express.Router()
  watchlist.use(authenticate)
  watchlist.use(runner.express.json())

  watchlist.get(
    '/:profileId/watchlist',
    requireAuthorization('stoxy.watchlist.list', allowForMyself),
    readWatchlistRoute
  )

  watchlist.post(
    '/:profileId/watchlist/:tickerSymbol',
    requireAuthorization('stoxy.watchlist.edit', allowForMyself),
    validate.bodyWithSchemaMiddlewareLazy(() => {
      const schema = require('./schemas/WatchlistItemUpsert.json')
      return schema
    }),
    addItemToWatchlistRoute
  )

  watchlist.put(
    '/:profileId/watchlist',
    requireAuthorization('stoxy.watchlist.edit'),
    validate.bodyWithSchemaMiddlewareLazy(() => {
      const schema = require('./schemas/WatchlistBatchUpdate.json')
      return schema
    }),
    batchWatchlistUpdateRoute
  )

  watchlist.delete(
    '/:profileId/watchlist/:tickerSymbol',
    requireAuthorization('stoxy.watchlist.edit'),
    removeItemFromWatchlistRoute
  )

  runner.installRoutes(async (app: Application) => {
    app.use('/api/profiles', watchlist)
  })

  return {}
}
