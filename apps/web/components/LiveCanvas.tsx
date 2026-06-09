'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { Stroke } from '@deviation/shared'

export interface LiveCanvasHandle {
  toDataURL: () => string
  clearLocal: () => void
  applyStroke: (s: Stroke) => void
  replay: (s: Stroke[]) => void
}

const W = 720
const H = 720 // square: gives portrait phones a much taller drawing area without distorting sync
const COLORS = ['#2b2622', '#e8743b', '#3b7de8', '#4a9d6e', '#c0392b']

interface Props {
  mode: 'draw' | 'watch'
  onStroke?: (s: Stroke) => void
  onClear?: () => void
}

export const LiveCanvas = forwardRef<LiveCanvasHandle, Props>(function LiveCanvas(
  { mode, onStroke, onClear },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const [color, setColor] = useState(COLORS[0])
  const [size, setSize] = useState(5)
  const [eraser, setEraser] = useState(false)

  const c = () => canvasRef.current!.getContext('2d')!
  function paintBg() {
    const ctx = c()
    ctx.fillStyle = '#fffdf7'
    ctx.fillRect(0, 0, W, H)
  }
  function paint(s: Stroke) {
    const ctx = c()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = s.erase ? '#fffdf7' : s.color
    ctx.lineWidth = s.size
    ctx.beginPath()
    ctx.moveTo(s.x0, s.y0)
    ctx.lineTo(s.x1, s.y1)
    ctx.stroke()
  }

  useEffect(() => {
    paintBg()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useImperativeHandle(ref, () => ({
    toDataURL: () => canvasRef.current!.toDataURL('image/png'),
    clearLocal: () => paintBg(),
    applyStroke: (s) => paint(s),
    replay: (arr) => {
      paintBg()
      arr.forEach(paint)
    },
  }))

  function pos(e: React.PointerEvent) {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: ((e.clientX - rect.left) / rect.width) * W, y: ((e.clientY - rect.top) / rect.height) * H }
  }
  function down(e: React.PointerEvent) {
    if (mode !== 'draw') return
    drawing.current = true
    last.current = pos(e)
    canvasRef.current!.setPointerCapture(e.pointerId)
    emit(last.current, last.current)
  }
  function move(e: React.PointerEvent) {
    if (!drawing.current || mode !== 'draw') return
    const p = pos(e)
    emit(last.current!, p)
    last.current = p
  }
  function up() {
    drawing.current = false
    last.current = null
  }
  function emit(a: { x: number; y: number }, b: { x: number; y: number }) {
    const s: Stroke = { x0: a.x, y0: a.y, x1: b.x, y1: b.y, color, size: eraser ? 26 : size, erase: eraser }
    paint(s)
    onStroke?.(s)
  }

  return (
    <div className="drawpad flex flex-col gap-3">
      <div className="ink-box-dashed bg-[#fffdf7] p-1 shadow-[5px_6px_0_rgba(43,38,34,0.15)] sm:max-w-[600px]">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerLeave={up}
          onContextMenu={(e) => e.preventDefault()}
          className={`block w-full rounded-[10px] ${mode === 'draw' ? 'cursor-crosshair touch-none' : 'pointer-events-none'}`}
          style={{ aspectRatio: `${W} / ${H}` }}
        />
      </div>

      {mode === 'draw' && (
        <div className="flex flex-wrap items-center gap-2">
          {COLORS.map((col) => (
            <button
              key={col}
              onClick={() => {
                setColor(col)
                setEraser(false)
              }}
              className={`h-8 w-8 rounded-full border-2 ${color === col && !eraser ? 'border-ink scale-110' : 'border-ink/30'}`}
              style={{ background: col }}
              aria-label={`颜色 ${col}`}
            />
          ))}
          <div className="mx-1 h-7 w-px bg-ink/20" />
          {[3, 5, 9].map((s) => (
            <button
              key={s}
              onClick={() => {
                setSize(s)
                setEraser(false)
              }}
              className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${size === s && !eraser ? 'border-ink bg-paper-deep' : 'border-ink/30'}`}
              aria-label={`笔粗 ${s}`}
            >
              <span className="rounded-full bg-ink" style={{ width: s + 2, height: s + 2 }} />
            </button>
          ))}
          <button
            onClick={() => setEraser((v) => !v)}
            className={`rounded-full border-2 px-3 py-1 text-lg ${eraser ? 'border-ink bg-orange text-white' : 'border-ink/40'}`}
          >
            🩹
          </button>
          <button
            onClick={() => {
              paintBg()
              onClear?.()
            }}
            className="rounded-full border-2 border-ink/40 px-3 py-1 text-lg hover:bg-paper-deep"
          >
            🗑️
          </button>
        </div>
      )}
    </div>
  )
})
