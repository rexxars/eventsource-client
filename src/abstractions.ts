import type {EventSourceMessage} from './types.js'

/**
 * Internal abstractions over environment-specific APIs, to keep node-specifics
 * out of browser bundles and vice versa.
 *
 * @internal
 */
export interface EnvAbstractions {
  getStream(body: NodeJS.ReadableStream | ReadableStream<Uint8Array>): ReadableStream<Uint8Array>
}

/**
 * Resolver function that emits an (async) event source message value.
 * Used internally by AsyncIterator implementation, not for external use.
 *
 * @internal
 */
export type EventSourceAsyncValueResolver = (
  value:
    | IteratorResult<EventSourceMessage, void>
    | PromiseLike<IteratorResult<EventSourceMessage, void>>,
) => void
