import {Server} from 'http'
import fetch from 'node-fetch'
import {createEventSource, EventSourceClient} from '../src/node'
import {getCallCounter} from './helpers'
import {getServer} from './server'

let server: Server
let es: EventSourceClient

beforeAll(async () => {
  server = await getServer()
})

afterAll((done) => {
  server.close(done)
})

afterEach(() => {
  if (es) {
    es.close()
  }
})

test('can connect, receive message, manually disconnect', async () => {
  const onMessage = getCallCounter()
  es = createEventSource({
    url: new URL('http://127.0.0.1:3945/'),
    fetch,
    onMessage,
  })

  await onMessage.callCount(1)

  expect(onMessage).toHaveBeenCalledTimes(1)
  expect(onMessage).toHaveBeenLastCalledWith({
    data: 'Hello, world!',
    event: 'welcome',
    id: undefined,
  })
})

test('will reconnect with last received message id if server disconnects', async () => {
  const onMessage = getCallCounter()
  const onDisconnect = getCallCounter()
  const url = 'http://127.0.0.1:3945/counter'
  es = createEventSource({
    url,
    fetch,
    onMessage,
    onDisconnect,
  })

  // While still receiving messages (we receive 3 at a time before it disconnects)
  await onMessage.callCount(1)
  expect(es.readyState).toBe(1) // OPEN

  // While waiting for reconnect (after 3 messages it will disconnect and reconnect)
  await onDisconnect.callCount(1)
  expect(es.readyState).toBe(0) // RECONNECTING
  expect(onMessage).toHaveBeenCalledTimes(3)

  // Will reconnect infinitely, stop at 8 messages
  await onMessage.callCount(8)

  expect(es.lastEventId).toBe('8')
  expect(es.url).toBe(url)
  expect(onMessage).toHaveBeenCalledTimes(8)
  expect(onMessage).toHaveBeenLastCalledWith({
    data: 'Counter is at 8',
    event: 'counter',
    id: '8',
  })
})

test('calling connect while already connected does nothing', async () => {
  const onMessage = getCallCounter()
  es = createEventSource({
    url: 'http://127.0.0.1:3945/counter',
    fetch,
    onMessage,
  })

  es.connect()
  await onMessage.callCount(1)
  es.connect()
  await onMessage.callCount(2)
  es.connect()
})

test('can pass an initial last received event id', async () => {
  const onMessage = getCallCounter()
  es = createEventSource({
    url: 'http://127.0.0.1:3945/counter',
    fetch,
    onMessage,
    initialLastEventId: '50000',
  })

  await onMessage.callCount(4)

  expect(es.lastEventId).toBe('50004')
  expect(onMessage).toHaveBeenCalledTimes(4)
  expect(onMessage).toHaveBeenNthCalledWith(1, {
    data: 'Counter is at 50001',
    event: 'counter',
    id: '50001',
  })
  expect(onMessage).toHaveBeenLastCalledWith({
    data: 'Counter is at 50004',
    event: 'counter',
    id: '50004',
  })
})

test('will close stream on HTTP 204', async () => {
  const onMessage = getCallCounter()
  const onDisconnect = getCallCounter()
  es = createEventSource({
    url: 'http://127.0.0.1:3945/end-after-one',
    fetch,
    onMessage,
    onDisconnect,
  })

  // First disconnect, then reconnect and given a 204
  await onDisconnect.callCount(2)

  // Only the first connect should have given a message
  await onMessage.callCount(1)

  expect(es.lastEventId).toBe('prct-100')
  expect(es.readyState).toBe(2) // CLOSED
  expect(onMessage).toHaveBeenCalledTimes(1)
  expect(onMessage).toHaveBeenLastCalledWith({
    data: '100%',
    event: 'progress',
    id: 'prct-100',
  })
})

test('throws if `url` is not a string/url', () => {
  const onMessage = getCallCounter()
  expect(() => {
    es = createEventSource({
      url: 123 as unknown as string,
      fetch,
      onMessage,
    })
  }).toThrowErrorMatchingInlineSnapshot(`"Invalid URL provided - must be string or URL instance"`)

  expect(onMessage).toHaveBeenCalledTimes(0)
})

test('throws if `initialLastEventId` is not a string', () => {
  const onMessage = getCallCounter()
  expect(() => {
    es = createEventSource({
      url: 'http://127.0.0.1:3945/',
      fetch,
      onMessage,
      initialLastEventId: 123 as unknown as string,
    })
  }).toThrowErrorMatchingInlineSnapshot(
    `"Invalid initialLastEventId provided - must be string or undefined"`
  )

  expect(onMessage).toHaveBeenCalledTimes(0)
})
