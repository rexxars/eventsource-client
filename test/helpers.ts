import sinon, {type SinonSpy} from 'sinon'

import type {EventSourceClient} from '../src/types'

type MessageReceiver = SinonSpy & {waitForCallCount: (num: number) => Promise<void>}

export class ExpectationError extends Error {
  type = 'ExpectationError'
}

export function getCallCounter(onCall?: (info: {numCalls: number}) => void): MessageReceiver {
  const listeners: [number, () => void][] = []

  let numCalls = 0
  const spy = sinon.fake(() => {
    numCalls++

    if (onCall) {
      onCall({numCalls})
    }

    listeners.forEach(([wanted, resolve]) => {
      if (wanted === numCalls) {
        resolve()
      }
    })
  })

  const fn = spy as unknown as MessageReceiver
  fn.waitForCallCount = (num: number) => {
    return new Promise<void>((resolve) => {
      if (numCalls === num) {
        resolve()
      } else {
        listeners.push([num, resolve])
      }
    })
  }

  return fn
}

export function deferClose(es: EventSourceClient, timeout = 25): Promise<void> {
  return new Promise((resolve) => setTimeout(() => resolve(es.close()), timeout))
}

export function expect(thing: unknown): {
  toBe(expected: unknown): void
  toBeLessThan(thanNum: number): void
  toMatchObject(expected: Record<string, unknown>): void
  toThrowError(expectedMessage: RegExp): void
} {
  return {
    toBe(expected: unknown) {
      if (thing !== expected) {
        throw new ExpectationError(`Expected ${thing} to be ${expected}`)
      }
    },

    toBeLessThan(thanNum: number) {
      if (typeof thing !== 'number' || thing >= thanNum) {
        throw new ExpectationError(`Expected ${thing} to be less than ${thanNum}`)
      }
    },

    toMatchObject(expected: Record<string, unknown>) {
      if (!isPlainObject(thing)) {
        throw new ExpectationError(`Expected an object, was... not`)
      }

      Object.keys(expected).forEach((key) => {
        if (!(key in thing)) {
          throw new ExpectationError(`Expected key "${key}" to be in object, was not`)
        }

        if (thing[key] !== expected[key]) {
          throw new ExpectationError(
            `Expected key "${key}" to be ${JSON.stringify(expected[key])}, was ${JSON.stringify(
              thing[key],
            )}`,
          )
        }
      })
    },

    toThrowError(expectedMessage: RegExp) {
      if (typeof thing !== 'function') {
        throw new ExpectationError(
          `Expected a function that was going to throw, but wasn't a function`,
        )
      }

      try {
        thing()
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : `${err}`
        if (!expectedMessage.test(message)) {
          throw new ExpectationError(
            `Expected error message to match ${expectedMessage}, got ${message}`,
          )
        }
        return
      }

      throw new ExpectationError('Expected function to throw error, but did not')
    },
  }
}

function isPlainObject(obj: unknown): obj is Record<string, unknown> {
  return typeof obj === 'object' && obj !== null && !Array.isArray(obj)
}
