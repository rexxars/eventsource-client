import {createEventSource} from '../../src/default'
import {getServer} from '../server'
import {registerTests} from '../tests'
import {createRunner} from '../waffletest'
import {nodeReporter} from '../waffletest/reporters/nodeReporter'

const BUN_TEST_PORT = 3946

// Run the tests in bun
;(async function run() {
  const server = await getServer(BUN_TEST_PORT)

  const runner = registerTests({
    environment: 'bun',
    runner: createRunner(nodeReporter),
    createEventSource,
    fetch: globalThis.fetch,
    port: BUN_TEST_PORT,
  })

  const result = await runner.runTests()

  // Teardown
  await server.close()

  // eslint-disable-next-line no-process-exit
  process.exit(result.failures)
})()
