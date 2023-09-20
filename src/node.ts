import {Readable} from 'node:stream'
import {
  TextDecoderStream as NodeWebTextDecoderStream,
  ReadableStream as NodeWebReadableStream,
} from 'node:stream/web'

import {createEventSource as createSource} from './client'
import type {EventSourceClient, EventSourceOptions} from './types'
import type {EnvAbstractions} from './abstractions'

export * from './types'
export * from './constants'

const nodeAbstractions: EnvAbstractions = {
  getStream,
  getTextDecoderStream,
}

/**
 * Creates a new EventSource client.
 *
 * @param options - Options for the client
 * @returns A new EventSource client instance
 * @public
 */
export function createEventSource(options: EventSourceOptions): EventSourceClient {
  return createSource(options, nodeAbstractions)
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
  body: NodeJS.ReadableStream | NodeWebReadableStream<Uint8Array>
): NodeWebReadableStream<Uint8Array>
function getStream(body: ReadableStream<Uint8Array>): ReadableStream<Uint8Array>
function getStream(
  body: NodeJS.ReadableStream | NodeWebReadableStream<Uint8Array> | ReadableStream<Uint8Array>
): NodeWebReadableStream<Uint8Array> | ReadableStream<Uint8Array> {
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

  return Readable.toWeb(Readable.from(body))
}

/**
 * Returns a `TextDecoderStream` instance from the web streams API
 *
 * @param encoding - Should always be 'utf-8' (per eventsource spec)
 * @returns A TextDecoderStream instance
 * @private
 */
function getTextDecoderStream(encoding: 'utf-8'): TextDecoderStream {
  // @todo See if there is any way around the casting here
  return new NodeWebTextDecoderStream(encoding) as unknown as TextDecoderStream
}
