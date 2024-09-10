# eventsource-client

[![npm version](https://img.shields.io/npm/v/eventsource-client.svg?style=flat-square)](http://npmjs.org/package/eventsource-client)[![npm bundle size](https://img.shields.io/bundlephobia/minzip/eventsource-client?style=flat-square)](https://bundlephobia.com/result?p=eventsource-client)

A modern, streaming client for [server-sent events/eventsource](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events).

## Another one?

Yes! There are indeed lots of different EventSource clients and polyfills out there. In fact, I am a co-maintainer of [the most popular one](https://github.com/eventsource/eventsource). This one is different in a few ways, however:

- Works in both Node.js and browsers with minimal amount of differences in code
- Ships with both ESM and CommonJS versions
- Uses modern APIs such as the [`fetch()` API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) and [Web Streams](https://streams.spec.whatwg.org/)
- Does **NOT** attempt to be API-compatible with the browser EventSource API:
  - Supports async iterator pattern
  - Supports any request method (POST, PATCH, DELETE etc)
  - Supports setting custom headers
  - Supports sending a request body
  - Supports configurable reconnection policies
  - Supports subscribing to any event (eg if event names are not known)
  - Supports subscribing to events named `error`
  - Supports setting initial last event ID

## Installation

```bash
npm install --save eventsource-client
```

## Supported engines

- Node.js >= 18
- Chrome >= 63
- Safari >= 11.3
- Firefox >= 65
- Edge >= 79
- Deno >= 1.30
- Bun >= 1.1.23

Basically, any environment that supports:

- [ReadableStream](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream)
- [TextDecoderStream](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoderStream)
- [Symbol.asyncIterator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/asyncIterator)

## Usage (async iterator)

```ts
import {createEventSource} from 'eventsource-client'

const es = createEventSource({
  url: 'https://my-server.com/sse',

  // your `fetch()` implementation of choice, or `globalThis.fetch` if not set
  fetch: myFetch,
})

let seenMessages = 0
for await (const {data, event, id} of es) {
  console.log('Data: %s', data)
  console.log('Event ID: %s', id) // Note: can be undefined
  console.log('Event: %s', event) // Note: can be undefined

  if (++seenMessages === 10) {
    break
  }
}

// IMPORTANT: EventSource is _not_ closed automatically when breaking out of
// loop. You must manually call `close()` to close the connection.
es.close()
```

## Usage (`onMessage` callback)

```ts
import {createEventSource} from 'eventsource-client'

const es = createEventSource({
  url: 'https://my-server.com/sse',

  onMessage: ({data, event, id}) => {
    console.log('Data: %s', data)
    console.log('Event ID: %s', id) // Note: can be undefined
    console.log('Event: %s', event) // Note: can be undefined
  },

  // your `fetch()` implementation of choice, or `globalThis.fetch` if not set
  fetch: myFetch,
})

console.log(es.readyState) // `open`, `closed` or `connecting`
console.log(es.lastEventId)

// Later, to terminate and prevent reconnections:
es.close()
```

## Minimal usage

```ts
import {createEventSource} from 'eventsource-client'

const es = createEventSource('https://my-server.com/sse')
for await (const {data} of es) {
  console.log('Data: %s', data)
}
```

## Todo

- [ ] Figure out what to do on broken connection on request body
- [ ] Configurable stalled connection detection (eg no data)
- [ ] Configurable reconnection policy
- [ ] Consider legacy build

## License

MIT © [Espen Hovlandsdal](https://espen.codes/)
