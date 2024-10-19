import type {ReadableStream as NodeWebReadableStream} from 'node:stream/web'

import type {EventSourceMessage} from 'eventsource-parser'

/**
 * Ready state for a connection.
 *
 * @public
 */
export type ReadyState = 'open' | 'connecting' | 'closed'

/**
 * EventSource client.
 *
 * @public
 */
export interface EventSourceClient {
  /** Close the connection and prevent the client from reconnecting automatically. */
  close(): void

  /** Connect to the event source. Automatically called on creation - you only need to call this after manually calling `close()`, when server has sent an HTTP 204, or the server responded with a non-retryable error. */
  connect(): void

  /** Warns when attempting to iterate synchronously */
  [Symbol.iterator](): never

  /** Async iterator of messages received */
  [Symbol.asyncIterator](): AsyncIterableIterator<EventSourceMessage>

  /** Last seen event ID, or the `initialLastEventId` if none has been received yet. */
  readonly lastEventId: string | undefined

  /** Current URL. Usually the same as `url`, but in the case of allowed redirects, it will reflect the new URL. */
  readonly url: string

  /** Ready state of the connection */
  readonly readyState: ReadyState
}

/**
 * Options for the eventsource client.
 *
 * @public
 */
export interface EventSourceOptions {
  /** URL to connect to. */
  url: string | URL

  /** Callback that fires each time a new event is received. */
  onMessage?: (event: EventSourceMessage) => void

  /** Callback that fires each time the connection is established (multiple times in the case of reconnects). */
  onConnect?: () => void

  /** Callback that fires each time we schedule a new reconnect attempt. Will include an object with information on how many milliseconds it will attempt to delay before doing the reconnect. */
  onScheduleReconnect?: (info: {delay: number}) => void

  /** Callback that fires each time the connection is broken (will still attempt to reconnect, unless `close()` is called). */
  onDisconnect?: () => void

  /** A string to use for the initial `Last-Event-ID` header when connecting. Only used until the first message with a new ID is received. */
  initialLastEventId?: string

  /** Fetch implementation to use for performing requests. Defaults to `globalThis.fetch`. Throws if no implementation can be found. */
  fetch?: FetchLike

  // --- request-related follow --- //

  /** An object literal to set request's headers. */
  headers?: Record<string, string>

  /** A string to indicate whether the request will use CORS, or will be restricted to same-origin URLs. Sets request's mode. */
  mode?: 'cors' | 'no-cors' | 'same-origin'

  /** A string indicating whether credentials will be sent with the request always, never, or only when sent to a same-origin URL. Sets request's credentials. */
  credentials?: 'include' | 'omit' | 'same-origin'

  /** A BodyInit object or null to set request's body. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body?: any

  /** A string to set request's method. */
  method?: string

  /** A string indicating whether request follows redirects, results in an error upon encountering a redirect, or returns the redirect (in an opaque fashion). Sets request's redirect. */
  redirect?: 'error' | 'follow'

  /** A string whose value is a same-origin URL, "about:client", or the empty string, to set request's referrer. */
  referrer?: string

  /** A referrer policy to set request's referrerPolicy. */
  referrerPolicy?: ReferrerPolicy
}

/**
 * Stripped down version of `fetch()`, only defining the parts we care about.
 * This ensures it should work with "most" fetch implementations.
 *
 * @public
 */
export type FetchLike = (url: string | URL, init?: FetchLikeInit) => Promise<FetchLikeResponse>

/**
 * Stripped down version of `RequestInit`, only defining the parts we care about.
 *
 * @public
 */
export interface FetchLikeInit {
  /** A string to set request's method. */
  method?: string

  /** An AbortSignal to set request's signal. Typed as `any` because of polyfill inconsistencies. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  signal?: {aborted: boolean} | any

  /** A Headers object, an object literal, or an array of two-item arrays to set request's headers. */
  headers?: Record<string, string>

  /** A string to indicate whether the request will use CORS, or will be restricted to same-origin URLs. Sets request's mode. */
  mode?: 'cors' | 'no-cors' | 'same-origin'

  /** A string indicating whether credentials will be sent with the request always, never, or only when sent to a same-origin URL. Sets request's credentials. */
  credentials?: 'include' | 'omit' | 'same-origin'

  /** Controls how the request is cached. */
  cache?: 'no-store'

  /** Request body. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body?: any

  /** A string indicating whether request follows redirects, results in an error upon encountering a redirect, or returns the redirect (in an opaque fashion). Sets request's redirect. */
  redirect?: 'error' | 'follow'

  /** A string whose value is a same-origin URL, "about:client", or the empty string, to set request's referrer. */
  referrer?: string

  /** A referrer policy to set request's referrerPolicy. */
  referrerPolicy?: ReferrerPolicy
}

/**
 * Minimal version of the `Response` type returned by `fetch()`.
 *
 * @public
 */
export interface FetchLikeResponse {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly body: NodeJS.ReadableStream | NodeWebReadableStream<any> | Response['body'] | null
  readonly url: string
  readonly status: number
  readonly redirected: boolean
}

/**
 * Re-export of `EventSourceMessage` from `eventsource-parser`.
 */
export {EventSourceMessage}
