import moment from 'moment'

import { NextFunction, Request, Response, Application } from 'express'
import { transaction } from 'objection'

import serializeNewsSourcesList from '../serialization/NewsSourcesList'

// Types imports
import { ExpressRunnerModule } from '@radx/radx-backend-express'
import { KnexModule } from '@radx/radx-backend-knex'
import { DocsModule } from '@radx/radx-backend-swagger-docs'
import { AuthModule, AccessRule } from '@radx/radx-backend-auth'
import NewsSourcesController from '_app/controllers/NewsSourcesController'
import { StoxyModelModule, INewsList, INewsSourcesList } from '_app/model/stoxy'

export interface NewsSourcesRouterConfig {}

export default function newsSourcesRouter(
  runner: ExpressRunnerModule,
  database: KnexModule,
  docs: DocsModule,
  auth: AuthModule,
  stoxyModel: StoxyModelModule,
  newsSourcesController: NewsSourcesController,
  config: NewsSourcesRouterConfig
) {
  const { authenticate, requireAuthentication } = auth.middleware

  // Documentation
  docs.composeWithDirectory(__dirname + '/docs')

  // Routes
  async function getDefaultNewsSourcesListRoute(req: Request, res: Response, next: NextFunction) {
    try {
      const { knex } = database

      let list: INewsSourcesList | undefined
      await transaction(knex, async trx => {
        list = await newsSourcesController.getBuiltInNewsSourcesList(trx)
      })

      res.send(serializeNewsSourcesList(list!))
    } catch (error) {
      return next(error)
    }
  }

  // Router
  const news = runner.express.Router()
  news.use(authenticate)
  news.use(runner.express.json())

  news.get('/', requireAuthentication(), getDefaultNewsSourcesListRoute)

  runner.installRoutes(async (app: Application) => {
    app.use('/api/news-sources', news)
  })

  return {}
}
