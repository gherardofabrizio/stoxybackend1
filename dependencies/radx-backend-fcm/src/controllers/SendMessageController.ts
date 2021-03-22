import admin from 'firebase-admin'

import { addPrefixToTopic } from '../helpers/topicPrefix'

// Type imports
import {
  FCMMessagePayload,
  FCMSendMessageResult,
  FCMSendToTokensResult,
  FCMSendToUsersResult
} from '../..'
import { FCMModelModule } from '../model'

export interface SendMessageControllerConfig {
  topicPrefix?: string
}

export default class SendMessageController {
  private model: FCMModelModule
  private config: SendMessageControllerConfig

  constructor(model: FCMModelModule, config: { topicPrefix?: string }) {
    this.model = model
    this.config = config
  }

  async send(payload: any, options: any): Promise<FCMSendToTokensResult> {
    let messageOptions: any = {
      priority: 'high'
    }

    const sendResult: FCMSendToTokensResult = {}

    if (options.collapseKey) {
      messageOptions['collapseKey'] = options.collapseKey
    }

    try {
      let response = await admin.messaging().sendToDevice(options.tokens, payload, messageOptions)

      for (let i = 0; i < options.tokens.length; i++) {
        const token: string = options.tokens[i]
        const result = response.results[i]
        if (!result.error && result.messageId) {
          sendResult[token] = {
            messageWasSentToToken: true
          }
        } else if (!result.messageId && result.error) {
          sendResult[token] = {
            messageWasSentToToken: false,
            errorMessage: result.error.message
          }
        }
      }
    } catch (error) {
      console.log('send message error: ', error)
      // throw error
    }

    return sendResult
  }

  async getUserTokens(userId: number): Promise<Array<string>> {
    const { SessionWithFCMToken } = this.model

    let sessions = await SessionWithFCMToken.query().where({
      userId: userId
    })

    const tokens: Array<string> = sessions
      .filter(session => {
        if (session.fcmToken && session.fcmToken.length) {
          return true
        }
      })
      .map(session => session.fcmToken!)

    return tokens || []
  }

  async sendNotificationToUser(
    userId: number,
    badgeCount: number | undefined,
    notification: FCMMessagePayload
  ): Promise<FCMSendMessageResult> {
    const tokens = await this.getUserTokens(userId)
    if (tokens.length === 0) {
      return { messageWasSent: false, errorMessage: 'Tokens not found at sessions' }
    }

    let payload: any = {
      notification: {
        title: notification.title || '',
        body: notification.body || ''
      }
    }

    if (badgeCount !== undefined) {
      payload.notification.badge = badgeCount.toString()
    }

    if (notification.data) {
      payload.data = notification.data
    }

    let options: any = {
      tokens: tokens
    }

    if (notification.groupId) {
      payload.notification['tag'] = notification.groupId
      options['collapseKey'] = notification.groupId
    }

    const result = await this.send(payload, options)

    let messageWasSent = false
    let messageWasSentWithError = false
    Object.keys(result).forEach(key => {
      if (result[key].messageWasSentToToken) {
        messageWasSent = true
      } else if (!result[key].messageWasSentToToken) {
        messageWasSentWithError = true
      }
    })

    return { messageWasSent, messageWasSentWithError, sendToTokensResult: result }
  }

  async sendNotificationToUsers(
    userIds: Array<number>,
    badgeCounts: { [userId: number]: number },
    notification: FCMMessagePayload
  ): Promise<FCMSendToUsersResult> {
    const { SessionWithFCMToken } = this.model

    const batchSize = 1000
    let offset = 0
    let haveSessionsToProceed = true
    let sendResult: FCMSendToUsersResult = {}
    userIds.forEach(userId => {
      if (userId) {
        sendResult[userId] = {
          messageWasSent: false,
          errorMessage: 'Tokens not found at sessions'
        }
      }
    })

    while (haveSessionsToProceed) {
      let sessions = await SessionWithFCMToken.query()
        .whereIn('userId', userIds)
        .orderBy('id', 'ASC')
        .limit(batchSize)
        .offset(offset)

      haveSessionsToProceed = sessions.length > 0
      offset += batchSize

      const tokens = sessions
        .filter(session => {
          if (session.fcmToken && session.fcmToken.length) {
            return true
          }
        })
        .map(session => session.fcmToken)

      if (tokens.length === 0) {
        if (haveSessionsToProceed) {
          continue
        } else {
          break
        }
      }

      let payload: any = {
        notification: {
          title: notification.title || '',
          body: notification.body || ''
        }
      }
      if (notification.data) {
        payload.data = notification.data
      }

      let options: any = {
        tokens: tokens
      }

      if (notification.groupId) {
        payload.notification['tag'] = notification.groupId
        options['collapseKey'] = notification.groupId
      }

      if (Object.keys(badgeCounts).length) {
        await Promise.all(
          userIds.map(async userId => {
            const result = await this.sendNotificationToUser(
              userId,
              badgeCounts[userId] || 0,
              notification
            )
            sendResult[userId] = result
          })
        )
      } else {
        const result = await this.send(payload, options)
        sessions.forEach(session => {
          if (
            session.userId &&
            session.fcmToken &&
            result[session.fcmToken] &&
            result[session.fcmToken].messageWasSentToToken
          ) {
            sendResult[session.userId].messageWasSent = true
          }
        })
      }
    }

    return sendResult
  }

  async sendNotificationToTopic(topic: string | Array<string>, notification: FCMMessagePayload) {
    let payload: any = {
      notification: {
        title: notification.title || '',
        body: notification.body || ''
      }
    }
    if (notification.data) {
      payload.data = notification.data
    }

    if (Array.isArray(topic)) {
      // FCM can handle max 5 topics at condition at once
      let i = 0
      let maxTopicsCountAtCondition = 5
      for (i = 0; i < topic.length; i += maxTopicsCountAtCondition) {
        const topicsToSend = topic.slice(i, i + maxTopicsCountAtCondition)
        const condition = topicsToSend
          .map(t => {
            return (
              `'` + addPrefixToTopic(t, { topicPrefix: this.config.topicPrefix }) + `' in topics`
            )
          })
          .join(' || ')

        const sendNotificationToTopicResult = await admin
          .messaging()
          .sendToCondition(condition, payload)
      }
    } else {
      const sendNotificationToTopicResult = await admin
        .messaging()
        .sendToTopic(addPrefixToTopic(topic, { topicPrefix: this.config.topicPrefix }), payload)
    }
  }

  async sendSilentPushNotificationToUser(userId: number, notification: FCMMessagePayload) {
    const tokens = await this.getUserTokens(userId)
    if (tokens.length === 0) {
      return
    }

    let apns: admin.messaging.ApnsConfig = {
      payload: {
        aps: {
          'content-available': 1
        }
      },
      headers: {
        'apns-priority': '5',
        'apns-push-type': 'background'
      }
    }

    const message: admin.messaging.MulticastMessage = {
      data: notification.data,
      apns,
      tokens
    }
    const dryRun = false

    try {
      await admin.messaging().sendMulticast(message, dryRun)
    } catch (error) {
      console.log('Send silent push notification error: ', error)
    }
  }
}
