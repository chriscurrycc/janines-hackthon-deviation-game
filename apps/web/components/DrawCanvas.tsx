'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

export interface DrawCanvasHandle {
  toDataURL: () => string
  clear: () => void
  isBlank: () => boolean
}

const COLORS = ['#2b2622', '#e8743b', '#3b7de8', '#4a9d6e', '#c0392b']

export const DrawCanvas = forwardRef<DrawCanvasHandle, { disabled?: boolean }>(function DrawCanvas(
  { disabled },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const dirty = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const [color, setColor] = useState(COLORS[0])
  const [size, setSize] = useState(5)
  const [eraser, setEraser] = useState(false)

  // Backing store is fixed-resolution so exported images are consistent.
  const W = 720
  const H = 540

  function ctx() {
    return canvasRef.current!.getContext('2d')!
  }

  function paintBg() {
    const c = ctx()
    c.fillStyle = '#fffdf7'
    c.fillRect(0, 0, W, H)
  }

  useEffect(() => {
    paintBg()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useImperativeHandle(ref, () => ({
    toDataURL: () => canvasRef.current!.toDataURL('image/png'),
    clear: () => {
      paintBg()
      dirty.current = false
    },
    isBlank: () => !dirty.current,
  }))

  function pos(e: React.PointerEvent) {
    const rect = canvasRef.current!.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    }
  }

  function down(e: React.PointerEvent) {
    if (disabled) return
    drawing.current = true
    last.current = pos(e)
    canvasRef.current!.setPointerCapture(e.pointerId)
    stroke(last.current, last.current)
  }
  function move(e: React.PointerEvent) {
    if (!drawing.current || disabled) return
    const p = pos(e)
    stroke(last.current!, p)
    last.current = p
  }
  function up() {
    drawing.current = false
    last.current = null
  }

  function stroke(a: { x: number; y: number }, b: { x: number; y: number }) {
    const c = ctx()
    c.lineCap = 'round'
    c.lineJoin = 'round'
    c.strokeStyle = eraser ? '#fffdf7' : color
    c.lineWidth = eraser ? 26 : size
    c.beginPath()
    c.moveTo(a.x, a.y)
    c.lineTo(b.x, b.y)
    c.stroke()
    dirty.current = true
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="ink-box-dashed bg-[#fffdf7] p-1 shadow-[5px_6px_0_rgba(43,38,34,0.15)]">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerLeave={up}
          className={`block w-full rounded-[10px] ${disabled ? 'cursor-not-allowed' : 'cursor-crosshair touch-none'}`}
          style={{ aspectRatio: `${W} / ${H}` }}
        />
      </div>

      {!disabled && (
        <div className="flex flex-wrap items-center gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => {
                setColor(c)
                setEraser(false)
              }}
              className={`h-8 w-8 rounded-full border-2 transition ${
                color === c && !eraser ? 'border-ink scale-110' : 'border-ink/30'
              }`}
              style={{ background: c }}
              aria-label={`颜色 ${c}`}
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
              className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                size === s && !eraser ? 'border-ink bg-paper-deep' : 'border-ink/30'
              }`}
              aria-label={`笔粗 ${s}`}
            >
              <span className="rounded-full bg-ink" style={{ width: s + 2, height: s + 2 }} />
            </button>
          ))}
          <button
            onClick={() => setEraser((v) => !v)}
            className={`rounded-full border-2 px-3 py-1 text-lg ${
              eraser ? 'border-ink bg-orange text-white' : 'border-ink/40'
            }`}
          >
            🩹 橡皮
          </button>
          <button
            onClick={() => {
              paintBg()
              dirty.current = false
            }}
            className="rounded-full border-2 border-ink/40 px-3 py-1 text-lg hover:bg-paper-deep"
          >
            🗑️ 清空
          </button>
        </div>
      )}
    </div>
  )
})
