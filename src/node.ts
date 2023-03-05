import {Readable, finished} from 'node:stream'
import {
  TextDecoderStream as NodeWebTextDecoderStream,
  ReadableStream as NodeWebReadableStream,
} from 'node:stream/web'
import destroy from 'destroy'

import {createEventSource as createSource} from './client'
import type {EventSourceClient, EventSourceOptions} from './types'
import type {EnvAbstractions} from './abstractions'

export * from './types'

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
 * Code from node.js core (MIT licensed)
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

  // Available as of Node 17
  if (typeof Readable.toWeb === 'function') {
    return Readable.toWeb(Readable.from(body))
  }

  const streamReadable = body

  let controller: ReadableStreamController<Uint8Array>

  streamReadable.pause()

  const cleanup = finished(
    streamReadable,
    (error: (Error | (Error & {code?: string})) | null | undefined) => {
      let err = error
      if (err && 'code' in err && err.code === 'ERR_STREAM_PREMATURE_CLOSE') {
        err = new AbortError('The operation was aborted', err)
      }

      cleanup()

      // This is a protection against non-standard, legacy streams
      // that happen to emit an error event again after finished is called.
      streamReadable.on('error', () => {
        /* intentional noop */
      })

      if (error) {
        controller.error(error)
        return
      }

      controller.close()
    }
  )

  streamReadable.on('data', function onData(chunk) {
    if (Buffer.isBuffer(chunk)) {
      controller.enqueue(new Uint8Array(chunk))
    }

    if ((controller.desiredSize || 0) <= 0) {
      streamReadable.pause()
    }
  })

  return new NodeWebReadableStream<Uint8Array>(
    {
      start(ctrl) {
        controller = ctrl
      },

      pull() {
        streamReadable.resume()
      },

      cancel() {
        destroy(streamReadable)
      },
    },
    {highWaterMark: 16384}
  )
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

// Node uses an AbortError that isn't exactly the same as the DOMException
// to make usage of the error in userland and readable-stream easier.
// It is a regular error with `.code` and `.name`.
class AbortError extends Error {
  code: 'ABORT_ERR'
  cause?: Error
  constructor(message: string, cause: Error) {
    super(message)
    this.cause = cause
    this.code = 'ABORT_ERR'
    this.name = 'AbortError'
  }
}
