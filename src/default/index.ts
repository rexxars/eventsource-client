import {createEventSource as createSource, EnvAbstractions} from '../client'
import type {EventSourceClient, EventSourceOptions} from '../types'

export * from '../types'

/**
 * Default "abstractions", eg when all the APIs are globally available
 */
const defaultAbstractions: EnvAbstractions = {
  getStream(body) {
    return body as ReadableStream
  },
  getTextDecoderStream(encoding) {
    return new TextDecoderStream(encoding)
  },
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
