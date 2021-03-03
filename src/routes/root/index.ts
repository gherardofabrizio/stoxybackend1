import { ExpressRunnerModule } from '@radx/radx-backend-express'
import { DocsModule } from '@radx/radx-backend-swagger-docs'

export default function rootRouter(runner: ExpressRunnerModule, docs: DocsModule, config: {}) {
  const { express } = runner
  const packageJson = require('../../../package.json')

  // Documentation
  docs.compose(document => {
    Object.assign(document, {
      info: Object.assign(require('./docs/info.json'), { version: packageJson.version })
    })
  })

  const router = express.Router()

  router.get('', (req, res) => {
    if (req.accepts('text/html')) {
      res.send(
        `<html><head><title>Stoxy API</title></head><body><h1>Stoxy API</h1><p>Running version ${packageJson.version}</p></body></html>`
      )
    } else if (req.accepts('json')) {
      res.send({
        name: packageJson.name,
        version: packageJson.version
      })
    }
  })

  runner.afterRoutes(async (app, runner) => {
    app.use('/', router)
  })
}
