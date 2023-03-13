import {createReadStream} from 'node:fs'
import {resolve as resolvePath} from 'node:path'
import {createServer, type IncomingMessage, type Server, type ServerResponse} from 'node:http'
import esbuild from 'esbuild'

export function getServer(port: number): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = createServer(onRequest)
      .on('error', reject)
      .listen(port, '127.0.0.1', () => resolve(server))
  })
}

function onRequest(req: IncomingMessage, res: ServerResponse) {
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
    })
  )
}

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
      })
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
      })
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
    })
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
