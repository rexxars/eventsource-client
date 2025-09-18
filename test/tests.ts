import { CLOSED, CONNECTING, OPEN } from '../src/constants.js'
import type { createEventSource as CreateEventSourceFn, EventSourceMessage } from '../src/default.js'
import { unicodeLines } from './fixtures.js'
import { deferClose, expect, getCallCounter } from './helpers.js'
import type { TestRunner } from './waffletest/index.js'

export function registerTests(options: {
  environment: string
  runner: TestRunner
  port: number
  createEventSource: typeof CreateEventSourceFn
  fetch?: typeof fetch
}): TestRunner {
  const { createEventSource, port, fetch, runner, environment } = options

  // eslint-disable-next-line no-empty-function
  const browserTest = environment === 'browser' ? runner.registerTest : function noop() { }
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

    await onMessage.waitForCallCount(1)

    expect(onMessage.callCount).toBe(1)
    expect(onMessage.lastCall.lastArg).toMatchObject({
      data: 'Hello, world!',
      event: 'welcome',
      id: undefined,
    })

    await deferClose(es)
  })

  test('can connect using URL only', async () => {
    const es = createEventSource(new URL(`${baseUrl}:${port}/`))
    for await (const event of es) {
      expect(event).toMatchObject({ event: 'welcome' })
      await deferClose(es)
    }
  })

  test('can connect using URL string only', async () => {
    const es = createEventSource(`${baseUrl}:${port}/`)
    for await (const event of es) {
      expect(event).toMatchObject({ event: 'welcome' })
      await deferClose(es)
    }
  })

  test('can handle unicode data correctly', async () => {
    const onMessage = getCallCounter()
    const es = createEventSource({
      url: new URL(`${baseUrl}:${port}/unicode`),
      fetch,
      onMessage,
    })

    const messages: EventSourceMessage[] = []
    for await (const event of es) {
      if (event.event === 'unicode') {
        messages.push(event)
      }

      if (messages.length === 2) {
        break
      }
    }

    expect(messages[0].data).toBe(unicodeLines[0])
    expect(messages[1].data).toBe(unicodeLines[1])

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
    expect(es.readyState, 'readyState').toBe(OPEN) // Open (connected)

    // While waiting for reconnect (after 3 messages it will disconnect and reconnect)
    await onDisconnect.waitForCallCount(1)
    expect(es.readyState, 'readyState').toBe(CONNECTING) // Connecting (reconnecting)
    expect(onMessage.callCount).toBe(3)

    // Will reconnect infinitely, stop at 8 messages
    await onMessage.waitForCallCount(8)

    expect(es.url).toBe(url)
    expect(onMessage.lastCall.lastArg).toMatchObject({
      data: 'Counter is at 8',
      event: 'counter',
      id: '8',
    })
    expect(es.lastEventId).toBe('8')
    expect(onMessage.callCount).toBe(8)

    await deferClose(es)
  })

  test('will not reconnect after explicit `close()`', async () => {
    const request = fetch || globalThis.fetch
    const onMessage = getCallCounter()
    const onDisconnect = getCallCounter()
    const onScheduleReconnect = getCallCounter()
    const clientId = Math.random().toString(36).slice(2)
    const url = `${baseUrl}:${port}/identified?client-id=${clientId}`
    const es = createEventSource({
      url,
      fetch,
      onMessage,
      onDisconnect,
      onScheduleReconnect,
    })

    // Should receive a message containing the number of listeners on the given ID
    await onMessage.waitForCallCount(1)
    expect(onMessage.lastCall.lastArg).toMatchObject({ data: '1' })
    expect(es.readyState, 'readyState').toBe(OPEN) // Open (connected)

    // Explicitly disconnect. Should normally reconnect within ~250ms (server sends retry: 250)
    // but we'll close it before that happens
    es.close()
    expect(es.readyState, 'readyState').toBe(CLOSED)
    expect(onMessage.callCount).toBe(1)
    expect(onScheduleReconnect.callCount, 'onScheduleReconnect call count').toBe(0)

    // After 500 ms, there should still only be a single connect with this client ID
    await new Promise((resolve) => setTimeout(resolve, 500))
    expect(await request(url).then((res) => res.json())).toMatchObject({ clientIdConnects: 1 })

    // Wait another 500 ms, just to be sure there are no slow reconnects
    await new Promise((resolve) => setTimeout(resolve, 500))
    expect(await request(url).then((res) => res.json())).toMatchObject({ clientIdConnects: 1 })

    expect(onScheduleReconnect.callCount, 'onScheduleReconnect call count').toBe(0)
  })

  test('will not reconnect after `close()` in `onScheduleReconnect`', async () => {
    const onMessage = getCallCounter()
    const onDisconnect = getCallCounter()
    const onScheduleReconnect = getCallCounter(() => es.close())

    const url = `${baseUrl}:${port}/counter`
    const es = createEventSource({
      url,
      fetch,
      onMessage,
      onDisconnect,
      onScheduleReconnect,
    })

    // Wait until first batch of messages is received (3 messages before server disconnects)
    await onMessage.waitForCallCount(3)

    // Wait until onDisconnect has been called (server closed connection)
    await onDisconnect.waitForCallCount(1)
  
    // Wait until onScheduleReconnect has been called where we call es.close()
    await onScheduleReconnect.waitForCallCount(1)

    expect(es.readyState, 'readyState').toBe(CLOSED)

    // Give some time to ensure no reconnects happen
    await new Promise((resolve) => setTimeout(resolve, 500))

    expect(onScheduleReconnect.callCount, 'onScheduleReconnect call count').toBe(1)
    expect(es.readyState, 'readyState').toBe(CLOSED)
  })

  test('will not reconnect after explicit `close()` in `onDisconnect`', async () => {
    const request = fetch || globalThis.fetch
    const onMessage = getCallCounter()
    const onDisconnect = getCallCounter(() => es.close())
    const onScheduleReconnect = getCallCounter()
    const clientId = Math.random().toString(36).slice(2)
    const url = `${baseUrl}:${port}/identified?client-id=${clientId}&auto-close=true`
    const es = createEventSource({
      url,
      fetch,
      onMessage,
      onDisconnect,
      onScheduleReconnect,
    })

    // Should receive a message containing the number of listeners on the given ID
    await onMessage.waitForCallCount(1)
    expect(onMessage.lastCall.lastArg, 'onMessage `event` argument').toMatchObject({ data: '1' })
    expect(es.readyState, 'readyState').toBe(OPEN) // Open (connected)

    await onDisconnect.waitForCallCount(1)
    expect(es.readyState, 'readyState').toBe(CLOSED) // `onDisconnect` called first, closes ES.

    // After 50 ms, we should still be in closing state - no reconnecting
    expect(es.readyState, 'readyState').toBe(CLOSED)

    // After 500 ms, there should be no clients connected to the given ID
    await new Promise((resolve) => setTimeout(resolve, 500))
    expect(await request(url).then((res) => res.json())).toMatchObject({ clientIdConnects: 1 })
    expect(es.readyState, 'readyState').toBe(CLOSED)

    // Wait another 500 ms, just to be sure there are no slow reconnects
    await new Promise((resolve) => setTimeout(resolve, 500))
    expect(await request(url).then((res) => res.json())).toMatchObject({ clientIdConnects: 1 })
    expect(es.readyState, 'readyState').toBe(CLOSED)
  })

  test('can use async iterator, reconnects transparently', async () => {
    const onDisconnect = getCallCounter()
    const url = `${baseUrl}:${port}/counter`
    const es = createEventSource({
      url,
      fetch,
      onDisconnect,
    })

    let numMessages = 1
    for await (const event of es) {
      expect(event.event).toBe('counter')
      expect(event.data).toBe(`Counter is at ${numMessages}`)
      expect(event.id).toBe(`${numMessages}`)

      // Will reconnect infinitely, stop at 11 messages
      if (++numMessages === 11) {
        break
      }
    }

    expect(onDisconnect.callCount).toBe(3)
    await deferClose(es)
  })

  test('async iterator breaks out of loop without error when calling `close()`', async () => {
    const url = `${baseUrl}:${port}/counter`
    const es = createEventSource({
      url,
      fetch,
    })

    let hasSeenMessage = false
    for await (const { event } of es) {
      hasSeenMessage = true
      expect(event).toBe('counter')
      es.close()
    }

    expect(hasSeenMessage).toBe(true)
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
    expect(es.readyState, 'readyState').toBe(CONNECTING)

    // Connected
    await onConnect.waitForCallCount(1)
    expect(es.readyState, 'readyState').toBe(OPEN)

    // Disconnected
    await onDisconnect.waitForCallCount(1)
    expect(es.readyState, 'readyState').toBe(CONNECTING)

    // Closed
    await es.close()
    expect(es.readyState, 'readyState').toBe(CLOSED)
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
    expect(es.readyState, 'readyState').toBe(CLOSED) // CLOSED
    expect(onMessage.callCount).toBe(1)
    expect(onMessage.lastCall.lastArg).toMatchObject({
      data: '100%',
      event: 'progress',
      id: 'prct-100',
    })

    await deferClose(es)
  })

  test('can send plain-text string data as POST request with headers', async () => {
    const onMessage = getCallCounter()
    const es = createEventSource({
      url: new URL(`${baseUrl}:${port}/debug`),
      method: 'POST',
      body: 'Blåbærsyltetøy, rømme og brunost på vaffel',
      headers: { 'Content-Type': 'text/norwegian-plain; charset=utf-8' },
      fetch,
      onMessage,
    })

    await onMessage.waitForCallCount(1)
    expect(onMessage.callCount).toBe(1)

    const lastMessage = onMessage.lastCall.lastArg
    expect(lastMessage.event).toBe('debug')

    const data = JSON.parse(lastMessage.data)
    expect(data.method).toBe('POST')
    expect(data.bodyHash).toBe('5f4e50479bfc5ccdb6f865cc3341245dde9e81aa2f36b0c80e3fcbcfbeccaeda')
    expect(data.headers).toMatchObject({ 'content-type': 'text/norwegian-plain; charset=utf-8' })

    await deferClose(es)
  })

  test('throws if `url` is not a string/url', () => {
    const onMessage = getCallCounter()
    expect(() => {
      const es = createEventSource({
        // @ts-expect-error Should be a string
        url: 123,
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
        // @ts-expect-error Should be a string
        initialLastEventId: 123,
      })

      es.close()
    }).toThrowError(/Invalid initialLastEventId provided - must be string or undefined/)

    expect(onMessage.callCount).toBe(0)
  })

  test('can request cross-origin', async () => {
    const hostUrl = new URL(`${baseUrl}:${port}/cors`)
    const url = new URL(hostUrl)
    url.hostname = url.hostname === 'localhost' ? '127.0.0.1' : 'localhost'

    const onMessage = getCallCounter()
    const es = createEventSource({
      url,
      fetch,
      onMessage,
    })

    await onMessage.waitForCallCount(1)
    expect(onMessage.callCount).toBe(1)

    const lastMessage = onMessage.lastCall.lastArg
    expect(lastMessage.event).toBe('origin')

    if (environment === 'browser') {
      expect(lastMessage.data).toBe(hostUrl.origin)
    } else {
      expect(lastMessage.data).toBe('<none>')
    }

    await deferClose(es)
  })

  browserTest(
    'can use the `credentials` option to control cookies being sent/not sent',
    async () => {
      // Ideally this would be done through playwright, but can't get it working,
      // so let's just fire off a request that sets the cookies for now
      const { cookiesWritten } = await globalThis.fetch('/set-cookie').then((res) => res.json())
      expect(cookiesWritten).toBe(true)

      let es = createEventSource({ url: '/authed', fetch, credentials: 'include' })
      for await (const event of es) {
        expect(event.event).toBe('authInfo')
        expect(JSON.parse(event.data)).toMatchObject({ cookies: 'someSession=someValue' })
        break
      }

      await deferClose(es)

      es = createEventSource({ url: '/authed', fetch, credentials: 'omit' })
      for await (const event of es) {
        expect(event.event).toBe('authInfo')
        expect(JSON.parse(event.data)).toMatchObject({ cookies: '' })
        break
      }
    },
  )

  return runner
}
