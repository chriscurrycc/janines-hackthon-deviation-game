export function Marquee() {
  const seg = Array.from({ length: 8 }, (_, i) => (
    <span key={i} className="mx-4 tracking-[0.3em]">
      DEVIATION&nbsp;GAME
    </span>
  ))
  return (
    <div className="overflow-hidden border-y-[3px] border-ink bg-ink py-1.5 text-paper select-none font-hand text-sm font-bold">
      <div className="flex w-max animate-marquee whitespace-nowrap">
        <div className="flex">{seg}</div>
        <div className="flex">{seg}</div>
      </div>
    </div>
  )
}
