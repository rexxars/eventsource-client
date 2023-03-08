import type {
  TestRunner,
  TestFn,
  TestRunnerOptions,
  TestEvent,
  TestStartEvent,
  TestPassEvent,
  TestFailEvent,
  TestEndEvent,
} from './types'

interface TestDefinition {
  title: string
  timeout: number
  action: TestFn
}

const DEFAULT_TIMEOUT = 15000
const noop = (_event: TestEvent) => {
  /* intentional noop */
}

export function createRunner(options: TestRunnerOptions = {}): TestRunner {
  const {onEvent = noop, onStart = noop, onPass = noop, onFail = noop, onEnd = noop} = options
  const tests: TestDefinition[] = []

  let running = false
  let passes = 0
  let failures = 0
  let suiteStart = 0

  function registerTest(title: string, fn: TestFn, timeout?: number) {
    if (running) {
      throw new Error('Cannot register a test while tests are running')
    }

    tests.push({
      title,
      timeout: timeout ?? DEFAULT_TIMEOUT,
      action: fn,
    })
  }

  async function runTests(): Promise<TestEndEvent> {
    running = true
    suiteStart = Date.now()

    const start: TestStartEvent = {
      event: 'start',
      tests: tests.length,
    }

    onStart(start)
    onEvent(start)

    for (const test of tests) {
      const startTime = Date.now()
      try {
        await Promise.race([test.action(), getTimeoutPromise(test.timeout)])
        passes++
        const pass: TestPassEvent = {
          event: 'pass',
          duration: Date.now() - startTime,
          title: test.title,
        }
        onPass(pass)
        onEvent(pass)
      } catch (err) {
        failures++
        const fail: TestFailEvent = {
          event: 'fail',
          title: test.title,
          duration: Date.now() - startTime,
          error: err instanceof Error ? err.stack ?? err.message : `${err}`,
        }
        onFail(fail)
        onEvent(fail)
      }
    }

    const end: TestEndEvent = {
      event: 'end',
      success: failures === 0,
      failures,
      passes,
      tests: tests.length,
      duration: Date.now() - suiteStart,
    }
    onEnd(end)
    onEvent(end)

    running = false

    return end
  }

  function getTestCount() {
    return tests.length
  }

  function isRunning() {
    return running
  }

  return {
    isRunning,
    getTestCount,
    registerTest,
    runTests,
  }
}

function getTimeoutPromise(ms: number) {
  return new Promise((_resolve, reject) => {
    setTimeout(reject, ms, new Error(`Test timed out after ${ms} ms`))
  })
}
