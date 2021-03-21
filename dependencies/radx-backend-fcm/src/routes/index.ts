import admin from 'firebase-admin'

import { Application, Request, Response, NextFunction } from 'express'
import bodyParser from 'body-parser'
import { transaction, Transaction } from 'objection'

import createHooksManager, { FCMHooksManager } from './hooks'
import { addPrefixToTopic } from '../helpers/topicPrefix'

// Types imports
import { ExpressRunnerModule } from '@radx/radx-backend-express'
import { AuthModule, ISession } from '@radx/radx-backend-auth'
import { FCMModelModule } from '../model'
import { DocsModule } from '@radx/radx-backend-swagger-docs'
import SendMessageController from '../controllers/SendMessageController'

export interface FCMRoutesModuleConfig {
  topicPrefix?: string
}

export default function fcmRoutesModule(
  runner: ExpressRunnerModule,
  model: FCMModelModule,
  auth: AuthModule,
  sendMessageController: SendMessageController,
  config: FCMRoutesModuleConfig
) {
  const { errors, validate } = runner
  const { authenticate, requireAuthorization } = auth.middleware
  const { SessionWithFCMToken } = model
  const { Session } = auth.model

  const fcm = runner.express.Router()
  fcm.use(bodyParser.json())
  fcm.use(authenticate)

  const hooksManager: FCMHooksManager = createHooksManager()

  async function onFCMTokenUpdate(session: ISession, token: string, trx: Transaction) {
    // Get old topics list via hook
    const { topics: currentTopics } = await hooksManager.run.getCurrentUserTopics(session, {
      transaction: trx
    })

    const { topics } = await hooksManager.run.subscribeUserSessionOnTopics(session, {
      transaction: trx
    })

    const topicsToUnsubscribe = currentTopics.filter(topic => {
      return topics ? topics!.indexOf(topic) < 0 : false
    })

    // Unsubscribe from outdated topics
    if (topicsToUnsubscribe.length) {
      await Promise.all(
        topicsToUnsubscribe.map(async topic => {
          const topicWithPrefix = addPrefixToTopic(topic, { topicPrefix: config.topicPrefix })
          await admin.messaging().unsubscribeFromTopic(token, topicWithPrefix)
        })
      )
    }

    // Unsubscribe to provided topics
    if (topics && topics.length) {
      await Promise.all(
        topics.map(async topic => {
          const topicWithPrefix = addPrefixToTopic(topic, { topicPrefix: config.topicPrefix })
          await admin.messaging().subscribeToTopic(token, topicWithPrefix)
        })
      )
    }
  }

  async function updateFCMTokenRoute(req: Request, res: Response, next: NextFunction) {
    try {
      let sessionId = req.params.sessionId
      let token: string = req.body.value

      await transaction(Session.knex(), async trx => {
        const session = await SessionWithFCMToken.query(trx).findById(sessionId)
        if (!session) {
          throw errors.notFound('Session not found')
        }

        await SessionWithFCMToken.query(trx)
          .patch({
            fcmToken: null
          })
          .where({
            fcmToken: token
          })

        await session.$query(trx).patch({
          fcmToken: token
        })

        await onFCMTokenUpdate(session, token, trx)
      })

      res.sendStatus(204)
    } catch (error) {
      return next(error)
    }
  }

  fcm.patch(
    '/sessions/:sessionId/fcm-token',
    validate.bodyWithSchemaMiddlewareLazy(() => {
      const schema = require('../../schemas/FCMTokenUpdate.json')
      return schema
    }),
    requireAuthorization('auth.sessions.fcmToken.update', {
      description: 'Allow for session owner',
      priority: 'allow',
      condition: async (req: Request) => {
        let sessionId = req.params.sessionId
        const session = await Session.query().findById(sessionId)
        if (!session) {
          throw errors.notFound('Session not found')
        }
        return req.user!.id!.toString() === session!.userId!.toString()
      }
    }),
    updateFCMTokenRoute
  )

  runner.installRoutes(async (root: Application) => {
    root.use('/api', fcm)
  })

  return { fcm, hooks: hooksManager.install }
}

export type FCMRoutesModule = ReturnType<typeof fcmRoutesModule>
