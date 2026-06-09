// Shared types — the single source of truth for both the web app and the realtime
// service. Game types, the AI guess shape, and the realtime wire protocol all live here.

export interface Category {
  id: string
  label: string
  words: string[]
}

export interface Round {
  category: Category
  target: string
  /** Multiple-choice options shown to the AI (and to human guessers in MP mode). */
  options: string[]
}

export interface AIGuess {
  guess: string
  confidence: number
  reasoning: string
  mock?: boolean
  error?: string
}

export type Phase = 'home' | 'draw' | 'thinking' | 'reveal'

// ---- realtime wire protocol ----

export interface Stroke {
  x0: number
  y0: number
  x1: number
  y1: number
  color: string
  size: number
  erase?: boolean
}

export interface NetPlayer {
  id: string
  name: string
  emoji: string
  score: number
  connected: boolean
  isDrawer?: boolean
  isAI?: boolean
  guessed?: boolean
}

export interface AIGuessInfo {
  guess: string
  confidence: number
  reasoning: string
  mock?: boolean
}

/** The per-viewer public room snapshot pushed by the realtime server. */
export interface RoomState {
  code: string
  phase: 'lobby' | 'draw' | 'reveal'
  roundNo: number
  hostId: string
  drawerId: string | null
  youAreDrawer: boolean
  category: { id: string; label: string } | null
  options: string[]
  target: string | null
  players: NetPlayer[]
  yourGuess: string | null
  winnerId: string | null
  aiGuess: AIGuessInfo | null
  guesses: Record<string, string>
  aiScore: number
}

/** Client → server messages. */
export type ClientMessage =
  | { t: 'create'; name: string; clientId?: string }
  | { t: 'join'; code: string; name: string; clientId?: string }
  | { t: 'start'; category: string }
  | { t: 'stroke'; stroke: Stroke }
  | { t: 'clear' }
  | { t: 'guess'; choice: string }
  | { t: 'submitDrawing'; image: string }
  | { t: 'next' }

/** Server → client messages. */
export type ServerMessage =
  | { t: 'joined'; id: string; code: string }
  | { t: 'state'; room: RoomState }
  | { t: 'stroke'; stroke: Stroke }
  | { t: 'clear' }
  | { t: 'replay'; strokes: Stroke[] }
  | { t: 'error'; message: string }
