import type {EnvAbstractions} from './abstractions.js'
import {createEventSource as createSource} from './client.js'
import type {EventSourceClient, EventSourceOptions} from './types.js'

export * from './constants.js'
export * from './types.js'

/**
 * Default "abstractions", eg when all the APIs are globally available
 */
const defaultAbstractions: EnvAbstractions = {
  getStream,
}

/**
 * Creates a new EventSource client.
 *
 * @param optionsOrUrl - Options for the client, or an URL/URL string.
 * @returns A new EventSource client instance
 * @public
 */
export function createEventSource(
  optionsOrUrl: EventSourceOptions | URL | string,
): EventSourceClient {
  return createSource(optionsOrUrl, defaultAbstractions)
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
