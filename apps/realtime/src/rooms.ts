// Room state + game logic for the realtime service. Ported from the original
// server/index.mjs. One human draws; everyone else (other humans + the AI) races to
// guess. Whoever locks the correct answer scores; first correct = round winner.
// In-memory, single process (fine for the MVP; Redis is the later scaling path).
import type { WebSocket } from 'ws'
import {
  findCategory,
  pickRound,
  type AIGuessInfo,
  type GameMode,
  type NetPlayer,
  type RoomState,
  type ServerMessage,
  type Stroke,
} from '@deviation/shared'
import { callGuesser } from '@deviation/shared/server'

const ANIMALS = ['🐶', '🐱', '🐰', '🦊', '🐼', '🐨', '🐯', '🦁', '🐸', '🐵', '🐧', '🐙']
const AI_ID = 'ai'

interface ServerPlayer {
  id: string
  name: string
  emoji: string
  connected: boolean
  ws: WebSocket | null
  clientId: string // stable per-browser id, so a rejoin reconnects instead of duplicating
}

interface GuessRecord {
  choice: string
  ts: number
  correct: boolean
}

export interface Room {
  code: string
  order: string[] // join order of human ids -> drawer rotation
  players: Map<string, ServerPlayer>
  hostId: string | null
  drawerId: string | null
  phase: 'lobby' | 'draw' | 'reveal' | 'ended'
  roundNo: number
  category: { id: string; label: string } | null
  target: string | null
  options: string[]
  strokes: Stroke[]
  guesses: Map<string, GuessRecord>
  aiGuess: AIGuessInfo | null
  winnerId: string | null
  startedAt: number
  humanScore: number // team scores: humans (collectively) vs the AI
  aiScore: number
  mode: GameMode // how the game ends: fixed rounds, or first-to-target-score
  maxRounds: number
  targetScore: number
}

const rooms = new Map<string, Room>()

const id = () => Math.random().toString(36).slice(2, 9)
const roomCode = () => Math.random().toString(36).slice(2, 6).toUpperCase()

function makeRoom(code: string): Room {
  return {
    code,
    order: [],
    players: new Map(),
    hostId: null,
    drawerId: null,
    phase: 'lobby',
    roundNo: 0,
    category: null,
    target: null,
    options: [],
    strokes: [],
    guesses: new Map(),
    aiGuess: null,
    winnerId: null,
    startedAt: 0,
    humanScore: 0,
    aiScore: 0,
    mode: 'rounds',
    maxRounds: 6,
    targetScore: 10,
  }
}

function send(ws: WebSocket | null, msg: ServerMessage) {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg))
}

function broadcast(room: Room, msg: ServerMessage, exceptId?: string) {
  for (const p of room.players.values()) {
    if (p.id !== exceptId) send(p.ws, msg)
  }
}

// Public room view tailored per player (hide the secret target unless you're the
// drawer or we're in the reveal phase). Appends the AI as a pseudo-player.
function publicRoom(room: Room, viewerId: string): RoomState {
  const reveal = room.phase === 'reveal'
  const players: NetPlayer[] = [...room.players.values()].map((p) => ({
    id: p.id,
    name: p.name,
    emoji: p.emoji,
    connected: p.connected,
    isDrawer: p.id === room.drawerId,
    guessed: room.guesses.has(p.id),
  }))
  players.push({
    id: AI_ID,
    name: 'AI 对手',
    emoji: '🤖',
    connected: true,
    isDrawer: false,
    isAI: true,
    guessed: room.guesses.has(AI_ID),
  })
  return {
    code: room.code,
    phase: room.phase,
    roundNo: room.roundNo,
    hostId: room.hostId ?? '',
    drawerId: room.drawerId,
    youAreDrawer: viewerId === room.drawerId,
    category: room.category,
    options: room.options,
    target: viewerId === room.drawerId || reveal ? room.target : null,
    players,
    yourGuess: room.guesses.get(viewerId)?.choice ?? null,
    winnerId: reveal ? room.winnerId : null,
    aiGuess: reveal ? room.aiGuess : null,
    guesses: reveal ? Object.fromEntries([...room.guesses].map(([k, v]) => [k, v.choice])) : {},
    humanScore: room.humanScore,
    aiScore: room.aiScore,
    mode: room.mode,
    maxRounds: room.maxRounds,
    targetScore: room.targetScore,
  }
}

function pushState(room: Room) {
  for (const p of room.players.values()) {
    send(p.ws, { t: 'state', room: publicRoom(room, p.id) })
  }
}

function nextDrawer(room: Room): string | null {
  const humans = room.order.filter((pid) => room.players.has(pid))
  if (humans.length === 0) return null
  if (!room.drawerId) return humans[0]
  const idx = humans.indexOf(room.drawerId)
  return humans[(idx + 1) % humans.length]
}

function startRound(room: Room, catId?: string) {
  const cat = findCategory(catId || room.category?.id || 'object')
  const r = pickRound(cat)
  room.category = { id: cat.id, label: cat.label }
  room.target = r.target
  room.options = r.options
  room.strokes = []
  room.guesses = new Map()
  room.aiGuess = null
  room.winnerId = null
  room.phase = 'draw'
  room.roundNo += 1
  room.drawerId = nextDrawer(room)
  room.startedAt = Date.now()
  pushState(room)
}

// Start (or restart) a game: reset scores, set the end condition, deal round 1.
function startGame(room: Room, catId: string, mode: GameMode, rounds: number, target: number) {
  room.mode = mode === 'score' ? 'score' : 'rounds'
  room.maxRounds = Math.max(1, Math.min(50, Math.round(rounds) || 6))
  room.targetScore = Math.max(1, Math.min(100, Math.round(target) || 10))
  room.humanScore = 0
  room.aiScore = 0
  room.roundNo = 0
  room.drawerId = null
  startRound(room, catId)
}

function gameShouldEnd(room: Room): boolean {
  if (room.mode === 'score') {
    return room.humanScore >= room.targetScore || room.aiScore >= room.targetScore
  }
  return room.roundNo >= room.maxRounds
}

function nextRound(room: Room) {
  if (gameShouldEnd(room)) {
    endGame(room)
    return
  }
  startRound(room, room.category?.id)
}

function endGame(room: Room) {
  room.phase = 'ended'
  pushState(room)
}

// Back to the lobby for a fresh game (scores cleared, host reconfigures).
function resetToLobby(room: Room) {
  room.humanScore = 0
  room.aiScore = 0
  room.roundNo = 0
  room.drawerId = null
  room.phase = 'lobby'
  room.category = null
  room.target = null
  room.options = []
  room.strokes = []
  room.guesses = new Map()
  room.aiGuess = null
  room.winnerId = null
  pushState(room)
}

function recordGuess(room: Room, playerId: string, choice: string) {
  if (room.phase !== 'draw') return
  if (playerId === room.drawerId) return // drawer can't guess
  if (room.guesses.has(playerId)) return // one lock per round
  room.guesses.set(playerId, { choice, ts: Date.now(), correct: choice === room.target })
}

function maybeReveal(room: Room) {
  // Reveal once the AI has guessed AND every connected human guesser has locked in.
  if (!room.aiGuess) return
  const humanGuessers = [...room.players.values()].filter((p) => p.id !== room.drawerId && p.connected)
  const allLocked = humanGuessers.every((p) => room.guesses.has(p.id))
  if (!allLocked) return
  doReveal(room)
}

function doReveal(room: Room) {
  if (room.phase === 'reveal') return
  room.phase = 'reveal'

  // Did the human camp get it (any non-drawer human correct)? Did the AI?
  let humanCorrect = false
  let fastestHuman: { id: string; ts: number } | null = null
  for (const [pid, g] of room.guesses) {
    if (pid === AI_ID || !g.correct) continue
    humanCorrect = true
    if (!fastestHuman || g.ts < fastestHuman.ts) fastestHuman = { id: pid, ts: g.ts }
  }
  const aiCorrect = room.guesses.get(AI_ID)?.correct ?? false

  // Team scoring — humans (collectively) vs the AI:
  //   人类对, AI 错 → 人类 +2        画手成功"加密"
  //   人类对, AI 对 → 人类 +1, AI +1  常规，双方都得分
  //   人类错, AI 错 → 0, 0           双输，题太难
  //   人类错, AI 对 → AI +3          AI 暴击（含 bonus）
  if (humanCorrect && !aiCorrect) room.humanScore += 2
  else if (humanCorrect && aiCorrect) {
    room.humanScore += 1
    room.aiScore += 1
  } else if (!humanCorrect && aiCorrect) {
    room.aiScore += 3
  }

  // fastest correct human — cosmetic "最快猜对" highlight only, no score effect
  room.winnerId = fastestHuman?.id ?? null
  pushState(room)
}

async function runAI(room: Room, image: string) {
  const out = await callGuesser(image, room.options, room.category?.label || '')
  room.aiGuess = { guess: out.guess, confidence: out.confidence, reasoning: out.reasoning, mock: out.mock }
  room.guesses.set(AI_ID, { choice: out.guess, ts: Date.now(), correct: out.guess === room.target })
  pushState(room)
  maybeReveal(room)
}

// ---- connection handling ----
export interface Connection {
  myId: string | null
  myRoom: Room | null
}

export function handleMessage(conn: Connection, ws: WebSocket, raw: string) {
  let msg: Record<string, unknown>
  try {
    msg = JSON.parse(raw)
  } catch {
    return
  }

  if (msg.t === 'create' || msg.t === 'join') {
    const code = msg.t === 'create' ? roomCode() : String(msg.code || '').toUpperCase()
    let room = rooms.get(code)
    if (msg.t === 'create') {
      room = makeRoom(code)
      rooms.set(code, room)
    }
    if (!room) {
      send(ws, { t: 'error', message: '房间不存在' })
      return
    }
    const clientId = typeof msg.clientId === 'string' ? msg.clientId : ''
    const name = String(msg.name || '玩家').slice(0, 12)

    // Reconnect: the same browser (clientId) rejoining a room it already has a slot in —
    // reuse the existing player so the score is kept and no duplicate (greyed) card appears.
    const existing = clientId ? [...room.players.values()].find((p) => p.clientId === clientId) : undefined
    if (existing) {
      existing.connected = true
      existing.ws = ws
      existing.name = name
      conn.myId = existing.id
      conn.myRoom = room
      if (!room.hostId) room.hostId = existing.id
      send(ws, { t: 'joined', id: existing.id, code })
      if (room.strokes.length) send(ws, { t: 'replay', strokes: room.strokes })
      pushState(room)
      return
    }

    conn.myId = id()
    conn.myRoom = room
    const emoji = ANIMALS[room.players.size % ANIMALS.length]
    room.players.set(conn.myId, {
      id: conn.myId,
      name,
      emoji,
      connected: true,
      ws,
      clientId,
    })
    room.order.push(conn.myId)
    if (!room.hostId) room.hostId = conn.myId
    send(ws, { t: 'joined', id: conn.myId, code })
    if (room.strokes.length) send(ws, { t: 'replay', strokes: room.strokes })
    pushState(room)
    return
  }

  const room = conn.myRoom
  const myId = conn.myId
  if (!room || !myId) return

  switch (msg.t) {
    case 'start':
      if (myId === room.hostId) {
        const mode: GameMode = msg.mode === 'score' ? 'score' : 'rounds'
        startGame(room, String(msg.category || ''), mode, Number(msg.rounds), Number(msg.target))
      }
      break
    case 'stroke':
      if (myId === room.drawerId && room.phase === 'draw') {
        const stroke = msg.stroke as Stroke
        room.strokes.push(stroke)
        broadcast(room, { t: 'stroke', stroke }, myId)
      }
      break
    case 'clear':
      if (myId === room.drawerId) {
        room.strokes = []
        broadcast(room, { t: 'clear' }, myId)
      }
      break
    case 'guess':
      recordGuess(room, myId, String(msg.choice))
      pushState(room)
      maybeReveal(room)
      break
    case 'submitDrawing': // drawer says "done" -> AI looks at the image
      if (myId === room.drawerId && room.phase === 'draw' && !room.aiGuess) {
        void runAI(room, String(msg.image))
      }
      break
    case 'next':
      if (myId === room.hostId) nextRound(room)
      break
    case 'end':
      if (myId === room.hostId) endGame(room)
      break
    case 'lobby':
      if (myId === room.hostId) resetToLobby(room)
      break
  }
}

export interface RoomSummary {
  code: string
  phase: Room['phase']
  roundNo: number
  players: number
  category: string | null
}

/** Public list of active rooms (at least one connected human) for the homepage. */
export function listRooms(): RoomSummary[] {
  const out: RoomSummary[] = []
  for (const room of rooms.values()) {
    const players = [...room.players.values()].filter((p) => p.connected).length
    if (players === 0) continue
    out.push({
      code: room.code,
      phase: room.phase,
      roundNo: room.roundNo,
      players,
      category: room.category?.label ?? null,
    })
  }
  return out
}

export function handleClose(conn: Connection) {
  const room = conn.myRoom
  const myId = conn.myId
  if (!room || !myId) return
  const p = room.players.get(myId)
  if (p) p.connected = false
  // hand off host if needed
  if (room.hostId === myId) {
    const next = [...room.players.values()].find((x) => x.connected)
    room.hostId = next ? next.id : null
  }
  // clean up empty rooms
  const anyConnected = [...room.players.values()].some((x) => x.connected)
  if (!anyConnected) {
    rooms.delete(room.code)
    return
  }
  pushState(room)
}
