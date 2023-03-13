import sinon from 'sinon'
import type NodeFetch from 'node-fetch'

import type {createEventSource as CreateEventSourceFn} from '../src/default'
import {OPEN, CONNECTING, CLOSED} from '../src/constants'
import {expect, deferClose, getCallCounter} from './helpers'
import {TestRunner} from './waffletest'

export function registerTests(options: {
  runner: TestRunner
  port: number
  createEventSource: typeof CreateEventSourceFn
  fetch?: typeof fetch | typeof NodeFetch
}): TestRunner {
  const {createEventSource, port, fetch, runner} = options
  const test = runner.registerTest
  const baseUrl =
    typeof document === 'undefined'
      ? 'http://127.0.0.1'
      : `${location.protocol}//${location.hostname}`

  test('can connect, receive message, manually disconnect', async () => {
    const onMessage = getCallCounter()
    const es = createEventSource({
      url: new URL(`${baseUrl}:${port}/`),
      fetch,
      onMessage,
    })

    sinon.fake()

    await onMessage.waitForCallCount(1)

    expect(onMessage.callCount).toBe(1)
    expect(onMessage.lastCall.lastArg).toMatchObject({
      data: 'Hello, world!',
      event: 'welcome',
      id: undefined,
    })

    await deferClose(es)
  })

  test('will reconnect with last received message id if server disconnects', async () => {
    const onMessage = getCallCounter()
    const onDisconnect = getCallCounter()
    const url = `${baseUrl}:${port}/counter`
    const es = createEventSource({
      url,
      fetch,
      onMessage,
      onDisconnect,
    })

    // While still receiving messages (we receive 3 at a time before it disconnects)
    await onMessage.waitForCallCount(1)
    expect(es.readyState).toBe(OPEN) // Open (connected)

    // While waiting for reconnect (after 3 messages it will disconnect and reconnect)
    await onDisconnect.waitForCallCount(1)
    expect(es.readyState).toBe(CONNECTING) // Connecting (reconnecting)
    expect(onMessage.callCount).toBe(3)

    // Will reconnect infinitely, stop at 8 messages
    await onMessage.waitForCallCount(8)

    expect(es.lastEventId).toBe('8')
    expect(es.url).toBe(url)
    expect(onMessage.callCount).toBe(8)
    expect(onMessage.lastCall.lastArg).toMatchObject({
      data: 'Counter is at 8',
      event: 'counter',
      id: '8',
    })

    await deferClose(es)
  })

  test('will have correct ready state throughout lifecycle', async () => {
    const onMessage = getCallCounter()
    const onConnect = getCallCounter()
    const onDisconnect = getCallCounter()
    const url = `${baseUrl}:${port}/slow-connect`
    const es = createEventSource({
      url,
      fetch,
      onMessage,
      onConnect,
      onDisconnect,
    })

    // Connecting
    expect(es.readyState).toBe(CONNECTING)

    // Connected
    await onConnect.waitForCallCount(1)
    expect(es.readyState).toBe(OPEN)

    // Disconnected
    await onDisconnect.waitForCallCount(1)
    expect(es.readyState).toBe(CONNECTING)

    // Closed
    await es.close()
    expect(es.readyState).toBe(CLOSED)
  })

  test('calling connect while already connected does nothing', async () => {
    const onMessage = getCallCounter()
    const es = createEventSource({
      url: `${baseUrl}:${port}/counter`,
      fetch,
      onMessage,
    })

    es.connect()
    await onMessage.waitForCallCount(1)
    es.connect()
    await onMessage.waitForCallCount(2)
    es.connect()

    await deferClose(es)
  })

  test('can pass an initial last received event id', async () => {
    const onMessage = getCallCounter()
    const es = createEventSource({
      url: `${baseUrl}:${port}/counter`,
      fetch,
      onMessage,
      initialLastEventId: '50000',
    })

    await onMessage.waitForCallCount(4)

    expect(es.lastEventId).toBe('50004')
    expect(onMessage.callCount).toBe(4)
    expect(onMessage.firstCall.lastArg).toMatchObject({
      data: 'Counter is at 50001',
      event: 'counter',
      id: '50001',
    })
    expect(onMessage.lastCall.lastArg).toMatchObject({
      data: 'Counter is at 50004',
      event: 'counter',
      id: '50004',
    })

    await deferClose(es)
  })

  test('will close stream on HTTP 204', async () => {
    const onMessage = getCallCounter()
    const onDisconnect = getCallCounter()
    const es = createEventSource({
      url: `${baseUrl}:${port}/end-after-one`,
      fetch,
      onMessage,
      onDisconnect,
    })

    // First disconnect, then reconnect and given a 204
    await onDisconnect.waitForCallCount(2)

    // Only the first connect should have given a message
    await onMessage.waitForCallCount(1)

    expect(es.lastEventId).toBe('prct-100')
    expect(es.readyState).toBe(CLOSED) // CLOSED
    expect(onMessage.callCount).toBe(1)
    expect(onMessage.lastCall.lastArg).toMatchObject({
      data: '100%',
      event: 'progress',
      id: 'prct-100',
    })

    await deferClose(es)
  })

  test('throws if `url` is not a string/url', () => {
    const onMessage = getCallCounter()
    expect(() => {
      const es = createEventSource({
        url: 123 as unknown as string,
        fetch,
        onMessage,
      })

      es.close()
    }).toThrowError(/Invalid URL provided/)

    expect(onMessage.callCount).toBe(0)
  })

  test('throws if `initialLastEventId` is not a string', () => {
    const onMessage = getCallCounter()
    expect(() => {
      const es = createEventSource({
        url: `${baseUrl}:${port}/`,
        fetch,
        onMessage,
        initialLastEventId: 123 as unknown as string,
      })

      es.close()
    }).toThrowError(/Invalid initialLastEventId provided - must be string or undefined/)

    expect(onMessage.callCount).toBe(0)
  })

  return runner
}
