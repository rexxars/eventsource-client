/**
 * Compiled by ESBuild for the browser
 */
import {createEventSource} from '../../src/default.js'
import {registerTests} from '../tests.js'
import {createRunner, type TestEvent} from '../waffletest/index.js'

if (!windowHasBeenExtended(window)) {
  throw new Error('window.reportTest has not been defined by playwright')
}

const runner = registerTests({
  environment: 'browser',
  runner: createRunner({onEvent: window.reportTest}),
  createEventSource,
  port: 3883,
})

runner.runTests().then((result) => {
  const el = document.getElementById('waffletest')
  if (!el) {
    console.error('Could not find element with id "waffletest"')
    return
  }

  el.innerText = 'Running tests…'
  el.innerText = `Tests completed ${result.success ? 'successfully' : 'with errors'}`
  el.className = result.success ? 'success' : 'fail'
})

// Added by our playwright-based test runner
interface ExtendedWindow extends Window {
  reportTest: (event: TestEvent) => void
}

function windowHasBeenExtended(win: Window): win is ExtendedWindow {
  return 'reportTest' in win && typeof win.reportTest === 'function'
}
