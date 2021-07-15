import buildWireframe from './wireframe'
import yargs from 'yargs'

const argv = yargs.option('configPath', {
  alias: 'c',
  describe: 'path to configuration file in JSON or JS format',
  type: 'string',
  demandOption: true
}).argv

const wireframe = buildWireframe(argv.configPath)
wireframe.run()
