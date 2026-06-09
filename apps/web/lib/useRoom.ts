import { useCallback, useEffect, useRef, useState } from 'react'
import type { RoomState, ServerMessage, Stroke } from '@deviation/shared'

interface DrawHandlers {
  onStroke?: (s: Stroke) => void
  onClear?: () => void
  onReplay?: (s: Stroke[]) => void
}

function wsUrl(): string {
  // 1. Explicit absolute override (rarely needed).
  const explicit = process.env.NEXT_PUBLIC_WS_URL
  if (explicit) return explicit
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  // 2. Dev: realtime runs on a separate port. Derive the host from the page so LAN
  //    devices (http://<host-ip>:7242) connect to ws://<host-ip>:7243 — not their own localhost.
  const devPort = process.env.NEXT_PUBLIC_WS_PORT
  if (devPort) return `${proto}://${location.hostname}:${devPort}/ws`
  // 3. Prod: same-origin /ws (nginx routes it to the realtime service).
  return `${proto}://${location.host}/ws`
}

export function useRoom() {
  const wsRef = useRef<WebSocket | null>(null)
  const drawHandlers = useRef<DrawHandlers>({})
  const [status, setStatus] = useState<'idle' | 'connecting' | 'inroom' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [myId, setMyId] = useState<string | null>(null)
  const [room, setRoom] = useState<RoomState | null>(null)

  const connect = useCallback((onOpen: (ws: WebSocket) => void) => {
    const ws = new WebSocket(wsUrl())
    wsRef.current = ws
    setStatus('connecting')
    ws.onopen = () => onOpen(ws)
    ws.onerror = () => {
      setError('连接失败')
      setStatus('error')
    }
    ws.onclose = () => {
      setStatus((s) => (s === 'inroom' ? 'error' : s))
      setError((e) => e ?? '连接断开')
    }
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data) as ServerMessage
      switch (msg.t) {
        case 'joined':
          setMyId(msg.id)
          setStatus('inroom')
          break
        case 'state':
          setRoom(msg.room)
          break
        case 'stroke':
          drawHandlers.current.onStroke?.(msg.stroke)
          break
        case 'clear':
          drawHandlers.current.onClear?.()
          break
        case 'replay':
          drawHandlers.current.onReplay?.(msg.strokes)
          break
        case 'error':
          setError(msg.message)
          break
      }
    }
  }, [])

  const send = useCallback((msg: object) => {
    const ws = wsRef.current
    if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg))
  }, [])

  const create = useCallback(
    (name: string) => connect((ws) => ws.send(JSON.stringify({ t: 'create', name }))),
    [connect],
  )
  const join = useCallback(
    (code: string, name: string) => connect((ws) => ws.send(JSON.stringify({ t: 'join', code, name }))),
    [connect],
  )

  const setDrawHandlers = useCallback((h: DrawHandlers) => {
    drawHandlers.current = h
  }, [])

  useEffect(() => () => wsRef.current?.close(), [])

  return { status, error, myId, room, create, join, send, setDrawHandlers, setError }
}
