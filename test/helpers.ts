import sinon, {type SinonSpy} from 'sinon'
import type {EventSourceClient} from '../src/types'

type MessageReceiver = SinonSpy & {waitForCallCount: (num: number) => Promise<void>}

export function getCallCounter(): MessageReceiver {
  const listeners: [number, () => void][] = []

  let numCalls = 0
  const spy = sinon.fake(() => {
    numCalls++
    listeners.forEach(([wanted, resolve]) => {
      if (wanted === numCalls) {
        resolve()
      }
    })
  })

  const fn = spy as any as MessageReceiver
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
  toMatchObject(expected: Record<string, any>): void
  toThrowError(expectedMessage: RegExp): void
} {
  return {
    toBe(expected: unknown) {
      if (thing !== expected) {
        throw new Error(`Expected ${thing} to be ${expected}`)
      }
    },

    toMatchObject(expected: Record<string, any>) {
      if (!isPlainObject(thing)) {
        throw new Error(`Expected an object, was... not`)
      }

      Object.keys(expected).forEach((key) => {
        if (!(key in thing)) {
          throw new Error(`Expected key "${key}" to be in object, was not`)
        }

        if (thing[key] !== expected[key]) {
          throw new Error(`Expected key "${key}" to be ${expected[key]}, was ${thing[key]}`)
        }
      })
    },

    toThrowError(expectedMessage: RegExp) {
      if (typeof thing !== 'function') {
        throw new Error(`Expected a function that was going to throw, but wasn't a function`)
      }

      try {
        thing()
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : `${err}`
        if (!expectedMessage.test(message)) {
          throw new Error(`Expected error message to match ${expectedMessage}, got ${message}`)
        }
        return
      }

      throw new Error('Expected function to throw error, but did not')
    },
  }
}

function isPlainObject(obj: unknown): obj is Record<string, any> {
  return typeof obj === 'object' && obj !== null && !Array.isArray(obj)
}
