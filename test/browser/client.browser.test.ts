/* eslint-disable no-console */
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
 *
 * Supported flags:
 *
 * --browser=firefox|chromium|webkit
 * --no-headless
 * --serial
 */
import {chromium, firefox, webkit, BrowserType} from 'playwright'
import {getServer} from '../server'
import {type TestEvent} from '../waffletest'
import {nodeReporter} from '../waffletest/reporters/nodeReporter'

type BatchedResults = {
  browserName: string
  events: TestEvent[]
}[]

type BrowserName = 'firefox' | 'chromium' | 'webkit'

const browsers: Record<BrowserName, BrowserType<{}>> = {
  firefox,
  chromium,
  webkit,
}

const {onPass: reportPass, onFail: reportFail, onEnd: reportEnd} = nodeReporter

const BROWSER_TEST_PORT = 3883
const RUN_IN_SERIAL = process.argv.includes('--serial')
const NO_HEADLESS = process.argv.includes('--no-headless')

const browserFlag = getBrowserFlag()
if (browserFlag && !isDefinedBrowserType(browserFlag)) {
  throw new Error(`Invalid browser flag. Must be one of: ${Object.keys(browsers).join(', ')}`)
}

const browserFlagType = isDefinedBrowserType(browserFlag) ? browsers[browserFlag] : undefined

// Run the tests in browsers
;(async function run() {
  const server = await getServer(BROWSER_TEST_PORT)
  const jobs =
    browserFlag && browserFlagType
      ? [{name: browserFlag, browserType: browserFlagType}]
      : Object.entries(browsers).map(([name, browserType]) => ({name, browserType}))

  // Run all browsers in parallel, unless --serial is defined
  const results: BatchedResults = []

  if (RUN_IN_SERIAL) {
    for (const job of jobs) {
      results.push({browserName: job.name, events: await runBrowserTest(job.browserType)})
    }
  } else {
    results.push(
      ...(await Promise.all(
        jobs.map(async (job) => {
          return {browserName: job.name, events: await runBrowserTest(job.browserType)}
        })
      ))
    )
  }

  // Now report output to the console
  let totalFailures = 0
  for (const result of results) {
    console.log(`Browser: ${result.browserName}`)

    for (const event of result.events) {
      switch (event.event) {
        case 'start':
          // Ignored
          break
        case 'pass':
          reportPass(event)
          break
        case 'fail':
          totalFailures++
          reportFail(event)
          break
        case 'end':
          reportEnd(event)
          break
        default:
          throw new Error(`Unexpected event: ${(event as any).event}`)
      }
    }
  }

  const testCount = getTestCount(results)
  console.log(`Ran ${testCount} tests against ${jobs.length} browsers`)

  await server.close()

  if (totalFailures > 0) {
    // eslint-disable-next-line no-process-exit
    process.exit(1)
  }
})()

function runBrowserTest(browserType: BrowserType): Promise<TestEvent[]> {
  return new Promise(async (resolve) => {
    const browser = await browserType.launch({headless: !NO_HEADLESS})
    const context = await browser.newContext()
    const page = await context.newPage()
    const events: TestEvent[] = []

    await page.exposeFunction('reportTest', async (event: TestEvent) => {
      events.push(event)

      if (event.event !== 'end') {
        return
      }

      // Teardown
      await context.close()
      await browser.close()
      resolve(events)
    })

    await page.goto(`http://localhost:${BROWSER_TEST_PORT}/browser-test`)
  })
}

function isDefinedBrowserType(browserName: string | undefined): browserName is BrowserName {
  return typeof browserName === 'string' && browserName in browsers
}

function getTestCount(results: BatchedResults): number {
  for (const result of results) {
    for (const event of result.events) {
      if (event.event === 'start') {
        return event.tests
      }
    }
  }

  return 0
}

function getBrowserFlag(): BrowserName | undefined {
  const resolved = (function getFlag() {
    // Look for --browser <browserName>
    const flagIndex = process.argv.indexOf('--browser')
    let flag = flagIndex === -1 ? undefined : process.argv[flagIndex + 1]
    if (flag) {
      return flag
    }

    // Look for --browser=<browserName>
    flag = process.argv.find((arg) => arg.startsWith('--browser='))
    return flag ? flag.split('=')[1] : undefined
  })()

  if (!resolved) {
    return undefined
  }

  if (!isDefinedBrowserType(resolved)) {
    throw new Error(`Invalid browser flag. Must be one of: ${Object.keys(browsers).join(', ')}`)
  }

  return resolved
}
