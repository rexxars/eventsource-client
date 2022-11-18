import {Server} from 'http'
import fetch from 'node-fetch'
import {createEventSource, EventSourceClient} from '../src/node'
import {getMessageReceiver} from './helpers'
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
  const fn = getMessageReceiver()
  es = createEventSource({
    url: new URL('http://127.0.0.1:3945/'),
    fetch,
    onMessage: fn,
  })

  await fn.receivedMessages(1)

  expect(fn).toHaveBeenCalledTimes(1)
  expect(fn).toHaveBeenLastCalledWith({
    data: 'Hello, world!',
    event: 'welcome',
    id: undefined,
  })
})

test('will reconnect with last received message id if server disconnects', async () => {
  const fn = getMessageReceiver()
  const url = 'http://127.0.0.1:3945/counter'
  es = createEventSource({
    url,
    fetch,
    onMessage: fn,
  })

  await fn.receivedMessages(8)

  expect(es.lastEventId).toBe('8')
  expect(es.url).toBe(url)
  expect(fn).toHaveBeenCalledTimes(8)
  expect(fn).toHaveBeenLastCalledWith({
    data: 'Counter is at 8',
    event: 'counter',
    id: '8',
  })
})

test('calling connect while already connected does nothing', async () => {
  const fn = getMessageReceiver()
  es = createEventSource({
    url: 'http://127.0.0.1:3945/counter',
    fetch,
    onMessage: fn,
  })

  es.connect()
  await fn.receivedMessages(1)
  es.connect()
  await fn.receivedMessages(2)
  es.connect()
})

test('can pass an initial last received event id', async () => {
  const fn = getMessageReceiver()
  es = createEventSource({
    url: 'http://127.0.0.1:3945/counter',
    fetch,
    onMessage: fn,
    initialLastEventId: '50000',
  })

  await fn.receivedMessages(4)

  expect(es.lastEventId).toBe('50004')
  expect(fn).toHaveBeenCalledTimes(4)
  expect(fn).toHaveBeenNthCalledWith(1, {
    data: 'Counter is at 50001',
    event: 'counter',
    id: '50001',
  })
  expect(fn).toHaveBeenLastCalledWith({
    data: 'Counter is at 50004',
    event: 'counter',
    id: '50004',
  })
})

test('throws if `url` is not a string/url', () => {
  const fn = getMessageReceiver()
  expect(() => {
    es = createEventSource({
      url: 123 as unknown as string,
      fetch,
      onMessage: fn,
    })
  }).toThrowErrorMatchingInlineSnapshot(`"Invalid URL provided - must be string or URL instance"`)

  expect(fn).toHaveBeenCalledTimes(0)
})

test('throws if `initialLastEventId` is not a string', () => {
  const fn = getMessageReceiver()
  expect(() => {
    es = createEventSource({
      url: 'http://127.0.0.1:3945/',
      fetch,
      onMessage: fn,
      initialLastEventId: 123 as unknown as string,
    })
  }).toThrowErrorMatchingInlineSnapshot(
    `"Invalid initialLastEventId provided - must be string or undefined"`
  )

  expect(fn).toHaveBeenCalledTimes(0)
})
