'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Marquee } from '@/components/Marquee'
import { PlayerRail } from '@/components/PlayerRail'
import { ConfidenceBar } from '@/components/ConfidenceBar'
import { DrawCanvas, type DrawCanvasHandle } from '@/components/DrawCanvas'
import { Multiplayer } from '@/components/Multiplayer'
import { askAI, categories, pickRound } from '@/lib/game'
import type { AIGuess, Category, Phase, Round } from '@deviation/shared'

const DRAW_SECONDS = 60

export default function App() {
  const [mode, setMode] = useState<'menu' | 'solo' | 'multi'>('menu')
  const [joinCode, setJoinCode] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('home')
  const [category, setCategory] = useState<Category>(categories[0])
  const [round, setRound] = useState<Round | null>(null)
  const [roundNo, setRoundNo] = useState(1)
  const [timeLeft, setTimeLeft] = useState(DRAW_SECONDS)
  const [ai, setAI] = useState<AIGuess | null>(null)
  const [humanScore, setHumanScore] = useState(0)
  const [aiScore, setAiScore] = useState(0)

  const canvasRef = useRef<DrawCanvasHandle>(null)

  // Deep link: opening /?room=CODE jumps straight into multiplayer (code is prefilled there).
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('room')) setMode('multi')
  }, [])

  const startRound = useCallback((cat: Category) => {
    setCategory(cat)
    setRound(pickRound(cat))
    setAI(null)
    setTimeLeft(DRAW_SECONDS)
    setPhase('draw')
    setTimeout(() => canvasRef.current?.clear(), 0)
  }, [])

  const submit = useCallback(async () => {
    if (!round || !canvasRef.current) return
    const image = canvasRef.current.toDataURL()
    setPhase('thinking')
    const guess = await askAI(image, round)
    const humanWon = guess.guess !== round.target
    setAI(guess)
    if (humanWon) setHumanScore((s) => s + 1)
    else setAiScore((s) => s + 1)
    setPhase('reveal')
  }, [round])

  // draw-phase countdown
  useEffect(() => {
    if (phase !== 'draw') return
    if (timeLeft <= 0) {
      void submit()
      return
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, timeLeft, submit])

  const players = [
    { name: '你（人类队）', emoji: '🧑‍🎨', score: humanScore },
    { name: 'AI 对手', emoji: '🤖', isAI: true, score: aiScore },
  ]

  return (
    <div className="flex min-h-full flex-col">
      <Marquee />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {mode === 'menu' && (
          <Menu
            onSolo={() => setMode('solo')}
            onMulti={() => {
              setJoinCode(null)
              setMode('multi')
            }}
            onJoinRoom={(code) => {
              setJoinCode(code)
              setMode('multi')
            }}
          />
        )}

        {mode === 'multi' && <Multiplayer initialCode={joinCode} onExit={() => setMode('menu')} />}

        {mode === 'solo' && phase === 'home' && (
          <div>
            <button onClick={() => setMode('menu')} className="mb-2 font-cn text-ink/50 underline">
              ← 返回
            </button>
            <Home onStart={startRound} />
          </div>
        )}

        {mode === 'solo' && phase !== 'home' && round && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-[200px_1fr]">
            <PlayerRail players={players} round={roundNo} />

            <div className="flex flex-col gap-4">
              {/* prompt / category header */}
              <div className="flex items-center justify-between">
                <div className="font-cn text-xl">
                  类别 <span className="ink-box bg-orange/15 px-3 py-1">{round.category.label}</span>
                </div>
                {phase === 'draw' && (
                  <div className={`font-hand text-3xl font-bold ${timeLeft <= 10 ? 'text-orange' : ''}`}>
                    ⏱ {timeLeft}s
                  </div>
                )}
              </div>

              {phase === 'draw' && (
                <DrawTask round={round} canvasRef={canvasRef} onSubmit={() => void submit()} />
              )}

              {phase === 'thinking' && <Thinking />}

              {phase === 'reveal' && ai && (
                <Reveal
                  round={round}
                  ai={ai}
                  humanWon={ai.guess !== round.target}
                  onNext={() => {
                    setRoundNo((n) => n + 1)
                    startRound(category)
                  }}
                  onChangeCat={() => setPhase('home')}
                />
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="border-t-[3px] border-ink/20 py-3 text-center font-hand text-sm text-ink/50">
        画得人懂、AI 不懂，你就赢了 · made for the hackathon
      </footer>
    </div>
  )
}

function Menu({
  onSolo,
  onMulti,
  onJoinRoom,
}: {
  onSolo: () => void
  onMulti: () => void
  onJoinRoom: (code: string) => void
}) {
  return (
    <div className="mx-auto max-w-2xl py-8 text-center">
      <h1 className="font-hand text-6xl font-bold tracking-tight">DEVIATION GAME</h1>
      <p className="mt-3 font-cn text-2xl">骗过 AI · 人机斗智你画我猜</p>
      <div className="ink-box mx-auto mt-6 max-w-xl bg-paper-deep/60 px-5 py-4 font-cn text-lg leading-relaxed">
        给你一个词，<b>画得让人恍然大悟，但 AI 一脸懵逼</b>。
        <br />
        AI 猜对 → <b className="text-orange">HUMANS LOSE</b>；AI 猜错 → <b className="text-orange">HUMANS WIN</b>。
        <br />
        靠抽象、梗、留白和反常识去糊弄 AI 吧！
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <button
          onClick={onMulti}
          className="ink-box bg-orange px-6 py-6 font-cn text-2xl text-white shadow-[5px_6px_0_rgba(43,38,34,0.2)] transition hover:-translate-y-0.5"
        >
          👥 多人房间
          <div className="mt-1 font-cn text-base opacity-90">和朋友 + AI 一起玩</div>
        </button>
        <button
          onClick={onSolo}
          className="ink-box bg-white px-6 py-6 font-cn text-2xl shadow-[5px_6px_0_rgba(43,38,34,0.15)] transition hover:-translate-y-0.5"
        >
          🧑‍🎨 单人练习
          <div className="mt-1 font-cn text-base text-ink/60">独自挑战 AI</div>
        </button>
      </div>

      <ActiveRooms onJoin={onJoinRoom} />
    </div>
  )
}

interface RoomSummary {
  code: string
  phase: 'lobby' | 'draw' | 'reveal'
  roundNo: number
  players: number
  category: string | null
}

function ActiveRooms({ onJoin }: { onJoin: (code: string) => void }) {
  const [rooms, setRooms] = useState<RoomSummary[] | null>(null)

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const res = await fetch('/api/rooms', { cache: 'no-store' })
        if (!res.ok) return
        const data = (await res.json()) as RoomSummary[]
        if (alive) setRooms(data)
      } catch {
        /* ignore transient errors */
      }
    }
    void load()
    const t = setInterval(load, 5000) // refresh so finished rooms drop off
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [])

  if (rooms === null) return null // initial load — show nothing yet
  return (
    <div className="mx-auto mt-10 max-w-md text-left">
      <div className="font-cn text-lg text-ink/60">🟢 当前活跃房间</div>
      {rooms.length === 0 ? (
        <div className="mt-2 font-cn text-ink/40">暂无进行中的房间，创建一个吧～</div>
      ) : (
        <div className="mt-2 grid gap-2">
          {rooms.map((r) => (
            <button
              key={r.code}
              onClick={() => onJoin(r.code)}
              className="ink-box flex items-center justify-between bg-white px-4 py-3 font-cn transition hover:-translate-y-0.5 hover:bg-paper-deep"
            >
              <span className="flex items-baseline gap-2">
                <b className="font-hand text-2xl tracking-widest">{r.code}</b>
                <span className="text-sm text-ink/50">
                  {r.phase === 'lobby' ? '等待中' : `第 ${r.roundNo} 局${r.category ? ` · ${r.category}` : ''}`}
                </span>
              </span>
              <span className="text-sm text-ink/60">👤 {r.players} · 加入 →</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Home({ onStart }: { onStart: (c: Category) => void }) {
  return (
    <div className="mx-auto max-w-2xl py-6 text-center">
      <h1 className="font-hand text-6xl font-bold tracking-tight">DEVIATION GAME</h1>
      <p className="mt-3 font-cn text-2xl">骗过 AI · 人机斗智你画我猜</p>
      <div className="ink-box mx-auto mt-6 max-w-xl bg-paper-deep/60 px-5 py-4 text-left font-cn text-lg leading-relaxed">
        给你一个词，<b>画得让人一眼就懂、但 AI 猜不出来</b>。
        <br />
        AI 猜对 → <b className="text-orange">HUMANS LOSE</b>；AI 猜错 → 你赢 🎉
        <br />
        靠抽象、梗、留白和反常识去糊弄那台机器吧。
      </div>
      <p className="mt-6 font-cn text-xl">选个类别开局：</p>
      <div className="mt-3 flex flex-wrap justify-center gap-3">
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => onStart(c)}
            className="ink-box bg-white px-5 py-3 font-cn text-xl shadow-[4px_5px_0_rgba(43,38,34,0.18)] transition hover:-translate-y-0.5 hover:bg-orange hover:text-white active:translate-y-0"
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function DrawTask({
  round,
  canvasRef,
  onSubmit,
}: {
  round: Round
  canvasRef: React.RefObject<DrawCanvasHandle | null>
  onSubmit: () => void
}) {
  return (
    <>
      <div className="ink-box flex items-center justify-center gap-3 bg-orange px-4 py-3 text-white shadow-[4px_5px_0_rgba(43,38,34,0.2)]">
        <span className="font-cn text-lg opacity-90">你要画的是</span>
        <span className="font-hand text-4xl font-bold tracking-wide">{round.target}</span>
      </div>
      <DrawCanvas ref={canvasRef} />
      <div className="flex items-center justify-between gap-3">
        <p className="font-cn text-base text-ink/60">提示：别画得太「标准」，标准的画 AI 最爱猜 😈</p>
        <button
          onClick={onSubmit}
          className="ink-box bg-ink px-6 py-3 font-cn text-xl text-paper shadow-[4px_5px_0_rgba(232,116,59,0.5)] transition hover:-translate-y-0.5 active:translate-y-0"
        >
          交给 AI 猜 →
        </button>
      </div>
    </>
  )
}

function Thinking() {
  return (
    <div className="ink-box-dashed flex h-[420px] flex-col items-center justify-center gap-4 bg-white/60">
      <div className="animate-pulse font-hand text-5xl">🤖 . . .</div>
      <div className="font-cn text-2xl">AI 正在盯着你的画苦苦思考…</div>
    </div>
  )
}

function Reveal({
  round,
  ai,
  humanWon,
  onNext,
  onChangeCat,
}: {
  round: Round
  ai: AIGuess
  humanWon: boolean
  onNext: () => void
  onChangeCat: () => void
}) {
  return (
    <div className="relative">
      <div
        className={`animate-stamp pointer-events-none absolute -top-2 left-1/2 z-10 -translate-x-1/2 font-hand text-5xl font-bold ${
          humanWon ? 'text-win' : 'text-orange'
        }`}
        style={{ textShadow: '3px 3px 0 rgba(43,38,34,0.18)' }}
      >
        {humanWon ? 'HUMANS WIN!' : 'HUMANS LOSE'}
      </div>

      <div className="ink-box mt-10 bg-white/70 p-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <div className="font-cn text-lg text-ink/60">正确答案</div>
            <div className="font-hand text-4xl font-bold">{round.target}</div>
            <div className="mt-3 font-cn text-lg text-ink/60">AI 的猜测</div>
            <div className={`font-hand text-4xl font-bold ${humanWon ? 'text-win' : 'text-orange'}`}>
              {ai.guess} {humanWon ? '❌' : '✅'}
            </div>
            {ai.reasoning && <div className="mt-2 font-cn text-base text-ink/60">AI：「{ai.reasoning}」</div>}
            {ai.mock && (
              <div className="mt-1 font-cn text-sm text-orange/80">
                ⚠️ mock 模式：配置 ANTHROPIC_API_KEY 后 AI 才会真的看图
              </div>
            )}
          </div>
          <div className="flex flex-col justify-center gap-3">
            <ConfidenceBar value={ai.confidence} />
            <div className="ink-box bg-paper-deep/50 px-3 py-2 text-center font-cn text-lg">
              {humanWon ? '🎉 你成功骗过了 AI！' : '😵 被 AI 看穿了…下一局画得更鬼一点'}
            </div>
            {round.options && (
              <div className="font-cn text-sm text-ink/50">候选词：{round.options.join(' / ')}</div>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <button
            onClick={onChangeCat}
            className="ink-box bg-white px-5 py-2.5 font-cn text-lg hover:bg-paper-deep"
          >
            换类别
          </button>
          <button
            onClick={onNext}
            className="ink-box bg-orange px-6 py-2.5 font-cn text-lg text-white shadow-[4px_5px_0_rgba(43,38,34,0.2)] transition hover:-translate-y-0.5 active:translate-y-0"
          >
            下一局 →
          </button>
        </div>
      </div>
    </div>
  )
}
