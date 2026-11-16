import { useRef, useState, type PointerEvent } from 'react'
import { touchInput } from '../game/input/touchInput.ts'

function wantsTouch(): boolean {
  const forced = new URLSearchParams(location.search).get('touch')
  if (forced === '1') return true
  if (forced === '0') return false
  return matchMedia('(pointer: coarse)').matches
}

function capture(e: PointerEvent<HTMLElement>) {
  try {
    e.currentTarget.setPointerCapture(e.pointerId)
  } catch {
    // Not every pointer can be captured; the press still counts.
  }
}

function HoldButton({ k, label, children }: { k: 'jump'; label: string; children: string }) {
  const up = () => {
    touchInput[k] = false
  }
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault()
        touchInput[k] = true
        if (k === 'jump') touchInput.jumpTap = true
        capture(e)
      }}
      onPointerUp={up}
      onPointerCancel={up}
      onLostPointerCapture={up}
      className="pointer-events-auto h-20 w-20 select-none rounded-full border border-white/15 bg-white/10 text-sm font-semibold text-white/80 active:bg-white/25"
    >
      {children}
    </button>
  )
}

const RADIUS = 52

// A fixed thumbstick: drag from its centre to move.
function Thumbstick() {
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const centre = useRef({ x: 0, y: 0 })
  const active = useRef<number | null>(null)

  const update = (e: PointerEvent<HTMLDivElement>) => {
    let dx = e.clientX - centre.current.x, dy = e.clientY - centre.current.y
    const d = Math.hypot(dx, dy)
    if (d > RADIUS) { dx = (dx / d) * RADIUS; dy = (dy / d) * RADIUS }
    setKnob({ x: dx, y: dy })
    const nx = dx / RADIUS
    touchInput.moveX = Math.abs(nx) > 0.3 ? nx : 0
  }
  const end = () => {
    active.current = null
    setKnob({ x: 0, y: 0 })
    touchInput.moveX = 0
  }

  return (
    <div
      role="slider"
      aria-label="Move"
      aria-valuenow={Math.round((knob.x / RADIUS) * 100)}
      className="pointer-events-auto relative h-36 w-36 touch-none select-none rounded-full border border-white/15 bg-white/5"
      onPointerDown={(e) => {
        e.preventDefault()
        const r = e.currentTarget.getBoundingClientRect()
        centre.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 }
        active.current = e.pointerId
        capture(e)
        update(e)
      }}
      onPointerMove={(e) => {
        if (active.current === e.pointerId) update(e)
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
    >
      <div
        className="absolute top-1/2 left-1/2 h-14 w-14 rounded-full border border-white/20 bg-white/20"
        style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
      />
    </div>
  )
}

// On-screen controls for phones and tablets: the move stick bottom left, Jump bottom right. Touching
// the world anywhere else aims and casts there (#84).
export function TouchControls() {
  const [show] = useState(() => {
    const t = wantsTouch()
    document.documentElement.dataset.touch = t ? '1' : '0'
    return t
  })
  if (!show) return null
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between px-[max(16px,env(safe-area-inset-left))] pb-[max(16px,env(safe-area-inset-bottom))]">
      <Thumbstick />
      <HoldButton k="jump" label="Jump">Jump</HoldButton>
    </div>
  )
}
