import { NextFunction, Request, Response, Application } from 'express'
import { transaction, Transaction } from 'objection'

import serializeWatchList from './serialization/Watchlist'

// Types imports
// import { ProfileModel } from '_app/model/stoxy/models/Profile'
import { ExpressRunnerModule } from '@radx/radx-backend-express'
import { KnexModule } from '@radx/radx-backend-knex'
import { DocsModule } from '@radx/radx-backend-swagger-docs'
import { AuthModule, IUser } from '@radx/radx-backend-auth'
import WatchlistController from '_app/controllers/WatchlistController'
import { StoxyModelModule, IProfile, IWatchlist } from '_app/model/stoxy'

export interface WatchlistRouterConfig {}

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

      res.send(serializeWatchList(watchlist!))
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
    requireAuthorization('stoxy.profiles.list', {
      description: 'Allow for myself',
      priority: 'allow',
      condition: (req: Request) => req.user!.id!.toString() === req.params.profileId
    }),
    readWatchlistRoute
  )

  runner.installRoutes(async (app: Application) => {
    app.use('/api/profiles', watchlist)
  })

  return {}
}
