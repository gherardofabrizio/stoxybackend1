import moment from 'moment'

import { NextFunction, Request, Response, Application } from 'express'
import { transaction } from 'objection'

import serializeNewsSourcesList from '../serialization/NewsSourcesList'
import serializeNewsSource from '../serialization/NewsSource'
import serializeProfileNewsSourcesList from '../serialization/ProfileNewsSourcesList'
import serializeProfileNewsSourcesListItem from '../serialization/ProfileNewsSourcesListItem'

import allowForMyself from '../accessRules/allowForMyself'

// Types imports
import { ExpressRunnerModule } from '@radx/radx-backend-express'
import { KnexModule } from '@radx/radx-backend-knex'
import { DocsModule } from '@radx/radx-backend-swagger-docs'
import { AuthModule, AccessRule } from '@radx/radx-backend-auth'
import NewsSourcesController from '_app/controllers/NewsSourcesController'
import {
  StoxyModelModule,
  INewsSourcesList,
  INewsSource,
  IProfileNewsSourcesList,
  IProfileNewsSourcesListItem
} from '_app/model/stoxy'

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
      let fetchOnlyBuiltIn = false
      if (req.query && req.query['fetchOnlyBuiltIn'] === 'true') {
        fetchOnlyBuiltIn = true
      }

      let list: INewsSourcesList | undefined
      await transaction(knex, async trx => {
        if (searchQuery.length) {
          list = await newsSourcesController.getNewsSourcesBySearchQuery(
            searchQuery,
            fetchOnlyBuiltIn,
            trx
          )
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

      let list: IProfileNewsSourcesList | undefined
      await transaction(knex, async trx => {
        list = await newsSourcesController.getNewsSourcesListForProfile(profileId, trx)
      })

      res.send(serializeProfileNewsSourcesList(list!))
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

      const title = req.body.title

      let item: IProfileNewsSourcesListItem | undefined
      await transaction(knex, async trx => {
        item = await newsSourcesController.addNewsSourceToListForProfile(
          newsSourceId,
          profileId,
          title,
          trx
        )
      })

      res.send(serializeProfileNewsSourcesListItem(item!))
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

      await transaction(knex, async trx => {
        await newsSourcesController.removeNewsSourceFromListForProfile(newsSourceId, profileId, trx)
      })

      res.sendStatus(204)
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

  async function batchNewsSourcesListUpdateRoute(req: Request, res: Response, next: NextFunction) {
    try {
      const { knex } = database

      const profileId = parseInt(req.params.profileId, 10)
      const newsSourcesUpsert = req.body

      let list: IProfileNewsSourcesList

      await transaction(knex, async trx => {
        list = await newsSourcesController.batchUpdateNewsSourcesForProfile(
          profileId,
          newsSourcesUpsert.map((item: any) => {
            return {
              newsSourceId: parseInt(item.newsSourceId, 10),
              title: item.title
            }
          }),
          trx
        )
      })

      res.send(serializeProfileNewsSourcesList(list!))
    } catch (error) {
      return next(error)
    }
  }

  // Router
  const newsSources = runner.express.Router()
  newsSources.use(authenticate)
  newsSources.use(runner.express.json())

  newsSources.get('/news-sources', requireAuthentication(), getDefaultNewsSourcesListRoute)

  newsSources.get(
    '/profiles/:profileId/news-sources',
    requireAuthorization('stoxy.profile-news-sources-list.edit', allowForMyself),
    getNewsSourcesListForProfileRoute
  )

  newsSources.post(
    '/profiles/:profileId/news-sources/:newsSourceId',
    requireAuthorization('stoxy.profile-news-sources-list.edit'),
    addNewsSourceToListForProfileRoute
  )

  newsSources.delete(
    '/profiles/:profileId/news-sources/:newsSourceId',
    requireAuthorization('stoxy.profile-news-sources-list.edit'),
    removeNewsSourceFromListForProfileRoute
  )

  newsSources.post(
    '/news-sources/custom',
    requireAuthentication(),
    validate.bodyWithSchemaMiddlewareLazy(() => {
      const schema = require('./schemas/CustomNewsSourceCreate.json')
      return schema
    }),

    addCustomNewsSourceRoute
  )

  newsSources.put(
    '/profiles/:profileId/news-sources/',
    requireAuthorization('stoxy.profile-news-sources-list.edit'),
    validate.bodyWithSchemaMiddlewareLazy(() => {
      const schema = require('./schemas/ProfileNewsSourcesListBatchUpdate.json')
      return schema
    }),
    batchNewsSourcesListUpdateRoute
  )

  runner.installRoutes(async (app: Application) => {
    app.use('/api', newsSources)
  })

  return {}
}
