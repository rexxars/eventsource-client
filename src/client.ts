import {createParser} from 'eventsource-parser'

import type {EnvAbstractions, EventSourceAsyncValueResolver} from './abstractions.js'
import {CLOSED, CONNECTING, OPEN} from './constants.js'
import type {
  EventSourceClient,
  EventSourceMessage,
  EventSourceOptions,
  FetchLike,
  FetchLikeInit,
  FetchLikeResponse,
  ReadyState,
} from './types.js'

/**
 * Intentional noop function for eased control flow
 */
const noop = () => {
  /* intentional noop */
}

/**
 * Creates a new EventSource client. Used internally by the environment-specific entry points,
 * and should not be used directly by consumers.
 *
 * @param optionsOrUrl - Options for the client, or an URL/URL string.
 * @param abstractions - Abstractions for the environments.
 * @returns A new EventSource client instance
 * @internal
 */
export function createEventSource(
  optionsOrUrl: EventSourceOptions | string | URL,
  {getStream}: EnvAbstractions,
): EventSourceClient {
  const options =
    typeof optionsOrUrl === 'string' || optionsOrUrl instanceof URL
      ? {url: optionsOrUrl}
      : optionsOrUrl
  const {onMessage, onConnect = noop, onDisconnect = noop, onScheduleReconnect = noop} = options
  const {fetch, url, initialLastEventId} = validate(options)
  const requestHeaders = {...options.headers} // Prevent post-creation mutations to headers

  const onCloseSubscribers: (() => void)[] = []
  const subscribers: ((event: EventSourceMessage) => void)[] = onMessage ? [onMessage] : []
  const emit = (event: EventSourceMessage) => subscribers.forEach((fn) => fn(event))
  const parser = createParser({onEvent, onRetry})

  // Client state
  let request: Promise<unknown> | null
  let currentUrl = url.toString()
  let controller = new AbortController()
  let lastEventId = initialLastEventId
  let reconnectMs = 2000
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined
  let readyState: ReadyState = CLOSED

  // Let's go!
  connect()

  return {
    close,
    connect,
    [Symbol.iterator]: () => {
      throw new Error(
        'EventSource does not support synchronous iteration. Use `for await` instead.',
      )
    },
    [Symbol.asyncIterator]: getEventIterator,
    get lastEventId() {
      return lastEventId
    },
    get url() {
      return currentUrl
    },
    get readyState() {
      return readyState
    },
  }

  function connect() {
    if (request) {
      return
    }

    readyState = CONNECTING
    controller = new AbortController()
    request = fetch(url, getRequestOptions())
      .then(onFetchResponse)
      .catch((err: Error & {type: string}) => {
        request = null

        // We expect abort errors when the user manually calls `close()` - ignore those
        if (err.name === 'AbortError' || err.type === 'aborted') {
          return
        }

        scheduleReconnect()
      })
  }

  function close() {
    readyState = CLOSED
    controller.abort()
    parser.reset()
    clearTimeout(reconnectTimer)
    onCloseSubscribers.forEach((fn) => fn())
  }

  function getEventIterator(): AsyncGenerator<EventSourceMessage, void> {
    const pullQueue: EventSourceAsyncValueResolver[] = []
    const pushQueue: EventSourceMessage[] = []

    function pullValue() {
      return new Promise<IteratorResult<EventSourceMessage, void>>((resolve) => {
        const value = pushQueue.shift()
        if (value) {
          resolve({value, done: false})
        } else {
          pullQueue.push(resolve)
        }
      })
    }

    const pushValue = function (value: EventSourceMessage) {
      const resolve = pullQueue.shift()
      if (resolve) {
        resolve({value, done: false})
      } else {
        pushQueue.push(value)
      }
    }

    function unsubscribe() {
      subscribers.splice(subscribers.indexOf(pushValue), 1)
      while (pullQueue.shift()) {}
      while (pushQueue.shift()) {}
    }

    function onClose() {
      const resolve = pullQueue.shift()
      if (!resolve) {
        return
      }

      resolve({done: true, value: undefined})
      unsubscribe()
    }

    onCloseSubscribers.push(onClose)
    subscribers.push(pushValue)

    return {
      next() {
        return readyState === CLOSED ? this.return() : pullValue()
      },
      return() {
        unsubscribe()
        return Promise.resolve({done: true, value: undefined})
      },
      throw(error) {
        unsubscribe()
        return Promise.reject(error)
      },
      [Symbol.asyncIterator]() {
        return this
      },
    }
  }

  function scheduleReconnect() {
    onScheduleReconnect({delay: reconnectMs})
    readyState = CONNECTING
    reconnectTimer = setTimeout(connect, reconnectMs)
  }

  async function onFetchResponse(response: FetchLikeResponse) {
    onConnect()
    parser.reset()

    const {body, redirected, status} = response

    // HTTP 204 means "close the connection, no more data will be sent"
    if (status === 204) {
      onDisconnect()
      close()
      return
    }

    if (!body) {
      throw new Error('Missing response body')
    }

    if (redirected) {
      currentUrl = response.url
    }

    // Ensure that the response stream is a web stream
    // @todo Figure out a way to make this work without casting
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stream = getStream(body as any)
    const decoder = new TextDecoder()

    const reader = stream.getReader()
    let open = true

    readyState = OPEN

    do {
      const {done, value} = await reader.read()
      if (value) {
        parser.feed(decoder.decode(value, {stream: !done}))
      }

      if (!done) {
        continue
      }

      open = false
      request = null
      parser.reset()

      // EventSources never close unless explicitly handled with `.close()`:
      // Implementors should send an `done`/`complete`/`disconnect` event and
      // explicitly handle it in client code, or send an HTTP 204.
      scheduleReconnect()

      // Calling scheduleReconnect() prior to onDisconnect() allows consumers to
      // explicitly call .close() before the reconnection is performed.
      onDisconnect()
    } while (open)
  }

  function onEvent(msg: EventSourceMessage) {
    if (typeof msg.id === 'string') {
      lastEventId = msg.id
    }

    emit(msg)
  }

  function onRetry(ms: number) {
    reconnectMs = ms
  }

  function getRequestOptions(): FetchLikeInit {
    // @todo allow interception of options, but don't allow overriding signal
    const {mode, credentials, body, method, redirect, referrer, referrerPolicy} = options
    const lastEvent = lastEventId ? {'Last-Event-ID': lastEventId} : undefined
    const headers = {Accept: 'text/event-stream', ...requestHeaders, ...lastEvent}
    return {
      mode,
      credentials,
      body,
      method,
      redirect,
      referrer,
      referrerPolicy,
      headers,
      cache: 'no-store',
      signal: controller.signal,
    }
  }
}

function validate(options: EventSourceOptions): {
  fetch: FetchLike
  url: string | URL
  initialLastEventId: string | undefined
} {
  const fetch = options.fetch || globalThis.fetch
  if (!isFetchLike(fetch)) {
    throw new Error('No fetch implementation provided, and one was not found on the global object.')
  }

  if (typeof AbortController !== 'function') {
    throw new Error('Missing AbortController implementation')
  }

  const {url, initialLastEventId} = options

  if (typeof url !== 'string' && !(url instanceof URL)) {
    throw new Error('Invalid URL provided - must be string or URL instance')
  }

  if (typeof initialLastEventId !== 'string' && initialLastEventId !== undefined) {
    throw new Error('Invalid initialLastEventId provided - must be string or undefined')
  }

  return {fetch, url, initialLastEventId}
}

// This is obviously naive, but hard to probe for full compatibility
function isFetchLike(fetch: FetchLike | typeof globalThis.fetch): fetch is FetchLike {
  return typeof fetch === 'function'
}
