import {createParser, type ParseEvent} from 'eventsource-parser'
import type {
  EventSourceClient,
  EventSourceOptions,
  FetchLike,
  FetchLikeInit,
  FetchLikeResponse,
  ReadyState,
} from './types'

/**
 * Internal abstractions over environment-specific APIs, to keep node-specifics
 * out of browser bundles and vice versa.
 *
 * @internal
 */
export interface EnvAbstractions {
  getStream(body: NodeJS.ReadableStream | ReadableStream): ReadableStream<Uint8Array>
  getTextDecoderStream(encoding: 'utf-8'): TextDecoderStream
}

// ReadyStates, mirrors WhatWG spec.

/**
 * ReadyState representing a connection that is connecting or has been scheduled to reconnect.
 * @public
 */
export const CONNECTING = 0

/**
 * ReadyState representing a connection that is open, eg connected.
 * @public
 */
export const OPEN = 1

/**
 * ReadyState representing a connection that has been closed (manually, or due to an error).
 * @public
 */
export const CLOSED = 2

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
  const {onMessage} = options
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
        if (err.type !== 'aborted') {
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

    if (status === 204) {
      // @todo read spec and figure out what is supposed to happen here
    }

    if (redirected) {
      currentUrl = response.url
    }

    // Ensure that the response stream is a web stream
    const bodyStream = getStream(body)

    // EventSources are always UTF-8 per spec
    const stream = bodyStream.pipeThrough(getTextDecoderStream('utf-8'))
    const reader = stream.getReader()
    let open = true

    do {
      const {done, value} = await reader.read()
      if (!done) {
        parser.feed(value)
        continue
      }

      open = false
      request = null

      if (options.onDisconnect) {
        options.onDisconnect()
      }

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
  if (!fetch) {
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
