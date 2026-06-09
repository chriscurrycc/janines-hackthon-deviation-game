export function ConfidenceBar({ value }: { value: number }) {
  const v = Math.round(value)
  const hue = v > 60 ? 'bg-orange' : v > 35 ? 'bg-orange-soft' : 'bg-win'
  return (
    <div className="w-full">
      <div className="mb-1 flex justify-between font-hand text-sm font-bold">
        <span>AI 信心</span>
        <span>{v}%</span>
      </div>
      <div className="ink-box h-6 overflow-hidden bg-white p-0">
        <div
          className={`h-full ${hue} transition-[width] duration-700 ease-out`}
          style={{ width: `${v}%` }}
        />
      </div>
    </div>
  )
}
