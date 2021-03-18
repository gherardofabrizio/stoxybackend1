import { NextFunction, Request, Response, Application } from 'express'
import { transaction } from 'objection'

import serializeTicker from '../serialization/Ticker'
import serializeTickerPriceInfo from '../serialization/TickerPriceInfo'

// Types imports
import { ExpressRunnerModule } from '@radx/radx-backend-express'
import { KnexModule } from '@radx/radx-backend-knex'
import { DocsModule } from '@radx/radx-backend-swagger-docs'
import { AuthModule } from '@radx/radx-backend-auth'
import TickersController from '_app/controllers/TickersController'
import TickerPricesController from '_app/controllers/TickerPricesController'
import { StoxyModelModule, ITicker } from '_app/model/stoxy'

export interface TickersRouterConfig {}

export default function tickersRouter(
  runner: ExpressRunnerModule,
  database: KnexModule,
  docs: DocsModule,
  auth: AuthModule,
  stoxyModel: StoxyModelModule,
  tickersController: TickersController,
  tickerPricesController: TickerPricesController,
  config: TickersRouterConfig
) {
  const { authenticate, requireAuthentication } = auth.middleware

  // Documentation
  docs.composeWithDirectory(__dirname + '/docs')

  // Routes
  async function getTickersListRoute(req: Request, res: Response, next: NextFunction) {
    try {
      const { knex } = database

      const searchQuery = (req.query.searchQuery as string) || ''

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

  async function getPriceForTickersRoute(req: Request, res: Response, next: NextFunction) {
    try {
      const tickerIds = Array.isArray(req.query.tickerIds)
        ? (req.query.tickerIds as Array<string>)
        : req.query.tickerIds
        ? (req.query.tickerIds as string).split(',')
        : []

      const list = await tickerPricesController.getPriceForTickers(tickerIds)

      res.send({
        _type: 'TickerPriceInfoList',
        data: list.map(info => serializeTickerPriceInfo(info))
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

  tickers.get('/prices', requireAuthentication(), getPriceForTickersRoute)

  runner.installRoutes(async (app: Application) => {
    app.use('/api/tickers', tickers)
  })

  return {}
}
