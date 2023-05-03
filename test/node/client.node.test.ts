/**
 * This module:
 * - Starts a development server
 * - Runs tests against them using a ducktaped simple test/assertion thing
 * - Prints the test results to the console
 *
 * Could we use a testing library? Yes.
 * Would that add a whole lot of value? No.
 */
import fetch from 'node-fetch'
import {createEventSource} from '../../src/node'
import {createRunner} from '../waffletest/runner'
import {registerTests} from '../tests'
import {getServer} from '../server'
import {nodeReporter} from '../waffletest/reporters/nodeReporter'

const NODE_TEST_PORT = 3945

// Run the tests in node.js
;(async function run() {
  const server = await getServer(NODE_TEST_PORT)

  const runner = registerTests({
    environment: 'node',
    runner: createRunner(nodeReporter),
    createEventSource,
    fetch,
    port: 3945,
  })

  const result = await runner.runTests()

  // Teardown
  await server.close()

  // eslint-disable-next-line no-process-exit
  process.exit(result.failures)
})()
