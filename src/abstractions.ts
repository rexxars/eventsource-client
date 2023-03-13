import type {ReadableStream as NodeWebReadableStream} from 'node:stream/web'
import type {EventSourceMessage} from './types'

/**
 * Internal abstractions over environment-specific APIs, to keep node-specifics
 * out of browser bundles and vice versa.
 *
 * @internal
 */
export interface EnvAbstractions {
  getStream(
    body: NodeJS.ReadableStream | NodeWebReadableStream<Uint8Array>
  ): NodeWebReadableStream<Uint8Array>
  getStream(body: ReadableStream<Uint8Array>): ReadableStream<Uint8Array>
  getStream(
    body: NodeJS.ReadableStream | NodeWebReadableStream<Uint8Array> | ReadableStream<Uint8Array>
  ): NodeWebReadableStream<Uint8Array> | ReadableStream<Uint8Array>

  getTextDecoderStream(encoding: 'utf-8'): TextDecoderStream
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
    | PromiseLike<IteratorResult<EventSourceMessage, void>>
) => void
