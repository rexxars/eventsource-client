import {Readable} from 'node:stream'

import type {EnvAbstractions} from './abstractions.js'
import {createEventSource as createSource} from './client.js'
import type {EventSourceClient, EventSourceOptions} from './types.js'

export * from './constants.js'
export * from './types.js'

const nodeAbstractions: EnvAbstractions = {
  getStream,
}

/**
 * Creates a new EventSource client.
 *
 * @param options - Options for the client, or an URL/URL string.
 * @returns A new EventSource client instance
 * @public
 */
export function createEventSource(
  optionsOrUrl: EventSourceOptions | URL | string,
): EventSourceClient {
  return createSource(optionsOrUrl, nodeAbstractions)
}

/**
 * Returns a ReadableStream (Web Stream) from either an existing ReadableStream,
 * or a node.js Readable stream. Ensures that it works with more `fetch()` polyfills.
 *
 * @param body - The body to convert
 * @returns A ReadableStream
 * @private
 */
function getStream(
  body: NodeJS.ReadableStream | ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  if ('getReader' in body) {
    // Already a web stream
    return body
  }

  if (typeof body.pipe !== 'function' || typeof body.on !== 'function') {
    throw new Error('Invalid response body, expected a web or node.js stream')
  }

  // Available as of Node 17, and module requires Node 18
  if (typeof Readable.toWeb !== 'function') {
    throw new Error('Node.js 18 or higher required (`Readable.toWeb()` not defined)')
  }

  // @todo Figure out if we can prevent casting
  return Readable.toWeb(Readable.from(body)) as ReadableStream<Uint8Array>
}
