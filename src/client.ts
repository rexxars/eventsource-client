import {createParser, type ParseEvent} from 'eventsource-parser'
import {CLOSED, CONNECTING, OPEN} from './constants'
import type {EnvAbstractions} from './abstractions'
import type {
  EventSourceClient,
  EventSourceOptions,
  FetchLike,
  FetchLikeInit,
  FetchLikeResponse,
  ReadyState,
} from './types'

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
 * @param options - Options for the client.
 * @param abstractions - Abstractions for the environments.
 * @returns A new EventSource client instance
 * @internal
 */
export function createEventSource(
  options: EventSourceOptions,
  {getStream, getTextDecoderStream}: EnvAbstractions
): EventSourceClient {
  const {onMessage, onDisconnect = noop} = options
  const {fetch, url, initialLastEventId} = validate(options)
  const requestHeaders = {...options.headers} // Prevent using modified object later
  const parser = createParser(onParsedMessage)

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
        if (err.name !== 'AbortError' && err.type !== 'aborted') {
          throw err
        }

        // @todo schedule reconnect?
      })
  }

  function close() {
    readyState = CLOSED
    controller.abort()
    clearTimeout(reconnectTimer)
  }

  function scheduleReconnect() {
    // @todo emit reconnect/disconnect event
    readyState = CONNECTING
    reconnectTimer = setTimeout(connect, reconnectMs)
  }

  async function onFetchResponse(response: FetchLikeResponse) {
    const {body, redirected, status} = response
    if (!body) {
      throw new Error('Missing response body')
    }

    // HTTP 204 means "close the connection, no more data will be sent"
    if (status === 204) {
      onDisconnect()
      close()
      return
    }

    if (redirected) {
      currentUrl = response.url
    }

    // Ensure that the response stream is a web stream
    // @todo Figure out a way to make this work without casting
    const bodyStream = getStream(body) as ReadableStream<Uint8Array>

    // EventSources are always UTF-8 per spec
    const stream = bodyStream.pipeThrough<string>(getTextDecoderStream('utf-8'))
    const reader = stream.getReader()
    let open = true

    readyState = OPEN

    do {
      const {done, value} = await reader.read()
      if (!done) {
        parser.feed(value)
        continue
      }

      open = false
      request = null

      onDisconnect()

      // EventSources never close unless explicitly handled with `.close()`:
      // Implementors should send an `done`/`complete`/`disconnect` event and
      // explicitly handle it in client code, or send an HTTP 204.
      scheduleReconnect()
    } while (open)
  }

  function onParsedMessage(msg: ParseEvent): void {
    if (msg.type === 'reconnect-interval') {
      reconnectMs = msg.value
      return
    }

    if (typeof msg.id === 'string') {
      lastEventId = msg.id
    }

    if (onMessage) {
      onMessage({
        id: msg.id,
        data: msg.data,
        event: msg.event,
      })
    }
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
