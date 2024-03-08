/* eslint-disable no-process-env, no-console */
import {platform} from 'node:os'
import {isatty} from 'node:tty'

import type {
  TestEndEvent,
  TestFailEvent,
  TestPassEvent,
  TestReporter,
  TestStartEvent,
} from '../types'
import {getEndText, getFailText, getPassText, getStartText} from './helpers'

const CAN_USE_COLORS = canUseColors()

export const nodeReporter: Required<Omit<TestReporter, 'onEvent'>> = {
  onStart: reportStart,
  onEnd: reportEnd,
  onPass: reportPass,
  onFail: reportFail,
}

export function reportStart(event: TestStartEvent): void {
  console.log(`${getStartText(event)}\n`)
}

export function reportPass(event: TestPassEvent): void {
  console.log(green(getPassText(event)))
}

export function reportFail(event: TestFailEvent): void {
  console.log(red(getFailText(event)))
}

export function reportEnd(event: TestEndEvent): void {
  console.log(`\n${getEndText(event)}`)
}

function red(str: string): string {
  return CAN_USE_COLORS ? `\x1b[31m${str}\x1b[39m` : str
}

function green(str: string): string {
  return CAN_USE_COLORS ? `\x1b[32m${str}\x1b[39m` : str
}

function canUseColors(): boolean {
  const isWindows = platform() === 'win32'
  const isDumbTerminal = process.env.TERM === 'dumb'
  const isCompatibleTerminal = isatty(1) && process.env.TERM && !isDumbTerminal
  const isCI =
    'CI' in process.env &&
    ('GITHUB_ACTIONS' in process.env || 'GITLAB_CI' in process.env || 'CIRCLECI' in process.env)
  return (isWindows && !isDumbTerminal) || isCompatibleTerminal || isCI
}
