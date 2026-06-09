interface Player {
  name: string
  emoji: string
  isAI?: boolean
  score: number
}

export function PlayerRail({ players, round }: { players: Player[]; round: number }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="font-cn text-lg text-ink/60">第 {round} 局</div>
      {players.map((p) => (
        <div
          key={p.name}
          className={`ink-box flex items-center gap-3 bg-paper px-3 py-2 ${
            p.isAI ? 'shadow-[3px_4px_0_rgba(232,116,59,0.4)]' : 'shadow-[3px_4px_0_rgba(43,38,34,0.15)]'
          }`}
        >
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-ink text-2xl ${
              p.isAI ? 'bg-orange/20' : 'bg-white'
            }`}
          >
            {p.emoji}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-cn text-lg leading-tight">{p.name}</div>
            {p.isAI && <div className="text-xs text-orange">对手 · 别让它猜到</div>}
          </div>
          <div className="font-hand text-2xl font-bold">{p.score}</div>
        </div>
      ))}
    </div>
  )
}
