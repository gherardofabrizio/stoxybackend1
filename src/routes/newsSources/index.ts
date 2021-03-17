import moment from 'moment'

import { NextFunction, Request, Response, Application } from 'express'
import { transaction } from 'objection'

import serializeNewsSourcesList from '../serialization/NewsSourcesList'
import serializeNewsSource from '../serialization/NewsSource'

import allowForMyself from '../accessRules/allowForMyself'

// Types imports
import { ExpressRunnerModule } from '@radx/radx-backend-express'
import { KnexModule } from '@radx/radx-backend-knex'
import { DocsModule } from '@radx/radx-backend-swagger-docs'
import { AuthModule, AccessRule } from '@radx/radx-backend-auth'
import NewsSourcesController from '_app/controllers/NewsSourcesController'
import { StoxyModelModule, INewsList, INewsSourcesList, INewsSource } from '_app/model/stoxy'

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
  const { errors, validate } = runner
  const { authenticate, requireAuthentication, requireAuthorization } = auth.middleware

  // Documentation
  docs.composeWithDirectory(__dirname + '/docs')
  docs.composeWithDirectory(__dirname + '/schemas', '/components/schemas')

  // Routes
  async function getDefaultNewsSourcesListRoute(req: Request, res: Response, next: NextFunction) {
    try {
      const { knex } = database

      const searchQuery = (req.query.searchQuery as string) || ''

      let list: INewsSourcesList | undefined
      await transaction(knex, async trx => {
        if (searchQuery.length) {
          list = await newsSourcesController.getNewsSourcesBySearchQuery(searchQuery, trx)
        } else {
          list = await newsSourcesController.getBuiltInNewsSourcesList(trx)
        }
      })

      res.send(serializeNewsSourcesList(list!))
    } catch (error) {
      return next(error)
    }
  }

  async function getNewsSourcesListForProfileRoute(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { knex } = database

      const profileId = parseInt(req.params.profileId, 10)

      let list: INewsSourcesList | undefined
      await transaction(knex, async trx => {
        list = await newsSourcesController.getNewsSourcesListForProfile(profileId, trx)
      })

      res.send(serializeNewsSourcesList(list!))
    } catch (error) {
      return next(error)
    }
  }

  async function addNewsSourceToListForProfileRoute(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { knex } = database

      const profileId = parseInt(req.params.profileId, 10)

      const newsSourceId = parseInt(req.params.newsSourceId, 10)

      let list: INewsSourcesList | undefined
      await transaction(knex, async trx => {
        await newsSourcesController.addNewsSourceToListForProfile(newsSourceId, profileId, trx)

        list = await newsSourcesController.getNewsSourcesListForProfile(profileId, trx)
      })

      res.send(serializeNewsSourcesList(list!))
    } catch (error) {
      return next(error)
    }
  }

  async function removeNewsSourceFromListForProfileRoute(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { knex } = database

      const profileId = parseInt(req.params.profileId, 10)

      const newsSourceId = parseInt(req.params.newsSourceId, 10)

      let list: INewsSourcesList | undefined
      await transaction(knex, async trx => {
        await newsSourcesController.removeNewsSourceFromListForProfile(newsSourceId, profileId, trx)

        list = await newsSourcesController.getNewsSourcesListForProfile(profileId, trx)
      })

      res.send(serializeNewsSourcesList(list!))
    } catch (error) {
      return next(error)
    }
  }

  async function addCustomNewsSourceRoute(req: Request, res: Response, next: NextFunction) {
    try {
      const { knex } = database

      const siteURL = req.body.siteURL

      let newsSource: INewsSource | undefined
      await transaction(knex, async trx => {
        newsSource = await newsSourcesController.addNewsSourceBySiteURL(siteURL, trx)
      })

      res.send(serializeNewsSource(newsSource!))
    } catch (error) {
      return next(error)
    }
  }

  // Router
  const news = runner.express.Router()
  news.use(authenticate)
  news.use(runner.express.json())

  news.get('/news-sources', requireAuthentication(), getDefaultNewsSourcesListRoute)

  news.get(
    '/profiles/:profileId/news-sources',
    requireAuthorization('stoxy.profile-news-sources-list.edit', allowForMyself),
    getNewsSourcesListForProfileRoute
  )

  news.post(
    '/profiles/:profileId/news-sources/:newsSourceId',
    requireAuthorization('stoxy.profile-news-sources-list.edit'),
    addNewsSourceToListForProfileRoute
  )

  news.delete(
    '/profiles/:profileId/news-sources/:newsSourceId',
    requireAuthorization('stoxy.profile-news-sources-list.edit'),
    removeNewsSourceFromListForProfileRoute
  )

  news.post(
    '/news-sources/custom',
    requireAuthentication(),
    validate.bodyWithSchemaMiddlewareLazy(() => {
      const schema = require('./schemas/CustomNewsSourceCreate.json')
      return schema
    }),

    addCustomNewsSourceRoute
  )

  runner.installRoutes(async (app: Application) => {
    app.use('/api', news)
  })

  return {}
}
