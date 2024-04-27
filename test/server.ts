import {createHash} from 'node:crypto'
import {createReadStream} from 'node:fs'
import {createServer, type IncomingMessage, type Server, type ServerResponse} from 'node:http'
import {resolve as resolvePath} from 'node:path'

import esbuild from 'esbuild'

import {unicodeLines} from './fixtures'

export function getServer(port: number): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = createServer(onRequest)
      .on('error', reject)
      .listen(port, '::', () => resolve(server))
  })
}

function onRequest(req: IncomingMessage, res: ServerResponse) {
  // Disable Nagle's algorithm for testing
  if (res.socket) {
    res.socket.setNoDelay(true)
  }

  switch (req.url) {
    // Server-Sent Event endpoints
    case '/':
      return writeDefault(req, res)
    case '/counter':
      return writeCounter(req, res)
    case '/end-after-one':
      return writeOne(req, res)
    case '/slow-connect':
      return writeSlowConnect(req, res)
    case '/debug':
      return writeDebug(req, res)
    case '/set-cookie':
      return writeCookies(req, res)
    case '/authed':
      return writeAuthed(req, res)
    case '/cors':
      return writeCors(req, res)
    case '/stalled':
      return writeStalledConnection(req, res)
    case '/trickle':
      return writeTricklingConnection(req, res)
    case '/unicode':
      return writeUnicode(req, res)

    // Browser test endpoints (HTML/JS)
    case '/browser-test':
      return writeBrowserTestPage(req, res)
    case '/browser-test.js':
      return writeBrowserTestScript(req, res)

    // Fallback, eg 404
    default:
      return writeFallback(req, res)
  }
}

function writeDefault(_req: IncomingMessage, res: ServerResponse) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })

  res.write(
    formatEvent({
      event: 'welcome',
      data: 'Hello, world!',
    }),
  )

  // For some reason, Bun seems to need this to flush
  res.write(':\n')
}

/**
 * Writes 3 messages, then closes connection.
 * Picks up event ID and continues from there.
 */
async function writeCounter(req: IncomingMessage, res: ServerResponse) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })

  res.write(formatEvent({retry: 50, data: ''}))

  let counter = parseInt(getLastEventId(req) || '0', 10)
  for (let i = 0; i < 3; i++) {
    counter++
    res.write(
      formatEvent({
        event: 'counter',
        data: `Counter is at ${counter}`,
        id: `${counter}`,
      }),
    )
    await delay(25)
  }

  res.end()
}

function writeOne(req: IncomingMessage, res: ServerResponse) {
  const last = getLastEventId(req)
  res.writeHead(last ? 204 : 200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })

  if (!last) {
    res.write(formatEvent({retry: 50, data: ''}))
    res.write(
      formatEvent({
        event: 'progress',
        data: '100%',
        id: 'prct-100',
      }),
    )
  }

  res.end()
}

async function writeSlowConnect(_req: IncomingMessage, res: ServerResponse) {
  await delay(200)

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })

  res.write(
    formatEvent({
      event: 'welcome',
      data: 'That was a slow connect, was it not?',
    }),
  )

  res.end()
}

async function writeStalledConnection(req: IncomingMessage, res: ServerResponse) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })

  const lastId = getLastEventId(req)
  const reconnected = lastId === '1'

  res.write(
    formatEvent({
      id: reconnected ? '2' : '1',
      event: 'welcome',
      data: reconnected
        ? 'Welcome back'
        : 'Connected - now I will sleep for "too long" without sending data',
    }),
  )

  if (reconnected) {
    await delay(250)
    res.write(
      formatEvent({
        id: '3',
        event: 'success',
        data: 'You waited long enough!',
      }),
    )

    res.end()
  }

  // Intentionally not closing on first-connect that never sends data after welcome
}

async function writeUnicode(_req: IncomingMessage, res: ServerResponse) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })

  res.write(
    formatEvent({
      event: 'welcome',
      data: 'Connected - I will now send some chonks (cuter chunks) with unicode',
    }),
  )

  res.write(
    formatEvent({
      event: 'unicode',
      data: unicodeLines[0],
    }),
  )

  await delay(100)

  // Start of a valid SSE chunk
  res.write('event: unicode\ndata: ')

  // Write "Espen ❤️ Kokos" in two halves:
  // 1st: Espen � [..., 226, 153]
  // 2st: � Kokos [165, 32, ...]
  res.write(new Uint8Array([69, 115, 112, 101, 110, 32, 226, 153]))

  // Give time to the client to process the first half
  await delay(1000)

  res.write(new Uint8Array([165, 32, 75, 111, 107, 111, 115]))

  // Closing end of packet
  res.write('\n\n\n\n')

  res.write(formatEvent({event: 'disconnect', data: 'Thanks for listening'}))
  res.end()
}

async function writeTricklingConnection(_req: IncomingMessage, res: ServerResponse) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })

  res.write(
    formatEvent({
      event: 'welcome',
      data: 'Connected - now I will keep sending "comments" for a while',
    }),
  )

  for (let i = 0; i < 60; i++) {
    await delay(500)
    res.write(':\n')
  }

  res.write(formatEvent({event: 'disconnect', data: 'Thanks for listening'}))
  res.end()
}

function writeCors(req: IncomingMessage, res: ServerResponse) {
  const origin = req.headers.origin
  const cors = origin ? {'Access-Control-Allow-Origin': origin} : {}

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    ...cors,
  })

  res.write(
    formatEvent({
      event: 'origin',
      data: origin || '<none>',
    }),
  )

  res.end()
}

async function writeDebug(req: IncomingMessage, res: ServerResponse) {
  const hash = new Promise<string>((resolve, reject) => {
    const bodyHash = createHash('sha256')
    req.on('error', reject)
    req.on('data', (chunk) => bodyHash.update(chunk))
    req.on('end', () => resolve(bodyHash.digest('hex')))
  })

  let bodyHash: string
  try {
    bodyHash = await hash
  } catch (err: unknown) {
    res.writeHead(500, 'Internal Server Error')
    res.write(err instanceof Error ? err.message : `${err}`)
    res.end()
    return
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })

  res.write(
    formatEvent({
      event: 'debug',
      data: JSON.stringify({
        method: req.method,
        headers: req.headers,
        bodyHash,
      }),
    }),
  )

  res.end()
}

/**
 * Ideally we'd just set these in the storage state, but Playwright does not seem to
 * be able to for some obscure reason - is not set if passed in page context or through
 * `addCookies()`.
 */
function writeCookies(_req: IncomingMessage, res: ServerResponse) {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    'Set-Cookie': 'someSession=someValue; Path=/authed; HttpOnly; SameSite=Lax;',
    Connection: 'keep-alive',
  })
  res.write(JSON.stringify({cookiesWritten: true}))
  res.end()
}

function writeAuthed(req: IncomingMessage, res: ServerResponse) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })

  res.write(
    formatEvent({
      event: 'authInfo',
      data: JSON.stringify({cookies: req.headers.cookie || ''}),
    }),
  )

  res.end()
}

function writeFallback(_req: IncomingMessage, res: ServerResponse) {
  res.writeHead(404, {
    'Content-Type': 'text/plain',
    'Cache-Control': 'no-cache',
    Connection: 'close',
  })

  res.write('File not found')
  res.end()
}

function writeBrowserTestPage(_req: IncomingMessage, res: ServerResponse) {
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-cache',
    Connection: 'close',
  })

  createReadStream(resolvePath(__dirname, './browser/browser-test.html')).pipe(res)
}

async function writeBrowserTestScript(_req: IncomingMessage, res: ServerResponse) {
  res.writeHead(200, {
    'Content-Type': 'text/javascript; charset=utf-8',
    'Cache-Control': 'no-cache',
    Connection: 'close',
  })

  const build = await esbuild.build({
    bundle: true,
    target: ['chrome71', 'edge79', 'firefox105', 'safari14.1'],
    entryPoints: [resolvePath(__dirname, './browser/browser-test.ts')],
    sourcemap: 'inline',
    write: false,
    outdir: 'out',
  })

  res.write(build.outputFiles.map((file) => file.text).join('\n\n'))
  res.end()
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getLastEventId(req: IncomingMessage): string | undefined {
  const lastId = req.headers['last-event-id']
  return typeof lastId === 'string' ? lastId : undefined
}

export interface SseMessage {
  event?: string
  retry?: number
  id?: string
  data: string
}

export function formatEvent(message: SseMessage | string): string {
  const msg = typeof message === 'string' ? {data: message} : message

  let output = ''
  if (msg.event) {
    output += `event: ${msg.event}\n`
  }

  if (msg.retry) {
    output += `retry: ${msg.retry}\n`
  }

  if (typeof msg.id === 'string' || typeof msg.id === 'number') {
    output += `id: ${msg.id}\n`
  }

  output += encodeData(msg.data || '')
  output += '\n\n'

  return output
}

export function formatComment(comment: string): string {
  return `:${comment}\n\n`
}

export function encodeData(text: string): string {
  if (!text) {
    return ''
  }

  const data = String(text).replace(/(\r\n|\r|\n)/g, '\n')
  const lines = data.split(/\n/)

  let line = ''
  let output = ''

  for (let i = 0, l = lines.length; i < l; ++i) {
    line = lines[i]

    output += `data: ${line}`
    output += i + 1 === l ? '\n\n' : '\n'
  }

  return output
}
