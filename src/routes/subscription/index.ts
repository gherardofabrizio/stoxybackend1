import moment from 'moment'
import { NextFunction, Request, Response, Application } from 'express'
import { transaction } from 'objection'

import serializeSubscriptionInfo from '../serialization/SubscriptionInfo'

// Types imports
import { ExpressRunnerModule } from '@radx/radx-backend-express'
import { KnexModule } from '@radx/radx-backend-knex'
import { DocsModule } from '@radx/radx-backend-swagger-docs'
import { AuthModule } from '@radx/radx-backend-auth'
import SubscriptionController from '_app/controllers/SubscriptionController'
import { StoxyModelModule, ISubscriptionInfo } from '_app/model/stoxy'
import { subscriptionStatusFromString } from '../../model/stoxy/models/SubscriptionInfo'

export default function subscriptionRouter(
  runner: ExpressRunnerModule,
  database: KnexModule,
  docs: DocsModule,
  auth: AuthModule,
  stoxyModel: StoxyModelModule,
  subscriptionController: SubscriptionController
) {
  const { errors, validate } = runner
  const { Profile } = stoxyModel
  const { accessRules } = auth
  const { authenticate, requireAuthorization, requireAuthentication } = auth.middleware

  // Documentation
  docs.composeWithDirectory(__dirname + '/docs')
  docs.composeWithDirectory(__dirname + '/schemas', '/components/schemas')

  // Routes
  async function updateSubscriptionInfo(req: Request, res: Response, next: NextFunction) {
    try {
      const { knex } = database

      const update = req.body

      const profileId = parseInt(req.params.profileId, 10)

      let info: ISubscriptionInfo | undefined
      await transaction(knex, async trx => {
        info = await subscriptionController.updateSubscriptionInfoForProfile(
          profileId,
          {
            status: subscriptionStatusFromString(update.status),
            until: update.until ? moment(update.until).toDate() : undefined
          },
          trx
        )
      })

      res.send(serializeSubscriptionInfo(info!))
    } catch (error) {
      return next(error)
    }
  }

  // Router
  const subscriptions = runner.express.Router()
  subscriptions.use(authenticate)
  subscriptions.use(runner.express.json())

  subscriptions.patch(
    '/:profileId/subscription-info',
    requireAuthorization('stoxy.subscription-info.edit', {
      description: 'Allow for myself',
      priority: 'allow',
      condition: (req: Request) => req.user!.id!.toString() === req.params.profileId
    }),
    validate.bodyWithSchemaMiddlewareLazy(() => {
      const schema = require('./schemas/SubscriptionInfoUpdate.json')
      return schema
    }),
    updateSubscriptionInfo
  )

  runner.installRoutes(async (app: Application) => {
    app.use('/api/profiles', subscriptions)
  })

  return {}
}
