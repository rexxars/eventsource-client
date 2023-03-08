export type TestFn = () => void | Promise<void>

export interface TestReporter {
  onEvent?: (event: TestEvent) => void
  onStart?: (event: TestStartEvent) => void
  onPass?: (event: TestPassEvent) => void
  onFail?: (event: TestFailEvent) => void
  onEnd?: (event: TestEndEvent) => void
}

// Equal for now, but might extend
export type TestRunnerOptions = TestReporter

export interface TestRunner {
  isRunning(): boolean
  getTestCount(): number
  registerTest: (title: string, fn: TestFn, timeout?: number) => void
  runTests: () => Promise<TestEndEvent>
}

export type TestEvent = TestStartEvent | TestPassEvent | TestFailEvent | TestEndEvent

export interface TestStartEvent {
  event: 'start'
  tests: number
}

export interface TestPassEvent {
  event: 'pass'
  title: string
  duration: number
}

export interface TestFailEvent {
  event: 'fail'
  title: string
  duration: number
  error: string
}

export interface TestEndEvent {
  event: 'end'
  success: boolean
  tests: number
  passes: number
  failures: number
  duration: number
}
