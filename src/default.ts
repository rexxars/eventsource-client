import type {EnvAbstractions} from './abstractions'
import type {EventSourceClient, EventSourceOptions} from './types'
import {createEventSource as createSource} from './client'

export * from './types'
export * from './constants'

/**
 * Default "abstractions", eg when all the APIs are globally available
 */
const defaultAbstractions: EnvAbstractions = {
  getStream,
}

/**
 * Creates a new EventSource client.
 *
 * @param options - Options for the client
 * @returns A new EventSource client instance
 * @public
 */
export function createEventSource(options: EventSourceOptions): EventSourceClient {
  return createSource(options, defaultAbstractions)
}

/**
 * Returns a ReadableStream (Web Stream) from either an existing ReadableStream.
 * Only defined because of environment abstractions - is actually a 1:1 (passthrough).
 *
 * @param body - The body to convert
 * @returns A ReadableStream
 * @private
 */
function getStream(
  body: NodeJS.ReadableStream | ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  if (!(body instanceof ReadableStream)) {
    throw new Error('Invalid stream, expected a web ReadableStream')
  }

  return body
}
