'use client'

import { useEffect, useRef, useState } from 'react'
import { LiveCanvas, type LiveCanvasHandle } from '@/components/LiveCanvas'
import { ConfidenceBar } from '@/components/ConfidenceBar'
import { useRoom } from '@/lib/useRoom'
import type { GameMode, NetPlayer, RoomState } from '@deviation/shared'

const CATS = [
  { id: 'object', label: '物品' },
  { id: 'animal', label: '动物' },
  { id: 'action', label: '动作' },
  { id: 'tech', label: '科技' },
  { id: 'work', label: '工作' },
  { id: 'abstract', label: '抽象' },
]

/** Shareable invite URL — opening it prefills the room code on the join screen. */
function roomLink(code: string) {
  return typeof window === 'undefined' ? '' : `${window.location.origin}/?room=${code}`
}

/** Read the room code from the current URL (?room=CODE), normalized to 4 chars. */
function roomCodeFromUrl() {
  if (typeof window === 'undefined') return ''
  return (new URLSearchParams(window.location.search).get('room') || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4)
}

// Remember the player's nickname locally so they don't retype it every time.
const NAME_KEY = 'deviation:name'
function loadName() {
  if (typeof window === 'undefined') return ''
  try {
    return localStorage.getItem(NAME_KEY) || ''
  } catch {
    return ''
  }
}
function saveName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name)
  } catch {
    /* ignore (private mode / storage disabled) */
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through to the legacy path (e.g. plain-http LAN testing)
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

function InviteLink({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const link = roomLink(code)
  return (
    <div className="mt-3 flex items-center gap-2">
      <input
        readOnly
        value={link}
        onFocus={(e) => e.currentTarget.select()}
        className="ink-box min-w-0 flex-1 bg-white px-3 py-2 text-left font-cn text-sm text-ink/70 outline-none"
      />
      <button
        onClick={async () => {
          if (await copyText(link)) {
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }
        }}
        className="ink-box shrink-0 bg-orange px-4 py-2 font-cn text-white"
      >
        {copied ? '已复制 ✓' : '复制链接'}
      </button>
    </div>
  )
}

export function Multiplayer({ onExit, initialCode }: { onExit: () => void; initialCode?: string | null }) {
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

  // Second confirmation before closing/refreshing the tab while in a room.
  useEffect(() => {
    if (net.status !== 'inroom') return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [net.status])

  if (net.status !== 'inroom' || !room) {
    return <JoinScreen net={net} onExit={onExit} initialCode={initialCode} />
  }
  return <RoomView net={net} room={room} canvasRef={canvasRef} onExit={onExit} />
}

function JoinScreen({
  net,
  onExit,
  initialCode,
}: {
  net: ReturnType<typeof useRoom>
  onExit: () => void
  initialCode?: string | null
}) {
  const [name, setName] = useState(loadName)
  const [code, setCode] = useState(() => initialCode || roomCodeFromUrl())
  // Whether we arrived via an invite link or active-room click — captured once at mount.
  const [invited] = useState(() => (initialCode || roomCodeFromUrl()).length === 4)

  const doCreate = () => {
    if (!name.trim()) return
    saveName(name.trim())
    net.create(name.trim())
  }
  const doJoin = (c: string) => {
    if (!name.trim() || c.length < 4) return
    saveName(name.trim())
    net.join(c, name.trim())
  }

  return (
    <div className="mx-auto max-w-md py-8 text-center">
      <h2 className="font-hand text-4xl font-bold">多人房间</h2>
      <p className="mt-2 font-cn text-lg text-ink/60">一人画，其他人和 AI 一起抢答，谁先猜对谁赢</p>
      {net.error && <div className="mt-3 font-cn text-orange">{net.error}</div>}

      {invited && (
        <div className="ink-box mt-4 bg-orange/10 px-4 py-2 font-cn text-ink/70">
          🔗 受邀加入房间 <b className="font-hand text-xl tracking-widest text-orange">{code}</b> · 填昵称即可加入
        </div>
      )}

      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="你的昵称"
        maxLength={12}
        className="ink-box mt-5 w-full bg-white px-4 py-3 text-center font-cn text-xl outline-none"
      />

      {invited ? (
        <>
          <button
            onClick={() => doJoin(code)}
            disabled={!name.trim()}
            className="ink-box mt-4 w-full bg-orange px-4 py-3 font-cn text-xl text-white shadow-[4px_5px_0_rgba(43,38,34,0.2)] disabled:opacity-40"
          >
            加入房间 {code} →
          </button>
          <button
            onClick={doCreate}
            disabled={!name.trim()}
            className="ink-box mt-3 w-full bg-white px-4 py-3 font-cn text-lg disabled:opacity-40"
          >
            🆕 或创建新房间
          </button>
        </>
      ) : (
        <>
          <button
            onClick={doCreate}
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
              onClick={() => doJoin(code.trim())}
              disabled={!name.trim() || code.length < 4}
              className="ink-box flex-1 bg-ink px-4 py-3 font-cn text-xl text-paper disabled:opacity-40"
            >
              加入 →
            </button>
          </div>
        </>
      )}

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

  // The AI is a pseudo-player; its `guessed` flag tells us it has finished thinking.
  const aiGuessed = room.players.some((p) => p.isAI && p.guessed)
  const waitingHumans = room.players.filter(
    (p) => !p.isAI && !p.isDrawer && p.connected && !p.guessed,
  ).length

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[210px_1fr]">
      {/* left rail */}
      <div className="flex flex-col gap-3">
        <div className="ink-box bg-paper-deep/50 px-3 py-2 text-center">
          <div className="font-cn text-sm text-ink/60">房间码</div>
          <div className="font-hand text-3xl font-bold tracking-[0.3em]">{room.code}</div>
        </div>
        <div className="font-cn text-ink/60">
          {room.roundNo > 0
            ? room.mode === 'score'
              ? `第 ${room.roundNo} 局 · 目标 ${room.targetScore} 分`
              : `第 ${room.roundNo} / ${room.maxRounds} 局`
            : '第 - 局'}
        </div>
        {room.phase !== 'lobby' && <TeamScore room={room} />}
        {room.players.map((p) => (
          <PlayerCard key={p.id} p={p} winner={room.winnerId === p.id} />
        ))}
        <button
          onClick={() => {
            if (window.confirm('确定要离开房间吗？')) onExit()
          }}
          className="mt-2 font-cn text-sm text-ink/40 underline"
        >
          ← 离开房间
        </button>
      </div>

      {/* main */}
      <div className="flex flex-col gap-4">
        {room.phase === 'lobby' && <Lobby net={net} room={room} isHost={isHost} />}

        {room.phase === 'ended' && <GameOver net={net} room={room} isHost={isHost} />}

        {(room.phase === 'draw' || room.phase === 'reveal') && (
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
              <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-cn text-base text-ink/60">画得人懂、AI 懵 😈 画好了就喊 AI 来猜</p>
                <button
                  disabled={submitted}
                  onClick={() => {
                    setSubmitted(true)
                    net.send({ t: 'submitDrawing', image: canvasRef.current?.toDataURL() })
                  }}
                  className="ink-box shrink-0 bg-ink px-6 py-3 font-cn text-xl text-paper shadow-[4px_5px_0_rgba(232,116,59,0.5)] disabled:opacity-50"
                >
                  {!submitted
                    ? '让 AI 来猜 →'
                    : aiGuessed
                      ? waitingHumans > 0
                        ? `🤖 已答 · 还差 ${waitingHumans} 人作答`
                        : '🤖 已答 · 等待中…'
                      : 'AI 思考中…'}
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

// Team scoreboard: humans (collectively) vs the AI.
function TeamScore({ room }: { room: RoomState }) {
  return (
    <div className="ink-box flex items-stretch overflow-hidden bg-white text-center font-cn">
      <div className="flex-1 bg-win/15 px-2 py-2">
        <div className="text-xs text-ink/50">🧑 人类</div>
        <div className="font-hand text-3xl font-bold text-win">{room.humanScore}</div>
      </div>
      <div className="flex items-center px-1 font-hand text-sm text-ink/40">VS</div>
      <div className="flex-1 bg-orange/15 px-2 py-2">
        <div className="text-xs text-ink/50">🤖 AI</div>
        <div className="font-hand text-3xl font-bold text-orange">{room.aiScore}</div>
      </div>
    </div>
  )
}

function PlayerCard({ p, winner }: { p: NetPlayer; winner: boolean }) {
  const offline = !p.isAI && !p.connected
  return (
    <div
      className={`ink-box flex items-center gap-2 px-3 py-2 transition ${
        winner ? 'bg-win/20' : p.isAI ? 'bg-orange/10' : 'bg-paper'
      } ${offline ? 'opacity-50 grayscale' : ''}`}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-white text-xl">
        {p.emoji}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-cn leading-tight">
          {p.name} {p.isDrawer && '✏️'} {winner && '🏆'}
          {offline && <span className="ml-1 text-xs text-ink/40">· 离线</span>}
        </div>
        {p.isAI && <div className="text-xs text-orange">别让它猜到</div>}
      </div>
      {p.guessed ? <span className="text-sm">✅</span> : null}
    </div>
  )
}

function Stepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number
  min: number
  max: number
  onChange: (n: number) => void
}) {
  return (
    <span className="ink-box inline-flex items-center gap-2 bg-white px-2 py-0.5">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        className="px-2 font-hand text-2xl leading-none"
        aria-label="减少"
      >
        −
      </button>
      <b className="min-w-[2ch] text-center font-hand text-2xl tabular-nums">{value}</b>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        className="px-2 font-hand text-2xl leading-none"
        aria-label="增加"
      >
        +
      </button>
    </span>
  )
}

function Lobby({ net, room, isHost }: { net: ReturnType<typeof useRoom>; room: RoomState; isHost: boolean }) {
  const humans = room.players.filter((p) => !p.isAI)
  const [mode, setMode] = useState<GameMode>('rounds')
  const [rounds, setRounds] = useState(6)
  const [target, setTarget] = useState(10)

  return (
    <div className="ink-box bg-white/60 p-6 text-center">
      <div className="font-hand text-3xl font-bold">等待开始</div>
      <p className="mt-2 font-cn text-lg text-ink/60">
        把房间码 <b className="font-hand text-xl tracking-widest">{room.code}</b> 发给朋友，越多人越好玩（{humans.length} 人已加入）
      </p>
      <div className="mx-auto mt-2 max-w-sm">
        <div className="font-cn text-sm text-ink/50">或直接发邀请链接（打开即自动填码）：</div>
        <InviteLink code={room.code} />
      </div>
      {isHost ? (
        <>
          <div className="mt-6 flex justify-center gap-2">
            <button
              onClick={() => setMode('rounds')}
              className={`ink-box px-4 py-2 font-cn ${mode === 'rounds' ? 'bg-ink text-paper' : 'bg-white'}`}
            >
              固定局数
            </button>
            <button
              onClick={() => setMode('score')}
              className={`ink-box px-4 py-2 font-cn ${mode === 'score' ? 'bg-ink text-paper' : 'bg-white'}`}
            >
              抢分模式
            </button>
          </div>

          <div className="mt-3 flex items-center justify-center gap-2 font-cn text-lg">
            {mode === 'rounds' ? (
              <>
                共 <Stepper value={rounds} min={1} max={50} onChange={setRounds} /> 局
              </>
            ) : (
              <>
                先到 <Stepper value={target} min={2} max={100} onChange={setTarget} /> 分获胜
              </>
            )}
          </div>

          <p className="mt-5 font-cn text-lg">选类别开始：</p>
          <div className="mt-3 flex flex-wrap justify-center gap-3">
            {CATS.map((c) => (
              <button
                key={c.id}
                onClick={() => net.send({ t: 'start', category: c.id, mode, rounds, target })}
                className="ink-box bg-white px-5 py-3 font-cn text-xl hover:bg-orange hover:text-white"
              >
                {c.label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-5 font-cn text-lg text-ink/50">等房主设置并开始…</p>
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
  // Round outcome by the team rule (human camp vs AI).
  const humanCorrect = room.players.some(
    (p) => !p.isAI && !p.isDrawer && room.guesses[p.id] === room.target,
  )
  const aiCorrect = room.aiGuess?.guess === room.target
  const winnerName = nameOf(room.players, room.winnerId)

  let stamp: string
  let stampColor: string
  let delta: string
  if (humanCorrect && !aiCorrect) {
    stamp = 'HUMANS WIN!'
    stampColor = 'text-win'
    delta = '人类完胜 · 人类阵营 +2'
  } else if (humanCorrect && aiCorrect) {
    stamp = '都猜对了'
    stampColor = 'text-ink'
    delta = '人类 +1 · AI +1'
  } else if (!humanCorrect && aiCorrect) {
    stamp = 'HUMANS LOSE'
    stampColor = 'text-orange'
    delta = '🤖 AI 暴击 · AI 阵营 +3'
  } else {
    stamp = '无人猜中'
    stampColor = 'text-ink/50'
    delta = '双输 · 这题太难，0 分'
  }

  const isFinal =
    room.mode === 'score'
      ? room.humanScore >= room.targetScore || room.aiScore >= room.targetScore
      : room.roundNo >= room.maxRounds

  return (
    <div className="relative">
      <div
        className={`animate-stamp pointer-events-none absolute -top-1 left-1/2 z-10 -translate-x-1/2 font-hand text-5xl font-bold ${stampColor}`}
        style={{ textShadow: '3px 3px 0 rgba(43,38,34,0.18)' }}
      >
        {stamp}
      </div>

      <div className="ink-box mt-10 bg-white/70 p-5">
        <div className="text-center font-cn text-xl">
          答案是 <b className="font-hand text-3xl">{room.target}</b>
        </div>
        <div className="mt-1 text-center font-cn text-lg text-ink/70">{delta}</div>
        {room.winnerId && (
          <div className="mt-1 text-center font-cn text-sm text-ink/50">🏆 {winnerName} 最快猜对</div>
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
          <div className="mb-2 font-cn text-sm text-ink/50">
            {room.mode === 'rounds'
              ? `第 ${room.roundNo} / ${room.maxRounds} 局`
              : `抢分 · 先到 ${room.targetScore} 分`}
            <span className="mx-1">·</span>
            <span className="text-win">人类 {room.humanScore}</span> :{' '}
            <span className="text-orange">{room.aiScore} AI</span>
          </div>
          {isHost ? (
            isFinal ? (
              <button
                onClick={() => net.send({ t: 'end' })}
                className="ink-box bg-win px-6 py-2.5 font-cn text-lg text-white shadow-[4px_5px_0_rgba(43,38,34,0.2)]"
              >
                🏁 查看最终结果
              </button>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={() => net.send({ t: 'next' })}
                  className="ink-box bg-orange px-6 py-2.5 font-cn text-lg text-white shadow-[4px_5px_0_rgba(43,38,34,0.2)]"
                >
                  下一局（轮换画手）→
                </button>
                <button onClick={() => net.send({ t: 'end' })} className="font-cn text-sm text-ink/40 underline">
                  提前结束游戏
                </button>
              </div>
            )
          ) : (
            <span className="font-cn text-ink/50">{isFinal ? '等房主结算…' : '等房主开下一局…'}</span>
          )}
        </div>
      </div>
    </div>
  )
}

function GameOver({ net, room, isHost }: { net: ReturnType<typeof useRoom>; room: RoomState; isHost: boolean }) {
  const human = room.humanScore
  const ai = room.aiScore
  const tie = human === ai
  const humansWin = human > ai

  return (
    <div className="relative">
      <div
        className={`animate-stamp pointer-events-none absolute -top-1 left-1/2 z-10 -translate-x-1/2 font-hand text-5xl font-bold ${
          tie ? 'text-ink' : humansWin ? 'text-win' : 'text-orange'
        }`}
        style={{ textShadow: '3px 3px 0 rgba(43,38,34,0.18)' }}
      >
        {tie ? 'DRAW' : humansWin ? 'HUMANS WIN' : 'AI WINS'}
      </div>

      <div className="ink-box mt-10 bg-white/70 p-5 text-center">
        <div className="font-hand text-3xl font-bold">🏁 最终比分</div>
        <div className="mt-1 font-cn text-sm text-ink/50">
          {room.mode === 'rounds' ? `共 ${room.maxRounds} 局` : `抢分 · 目标 ${room.targetScore} 分`}
        </div>

        <div className="mx-auto mt-5 flex max-w-sm items-stretch gap-2">
          <div className={`ink-box flex-1 px-3 py-4 ${humansWin && !tie ? 'bg-win/25' : 'bg-win/10'}`}>
            <div className="font-cn text-ink/60">🧑 人类阵营</div>
            <div className="font-hand text-5xl font-bold text-win">{human}</div>
          </div>
          <div className="flex items-center font-hand text-ink/40">VS</div>
          <div className={`ink-box flex-1 px-3 py-4 ${!humansWin && !tie ? 'bg-orange/25' : 'bg-orange/10'}`}>
            <div className="font-cn text-ink/60">🤖 AI 阵营</div>
            <div className="font-hand text-5xl font-bold text-orange">{ai}</div>
          </div>
        </div>

        <div className="mt-4 font-cn text-lg">
          {tie ? '🤝 平局！' : humansWin ? '🎉 人类阵营获胜！' : '😈 AI 阵营获胜…'}
        </div>

        <div className="mt-5">
          {isHost ? (
            <button
              onClick={() => net.send({ t: 'lobby' })}
              className="ink-box bg-orange px-6 py-2.5 font-cn text-lg text-white shadow-[4px_5px_0_rgba(43,38,34,0.2)]"
            >
              🔄 再玩一局
            </button>
          ) : (
            <span className="font-cn text-ink/50">等房主再来一局…</span>
          )}
        </div>
      </div>
    </div>
  )
}
