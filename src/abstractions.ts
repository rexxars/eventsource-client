import type {ReadableStream as NodeWebReadableStream} from 'node:stream/web'

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
