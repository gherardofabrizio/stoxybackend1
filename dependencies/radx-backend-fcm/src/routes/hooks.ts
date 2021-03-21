import { Transaction, Model } from 'objection'
import { ISession } from '_dependencies/radx-backend-auth'

export interface FCMTokenUpdateHookResponse {
  topics?: Array<string>
}

export interface FCMGetUserTopicsHookResponse {
  topics: Array<string>
}

export interface FCMTokenUpdateHook {
  (session: ISession, context: { transaction: Transaction; req?: Request }): Promise<
    FCMTokenUpdateHookResponse
  >
}

export interface FCMGetUserTopicsHook {
  (session: ISession, context: { transaction: Transaction; req?: Request }): Promise<
    FCMGetUserTopicsHookResponse
  >
}

export interface RoutesHooksRun {
  getCurrentUserTopics: (
    session: ISession,
    context: {
      transaction: Transaction
      req?: Request
    }
  ) => Promise<FCMGetUserTopicsHookResponse>
  subscribeUserSessionOnTopics: (
    session: ISession,
    context: {
      transaction: Transaction
      req?: Request
    }
  ) => Promise<FCMTokenUpdateHookResponse>
}

export interface RoutesHooksInstall {
  getCurrentUserTopics: (hook: FCMGetUserTopicsHook) => void
  subscribeUserSessionOnTopics: (hook: FCMTokenUpdateHook) => void
}

export interface FCMHooksManager {
  run: RoutesHooksRun
  install: RoutesHooksInstall
}

export default function createHooksManager(): FCMHooksManager {
  const onFCMGetUserTopicsHooks: Array<FCMGetUserTopicsHook> = []
  const onFCMTokenUpdateHooks: Array<FCMTokenUpdateHook> = []

  return {
    install: {
      getCurrentUserTopics: (hook: FCMGetUserTopicsHook) => onFCMGetUserTopicsHooks.push(hook),
      subscribeUserSessionOnTopics: (hook: FCMTokenUpdateHook) => onFCMTokenUpdateHooks.push(hook)
    },
    run: {
      getCurrentUserTopics: async (
        session: ISession,
        context: { transaction: Transaction; req?: Request }
      ) => {
        const topics: Array<string> = []

        await Promise.all(
          onFCMGetUserTopicsHooks.map(async hook => {
            const response = await hook(session, context)
            if (response.topics) {
              topics.push(...response.topics)
            }
          })
        )

        return {
          topics
        }
      },
      subscribeUserSessionOnTopics: async (
        session: ISession,
        context: { transaction: Transaction; req?: Request }
      ) => {
        let topics: Array<string> = []

        await Promise.all(
          onFCMTokenUpdateHooks.map(async hook => {
            const response = await hook(session, context)
            if (response.topics) {
              topics.push(...response.topics)
            }
          })
        )

        return {
          topics
        }
      }
    }
  }
}
