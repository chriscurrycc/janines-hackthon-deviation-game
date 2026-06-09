'use client'

import { useEffect, useRef, useState } from 'react'
import { LiveCanvas, type LiveCanvasHandle } from '@/components/LiveCanvas'
import { ConfidenceBar } from '@/components/ConfidenceBar'
import { useRoom } from '@/lib/useRoom'
import type { NetPlayer, RoomState } from '@deviation/shared'

const CATS = [
  { id: 'creature', label: '生物' },
  { id: 'object', label: '物品' },
  { id: 'food', label: '食物' },
  { id: 'action', label: '动作' },
]

export function Multiplayer({ onExit }: { onExit: () => void }) {
  const net = useRoom()
  const canvasRef = useRef<LiveCanvasHandle>(null)

  // wire incoming draw events to the watcher canvas
  useEffect(() => {
    net.setDrawHandlers({
      onStroke: (s) => canvasRef.current?.applyStroke(s),
      onClear: () => canvasRef.current?.clearLocal(),
      onReplay: (arr) => canvasRef.current?.replay(arr),
    })
  }, [net])

  // clear the board at the start of each round
  const room = net.room
  const roundNo = room?.roundNo ?? 0
  useEffect(() => {
    canvasRef.current?.clearLocal()
  }, [roundNo])

  if (net.status !== 'inroom' || !room) {
    return <JoinScreen net={net} onExit={onExit} />
  }
  return <RoomView net={net} room={room} canvasRef={canvasRef} onExit={onExit} />
}

function JoinScreen({ net, onExit }: { net: ReturnType<typeof useRoom>; onExit: () => void }) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  return (
    <div className="mx-auto max-w-md py-8 text-center">
      <h2 className="font-hand text-4xl font-bold">多人房间</h2>
      <p className="mt-2 font-cn text-lg text-ink/60">一人画，其他人和 AI 一起抢答，谁先猜对谁赢</p>
      {net.error && <div className="mt-3 font-cn text-orange">{net.error}</div>}
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="你的昵称"
        maxLength={12}
        className="ink-box mt-5 w-full bg-white px-4 py-3 text-center font-cn text-xl outline-none"
      />
      <button
        onClick={() => name.trim() && net.create(name.trim())}
        disabled={!name.trim()}
        className="ink-box mt-4 w-full bg-orange px-4 py-3 font-cn text-xl text-white shadow-[4px_5px_0_rgba(43,38,34,0.2)] disabled:opacity-40"
      >
        🆕 创建房间
      </button>
      <div className="mt-6 font-cn text-ink/40">— 或 加入已有房间 —</div>
      <div className="mt-3 flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="房间码"
          maxLength={4}
          className="ink-box w-32 bg-white px-3 py-3 text-center font-hand text-2xl tracking-widest outline-none"
        />
        <button
          onClick={() => name.trim() && code.trim() && net.join(code.trim(), name.trim())}
          disabled={!name.trim() || code.length < 4}
          className="ink-box flex-1 bg-ink px-4 py-3 font-cn text-xl text-paper disabled:opacity-40"
        >
          加入 →
        </button>
      </div>
      <button onClick={onExit} className="mt-6 font-cn text-ink/50 underline">
        ← 返回
      </button>
    </div>
  )
}

function nameOf(players: NetPlayer[], id: string | null) {
  if (!id) return ''
  if (id === 'ai') return 'AI 对手'
  return players.find((p) => p.id === id)?.name ?? '某人'
}

function RoomView({
  net,
  room,
  canvasRef,
  onExit,
}: {
  net: ReturnType<typeof useRoom>
  room: RoomState
  canvasRef: React.RefObject<LiveCanvasHandle | null>
  onExit: () => void
}) {
  const isHost = net.myId === room.hostId
  const drawer = nameOf(room.players, room.drawerId)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    setSubmitted(false)
  }, [room.roundNo])

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[210px_1fr]">
      {/* left rail */}
      <div className="flex flex-col gap-3">
        <div className="ink-box bg-paper-deep/50 px-3 py-2 text-center">
          <div className="font-cn text-sm text-ink/60">房间码</div>
          <div className="font-hand text-3xl font-bold tracking-[0.3em]">{room.code}</div>
        </div>
        <div className="font-cn text-ink/60">第 {room.roundNo || '-'} 局</div>
        {room.players.map((p) => (
          <PlayerCard key={p.id} p={p} winner={room.winnerId === p.id} />
        ))}
        <button onClick={onExit} className="mt-2 font-cn text-sm text-ink/40 underline">
          ← 离开房间
        </button>
      </div>

      {/* main */}
      <div className="flex flex-col gap-4">
        {room.phase === 'lobby' && <Lobby net={net} room={room} isHost={isHost} />}

        {room.phase !== 'lobby' && (
          <>
            <div className="flex items-center justify-between">
              <div className="font-cn text-xl">
                类别 <span className="ink-box bg-orange/15 px-3 py-1">{room.category?.label}</span>
              </div>
              {room.youAreDrawer ? (
                <div className="ink-box bg-orange px-4 py-1.5 font-cn text-lg text-white">
                  你画：<b className="font-hand text-2xl">{room.target}</b>
                </div>
              ) : (
                <div className="font-cn text-lg text-ink/60">✏️ {drawer} 正在画…</div>
              )}
            </div>

            <LiveCanvas
              ref={canvasRef}
              mode={room.youAreDrawer && room.phase === 'draw' ? 'draw' : 'watch'}
              onStroke={(s) => net.send({ t: 'stroke', stroke: s })}
              onClear={() => net.send({ t: 'clear' })}
            />

            {room.phase === 'draw' && room.youAreDrawer && (
              <div className="flex items-center justify-between gap-3">
                <p className="font-cn text-base text-ink/60">画得人懂、AI 懵 😈 画好了就喊 AI 来猜</p>
                <button
                  disabled={submitted}
                  onClick={() => {
                    setSubmitted(true)
                    net.send({ t: 'submitDrawing', image: canvasRef.current?.toDataURL() })
                  }}
                  className="ink-box bg-ink px-6 py-3 font-cn text-xl text-paper shadow-[4px_5px_0_rgba(232,116,59,0.5)] disabled:opacity-50"
                >
                  {submitted ? 'AI 思考中…' : '让 AI 来猜 →'}
                </button>
              </div>
            )}

            {room.phase === 'draw' && !room.youAreDrawer && (
              <GuessBar room={room} onGuess={(c) => net.send({ t: 'guess', choice: c })} />
            )}

            {room.phase === 'reveal' && <Reveal net={net} room={room} isHost={isHost} />}
          </>
        )}
      </div>
    </div>
  )
}

function PlayerCard({ p, winner }: { p: NetPlayer; winner: boolean }) {
  return (
    <div
      className={`ink-box flex items-center gap-2 px-3 py-2 ${
        winner ? 'bg-win/20' : p.isAI ? 'bg-orange/10' : 'bg-paper'
      }`}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-white text-xl">
        {p.emoji}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-cn leading-tight">
          {p.name} {p.isDrawer && '✏️'} {winner && '🏆'}
        </div>
        {p.isAI && <div className="text-xs text-orange">别让它猜到</div>}
      </div>
      {p.guessed ? <span className="text-sm">✅</span> : null}
      <div className="font-hand text-xl font-bold">{p.score}</div>
    </div>
  )
}

function Lobby({ net, room, isHost }: { net: ReturnType<typeof useRoom>; room: RoomState; isHost: boolean }) {
  const humans = room.players.filter((p) => !p.isAI)
  return (
    <div className="ink-box bg-white/60 p-6 text-center">
      <div className="font-hand text-3xl font-bold">等待开始</div>
      <p className="mt-2 font-cn text-lg text-ink/60">
        把房间码 <b className="font-hand text-xl tracking-widest">{room.code}</b> 发给朋友，越多人越好玩（{humans.length} 人已加入）
      </p>
      {isHost ? (
        <>
          <p className="mt-5 font-cn text-lg">选类别开第一局：</p>
          <div className="mt-3 flex flex-wrap justify-center gap-3">
            {CATS.map((c) => (
              <button
                key={c.id}
                onClick={() => net.send({ t: 'start', category: c.id })}
                className="ink-box bg-white px-5 py-3 font-cn text-xl hover:bg-orange hover:text-white"
              >
                {c.label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-5 font-cn text-lg text-ink/50">等房主开始…</p>
      )}
    </div>
  )
}

function GuessBar({ room, onGuess }: { room: RoomState; onGuess: (c: string) => void }) {
  const locked = room.yourGuess
  return (
    <div className="ink-box bg-white/70 p-4">
      <div className="mb-3 text-center font-cn text-lg">
        {locked ? <>你已锁定：<b className="text-orange">{locked}</b> · 等其他人和 AI…</> : '抢答！它画的是哪个？'}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {room.options.map((o) => (
          <button
            key={o}
            disabled={!!locked}
            onClick={() => onGuess(o)}
            className={`ink-box px-4 py-4 font-cn text-xl transition ${
              locked === o ? 'bg-orange text-white' : locked ? 'opacity-40' : 'bg-white hover:-translate-y-0.5 hover:bg-paper-deep'
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  )
}

function Reveal({ net, room, isHost }: { net: ReturnType<typeof useRoom>; room: RoomState; isHost: boolean }) {
  const humansLose = room.winnerId === 'ai'
  const winnerName = nameOf(room.players, room.winnerId)
  return (
    <div className="relative">
      <div
        className={`animate-stamp pointer-events-none absolute -top-1 left-1/2 z-10 -translate-x-1/2 font-hand text-5xl font-bold ${
          humansLose ? 'text-orange' : 'text-win'
        }`}
        style={{ textShadow: '3px 3px 0 rgba(43,38,34,0.18)' }}
      >
        {humansLose ? 'HUMANS LOSE' : room.winnerId ? 'HUMANS WIN!' : '无人猜中'}
      </div>

      <div className="ink-box mt-10 bg-white/70 p-5">
        <div className="text-center font-cn text-xl">
          答案是 <b className="font-hand text-3xl">{room.target}</b>
        </div>
        {room.winnerId && (
          <div className="mt-1 text-center font-cn text-lg">
            🏆 <b>{winnerName}</b> 抢答最快！
          </div>
        )}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <div className="font-cn text-lg text-ink/60">大家的猜测</div>
            <ul className="mt-1 space-y-1 font-cn">
              {room.players
                .filter((p) => !p.isDrawer)
                .map((p) => {
                  const g = room.guesses[p.id]
                  const ok = g === room.target
                  return (
                    <li key={p.id} className="flex items-center gap-2">
                      <span>{p.emoji}</span>
                      <span className="flex-1 truncate">{p.name}</span>
                      <span className={ok ? 'text-win' : 'text-ink/50'}>{g ?? '—'} {g ? (ok ? '✅' : '❌') : ''}</span>
                    </li>
                  )
                })}
            </ul>
          </div>
          <div className="flex flex-col justify-center gap-3">
            {room.aiGuess && (
              <>
                <div className="font-cn text-lg">
                  🤖 AI 猜：<b className={room.aiGuess.guess === room.target ? 'text-orange' : 'text-win'}>{room.aiGuess.guess}</b>{' '}
                  {room.aiGuess.guess === room.target ? '✅' : '❌'}
                </div>
                <ConfidenceBar value={room.aiGuess.confidence} />
                {room.aiGuess.reasoning && (
                  <div className="font-cn text-sm text-ink/60">AI：「{room.aiGuess.reasoning}」</div>
                )}
                {room.aiGuess.mock && (
                  <div className="font-cn text-xs text-orange/80">⚠️ mock 模式：配置 ANTHROPIC_API_KEY 后 AI 才会真看图</div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="mt-5 text-center">
          {isHost ? (
            <button
              onClick={() => net.send({ t: 'next' })}
              className="ink-box bg-orange px-6 py-2.5 font-cn text-lg text-white shadow-[4px_5px_0_rgba(43,38,34,0.2)]"
            >
              下一局（轮换画手）→
            </button>
          ) : (
            <span className="font-cn text-ink/50">等房主开下一局…</span>
          )}
        </div>
      </div>
    </div>
  )
}
