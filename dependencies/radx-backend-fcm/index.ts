import admin from 'firebase-admin'

import fcmRoutesModule from './src/routes'
import fcmModelModule from './src/model'
import { addPrefixToTopic } from './src/helpers/topicPrefix'

// Type imports
import { ExpressRunnerModule } from '@radx/radx-backend-express'
import { KnexModule } from '@radx/radx-backend-knex'
import { AuthModule } from '@radx/radx-backend-auth'
import { DocsModule } from '@radx/radx-backend-swagger-docs'
import { Transaction } from 'objection'
import SendMessageController from './src/controllers/SendMessageController'

export interface FCMConfig {
  credentialsPath: string
  topicPrefix?: string
}

export interface FCMMessagePayload {
  body?: string
  title?: string
  data?: any
  groupId?: string
}

export interface FCMSendMessageResult {
  messageWasSent: boolean
  messageWasSentWithError?: boolean
  errorMessage?: string
  sendToTokensResult?: FCMSendToTokensResult
}

export interface FCMSendToUsersResult {
  [userdId: string]: FCMSendMessageResult
}

export interface FCMSendMessageToTokenResult {
  messageWasSentToToken: boolean
  errorMessage?: string
}

export interface FCMSendToTokensResult {
  [token: string]: FCMSendMessageToTokenResult
}

export default function fcmModule(
  runner: ExpressRunnerModule,
  database: KnexModule,
  auth: AuthModule,
  config: FCMConfig,
  docs?: DocsModule
) {
  // Adding documentation
  if (docs) {
    docs.composeWithDirectory(__dirname + '/docs')
    docs.composeWithDirectory(__dirname + '/schemas', '/components/schemas')
  }

  // Initializing Firebase Admin
  admin.initializeApp({
    credential: admin.credential.cert(config.credentialsPath)
  })

  const { User } = auth.model
  const model = fcmModelModule(runner, database, User, {})

  const sendMessageController = new SendMessageController(model, {
    topicPrefix: config.topicPrefix
  })

  const routes = fcmRoutesModule(runner, model, auth, sendMessageController, {
    topicPrefix: config.topicPrefix
  })

  async function sendNotificationToUser(
    userId: number,
    badgeCount: number | undefined,
    notification: FCMMessagePayload
  ): Promise<FCMSendMessageResult> {
    return sendMessageController.sendNotificationToUser(userId, badgeCount, notification)
  }

  async function sendNotificationToUsers(
    userIds: Array<number>,
    badgeCounts: { [userId: number]: number },
    notification: FCMMessagePayload
  ): Promise<FCMSendToUsersResult> {
    return sendMessageController.sendNotificationToUsers(userIds, badgeCounts, notification)
  }

  async function sendNotificationToTopic(
    topic: string | Array<string>,
    notification: FCMMessagePayload
  ): Promise<void> {
    return sendMessageController.sendNotificationToTopic(topic, notification)
  }

  async function sendSilentPushNotificationToUser(
    userId: number,
    notification: FCMMessagePayload
  ): Promise<void> {
    return sendMessageController.sendSilentPushNotificationToUser(userId, notification)
  }

  async function subscribeUserToTopic(userId: number, topic: string) {
    const topicWithPrefix = addPrefixToTopic(topic, { topicPrefix: config.topicPrefix })
    const tokens = await sendMessageController.getUserTokens(userId)
    await Promise.all(
      tokens.map(async token => {
        await admin.messaging().subscribeToTopic(token, topicWithPrefix)
      })
    )
  }

  async function unsubscribeUserFromTopic(userId: number, topic: string) {
    const topicWithPrefix = addPrefixToTopic(topic, { topicPrefix: config.topicPrefix })
    const tokens = await sendMessageController.getUserTokens(userId)
    await Promise.all(
      tokens.map(async token => {
        await admin.messaging().unsubscribeFromTopic(token, topicWithPrefix)
      })
    )
  }

  return {
    routes,
    sendNotificationToTopic,
    sendNotificationToUser,
    sendSilentPushNotificationToUser,
    sendNotificationToUsers,
    subscribeUserToTopic,
    unsubscribeUserFromTopic
  }
}

export type FCMModule = ReturnType<typeof fcmModule>
