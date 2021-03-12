import moment from 'moment'

import { NextFunction, Request, Response, Application } from 'express'
import { transaction } from 'objection'

import serializeNewsList from '../serialization/NewsList'

// Types imports
import { ExpressRunnerModule } from '@radx/radx-backend-express'
import { KnexModule } from '@radx/radx-backend-knex'
import { DocsModule } from '@radx/radx-backend-swagger-docs'
import { AuthModule, AccessRule } from '@radx/radx-backend-auth'
import NewsController from '_app/controllers/NewsController'
import { StoxyModelModule, INewsList } from '_app/model/stoxy'

export interface NewsRouterConfig {}

// Common access rules
const allowForMyself: AccessRule = {
  description: 'Allow for myself',
  priority: 'allow',
  condition: (req: Request) => req.user!.id!.toString() === req.params.profileId
}

export default function newsRouter(
  runner: ExpressRunnerModule,
  database: KnexModule,
  docs: DocsModule,
  auth: AuthModule,
  stoxyModel: StoxyModelModule,
  newsController: NewsController,
  config: NewsRouterConfig
) {
  const { authenticate, requireAuthorization } = auth.middleware

  // TODO
  // // Documentation
  // docs.composeWithDirectory(__dirname + '/docs')

  // Routes
  async function getNewsListRoute(req: Request, res: Response, next: NextFunction) {
    try {
      const { knex } = database

      const profileId = parseInt(req.params.profileId, 10)
      const tickerIds = Array.isArray(req.query.tickerIds)
        ? (req.query.tickerIds as Array<string>)
        : req.query.tickerIds
        ? (req.query.tickerIds as string).split(',')
        : []
      let before: Date | undefined
      if (req.query && req.query.before) {
        before = moment(req.query.before as string).toDate()
      }
      let after: Date | undefined
      if (req.query && req.query.after) {
        after = moment(req.query.after as string).toDate()
      }
      let limit = 100
      if (req.query && req.query.limit) {
        limit = parseInt(req.query.limit as string, 10)
      }

      let newsList: INewsList = { data: [], hasMore: false }
      await transaction(knex, async trx => {
        newsList = await newsController.getNewsListForProfile(
          profileId,
          tickerIds,
          before,
          after,
          limit,
          trx
        )
      })

      res.send(serializeNewsList(newsList))
    } catch (error) {
      return next(error)
    }
  }

  // Router
  const news = runner.express.Router()
  news.use(authenticate)
  news.use(runner.express.json())

  news.get(
    '/:profileId/news',
    requireAuthorization('stoxy.news.list', allowForMyself),
    getNewsListRoute
  )

  runner.installRoutes(async (app: Application) => {
    app.use('/api/profiles', news)
  })

  return {}
}
