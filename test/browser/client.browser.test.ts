/**
 * This module:
 * - Starts a development server
 * - Spawns browsers and points them at the server
 * - Runs the tests in the browser (using waffletest)
 * - Reports results from browser to node using the registered function `reportTest`
 * - Prints the test results to the console
 *
 * Is this weird? Yes.
 * Is there a better way? Maybe. But I haven't found one.
 */
import {chromium, devices} from 'playwright'
import {getServer} from '../server'
import {type TestEvent, type TestEndEvent} from '../waffletest'
import {nodeReporter} from '../waffletest/reporters/nodeReporter'

const {
  onStart: reportStart,
  onPass: reportPass,
  onFail: reportFail,
  onEnd: reportEnd,
} = nodeReporter

const BROWSER_TEST_PORT = 3883

// Run the tests in browsers
;(async function run() {
  const server = await getServer(BROWSER_TEST_PORT)
  const browser = await chromium.launch()
  const context = await browser.newContext(devices['iPhone 11'])
  const page = await context.newPage()

  await page.exposeFunction('reportTest', (event: TestEvent) => {
    switch (event.event) {
      case 'start':
        return reportStart(event)
      case 'pass':
        return reportPass(event)
      case 'fail':
        return reportFail(event)
      case 'end':
        reportEnd(event)
        return onSuiteEnd(event)
      default:
        throw new Error(`Unexpected event: ${(event as any).event}`)
    }
  })

  await page.goto(`http://localhost:${BROWSER_TEST_PORT}/browser-test`)

  async function onSuiteEnd(result: TestEndEvent) {
    // Teardown
    await context.close()
    await browser.close()
    await server.close()

    if (result.failures > 0) {
      // eslint-disable-next-line no-process-exit
      process.exit(1)
    }
  }
})()
