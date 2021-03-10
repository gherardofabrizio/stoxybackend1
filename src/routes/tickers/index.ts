import { NextFunction, Request, Response, Application } from 'express'
import { transaction } from 'objection'

import serializeTicker from '../serialization/Ticker'

// Types imports
import { ExpressRunnerModule } from '@radx/radx-backend-express'
import { KnexModule } from '@radx/radx-backend-knex'
import { DocsModule } from '@radx/radx-backend-swagger-docs'
import { AuthModule } from '@radx/radx-backend-auth'
import TickersController from '_app/controllers/TickersController'
import { StoxyModelModule, ITicker } from '_app/model/stoxy'

export interface WatchlistRouterConfig {}

export default function tickersRouter(
  runner: ExpressRunnerModule,
  database: KnexModule,
  docs: DocsModule,
  auth: AuthModule,
  stoxyModel: StoxyModelModule,
  tickersController: TickersController,
  config: WatchlistRouterConfig
) {
  const { authenticate, requireAuthentication } = auth.middleware

  // TODO
  // // Documentation
  // docs.composeWithDirectory(__dirname + '/docs')
  // docs.composeWithDirectory(__dirname + '/schemas', '/components/schemas')

  // Routes
  async function getTickersListRoute(req: Request, res: Response, next: NextFunction) {
    try {
      const { knex } = database

      const searchQuery = req.query.searchQuery as string
      if (!searchQuery || searchQuery.length < 2) {
        res.send({
          _type: 'TickersList',
          data: []
        })
      }

      let tickers: Array<ITicker> = []
      await transaction(knex, async trx => {
        tickers = await tickersController.searchTickersByText(searchQuery, trx)
      })

      res.send({
        _type: 'TickersList',
        data: tickers.map(ticker => serializeTicker(ticker))
      })
    } catch (error) {
      return next(error)
    }
  }

  // Router
  const tickers = runner.express.Router()
  tickers.use(authenticate)
  tickers.use(runner.express.json())

  tickers.get('/', requireAuthentication(), getTickersListRoute)

  runner.installRoutes(async (app: Application) => {
    app.use('/api/tickers', tickers)
  })

  return {}
}
