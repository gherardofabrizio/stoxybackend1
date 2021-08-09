import { NextFunction, Request, Response, Application } from 'express'
import { transaction, Transaction } from 'objection'

import serializeProfile, { serializeUserWithProfile } from '../serialization/Profile'

// Types imports
// import { ProfileModel } from '_app/model/stoxy/models/Profile'
import { ExpressRunnerModule } from '@radx/radx-backend-express'
import { KnexModule } from '@radx/radx-backend-knex'
import { DocsModule } from '@radx/radx-backend-swagger-docs'
import { AuthModule, IUser } from '@radx/radx-backend-auth'
import ProfileController, { ProfileUpdate } from '_app/controllers/ProfileController'
import NewsSourcesController from '_app/controllers/NewsSourcesController'
import NewsNotificationsController from '_app/controllers/NewsNotificationsController'
import { StoxyModelModule, IProfile, UserWithProfile } from '_app/model/stoxy'
import { FCMModule } from '_dependencies/radx-backend-fcm'

export interface ProfilesRouterConfig {
  apiBaseUrl: string
}

export default function profilesRouter(
  runner: ExpressRunnerModule,
  database: KnexModule,
  docs: DocsModule,
  auth: AuthModule,
  fcm: FCMModule,
  stoxyModel: StoxyModelModule,
  profileController: ProfileController,
  newsSourcesController: NewsSourcesController,
  newsNotificationsController: NewsNotificationsController,
  config: ProfilesRouterConfig
) {
  const { errors, validate } = runner
  const { Profile } = stoxyModel
  const { accessRules } = auth
  const { authenticate, requireAuthorization, requireAuthentication } = auth.middleware

  function updateUserCreateSchema(schemaUserCreate: any) {
    schemaUserCreate.required = (schemaUserCreate.required || []).concat('profile')
    schemaUserCreate.properties.profile = require('./schemas/ProfileCreate.json')
  }

  function updateUserUpdateSchema(schemaUserCreate: any) {
    schemaUserCreate.properties.profile = require('./schemas/ProfileUpdate.json')
  }

  // Documentation
  docs.composeWithDirectory(__dirname + '/docs')
  docs.composeWithDirectory(__dirname + '/schemas', '/components/schemas')
  docs.compose((document: any) => {
    updateUserCreateSchema(document.components.schemas.UserCreate)
    updateUserUpdateSchema(document.components.schemas.UserUpdate)
  })

  // Hooks
  auth.routes.hooks.onSerializeUser(async (serializedUser, context) => {
    return serializeUserWithProfile(serializedUser, context.user)
  })

  auth.routes.hooks.onSerializeSession(async (serializedSession, context) => {
    if (serializedSession.user && context.session.user) {
      serializedSession.user = serializeUserWithProfile(
        serializedSession.user,
        context.session.user
      )
    }

    return serializedSession
  })

  auth.routes.hooks.afterCreateUser(async (user, context) => {
    const dataProfileCreate = context.req.body.profile || {}

    const updatedProfile = await profileController.createProfile(
      user.id!,
      dataProfileCreate,
      context.transaction
    )
    ;(user as IUser & UserWithProfile).profile = updatedProfile

    // Add default news sources for user
    await newsSourcesController.initNewsSourcesListForProfile(user.id!, context.transaction)
  })

  auth.routes.hooks.afterUpdateUser(async (user, context) => {
    const profileUpdate = context.req.body.profile
    const userId = parseInt(context.req.params.userId, 10)

    if (profileUpdate) {
      await profileController.updateProfile(userId, profileUpdate, context.transaction)
    }
  })

  fcm.routes.hooks.getCurrentUserTopics(async (session, context) => {
    return {
      topics: await newsNotificationsController.getCurrentUserTopics(
        session.userId!,
        context.transaction
      )
    }
  })

  fcm.routes.hooks.subscribeUserSessionOnTopics(async (session, context) => {
    return {
      topics: await newsNotificationsController.getCurrentUserTopics(
        session.userId!,
        context.transaction
      )
    }
  })

  // Routes
  async function readProfileRoute(req: Request, res: Response, next: NextFunction) {
    try {
      const { knex } = database

      const profileId = parseInt(req.params.profileId, 10)

      let profile: IProfile

      await transaction(knex, async trx => {
        profile = await profileController.getProfile(profileId, trx)
      })

      res.send(serializeProfile(profile!))
    } catch (error) {
      return next(error)
    }
  }

  async function updateProfileRoute(req: Request, res: Response, next: NextFunction) {
    try {
      const profileId = parseInt(req.params.profileId, 10)

      let { knex } = database
      const checkProfile = await Profile.query().findById(profileId)
      if (!checkProfile) {
        const error = errors.notFound(`Profile not found: ${profileId}`)
        error.radxCode = 'profiles/notFound'
        throw error
      }

      let updatedProfile: IProfile | undefined
      await transaction(knex, async trx => {
        updatedProfile = await profileController.updateProfile(profileId, req.body, trx)
      })

      let profile = await Profile.query().findById(updatedProfile!.id!)
      if (profile) {
        updatedProfile = profile
      }

      res.send(serializeProfile(updatedProfile!))
    } catch (error) {
      return next(error)
    }
  }

  async function facebookDataDeletionCheckRoute(req: Request, res: Response, next: NextFunction) {
    try {
      const code = req.query['id']

      if (!code || code.length !== 12) {
        res.sendStatus(400)
        return
      }

      res.send('Your data was successfully removed')
    } catch (error) {
      return next(error)
    }
  }

  async function deleteFacebookDataRoute(req: Request, res: Response, next: NextFunction) {
    try {
      const generateRandomCode = (length: number) => {
        var result = ''
        var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
        var charactersLength = characters.length
        for (var i = 0; i < length; i++) {
          result += characters.charAt(Math.floor(Math.random() * charactersLength))
        }
        return result
      }

      let confirmation_code = generateRandomCode(12)

      const url =
        config.apiBaseUrl + '/profiles/facebook-data-deletion-check?id=' + confirmation_code

      res.send({
        url,
        confirmation_code
      })
    } catch (error) {
      return next(error)
    }
  }

  // Router
  const profiles = runner.express.Router()
  profiles.use(authenticate)
  profiles.use(runner.express.json())

  profiles.get(
    '/:profileId(\\d+)',
    requireAuthorization('stoxy.profiles.get', {
      description: 'Allow for myself',
      priority: 'allow',
      condition: (req: Request) => req.user!.id!.toString() === req.params.profileId
    }),
    readProfileRoute
  )

  profiles.patch(
    '/:profileId',
    requireAuthorization('stoxy.profiles.edit', {
      description: 'Allow for myself',
      priority: 'allow',
      condition: (req: Request) => req.user!.id!.toString() === req.params.profileId
    }),
    validate.bodyWithSchemaMiddlewareLazy(() => {
      const schema = require('./schemas/ProfileUpdate.json')
      return schema
    }),
    updateProfileRoute
  )

  profiles.post('/facebook-data-deletion-request', deleteFacebookDataRoute)

  profiles.get('/facebook-data-deletion-check', facebookDataDeletionCheckRoute)

  runner.installRoutes(async (app: Application) => {
    app.use('/api/profiles', profiles)
  })

  return {}
}
