// Realtime WebSocket service. Runs as its own process (separate from the Next.js web
// app) so it can hold long-lived connections + in-memory room state independently.
// Behind nginx, /ws is routed here; the web app and this service share an origin.
import { createServer } from 'node:http'
import { WebSocketServer } from 'ws'
import { handleClose, handleMessage, type Connection } from './rooms'

const PORT = Number(process.env.PORT || 7243)

// A bare HTTP server so we can also answer health checks; WS upgrades on /ws.
const httpServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'text/plain' })
    res.end('ok')
    return
  }
  res.writeHead(404)
  res.end()
})

const wss = new WebSocketServer({ server: httpServer, path: '/ws' })

wss.on('connection', (ws) => {
  const conn: Connection = { myId: null, myRoom: null }
  ws.on('message', (raw) => handleMessage(conn, ws, raw.toString()))
  ws.on('close', () => handleClose(conn))
})

httpServer.listen(PORT, () => {
  console.log(`[deviation] realtime ws server on :${PORT} (path /ws)`)
})
