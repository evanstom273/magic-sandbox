import { useState, type PointerEvent } from 'react'
import { touchInput } from '../game/input/touchInput.ts'

type Key = keyof typeof touchInput

function wantsTouch(): boolean {
  const forced = new URLSearchParams(location.search).get('touch')
  if (forced === '1') return true
  if (forced === '0') return false
  return matchMedia('(pointer: coarse)').matches
}

function HoldButton({ k, label, children }: { k: Key; label: string; children: string }) {
  const down = (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault()
    touchInput[k] = true
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Not every pointer can be captured; the press still counts.
    }
  }
  const up = () => {
    touchInput[k] = false
  }
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={up}
      onLostPointerCapture={up}
      className="pointer-events-auto h-16 w-16 select-none rounded-2xl border border-white/15 bg-white/10 text-2xl text-white/80 active:bg-white/25"
    >
      {children}
    </button>
  )
}

// On-screen buttons for phones and tablets: left and right on one side, jump on the other.
export function TouchControls() {
  const [show] = useState(wantsTouch)
  if (!show) return null
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-between px-[max(16px,env(safe-area-inset-left))] pb-[max(16px,env(safe-area-inset-bottom))]">
      <div className="flex gap-3">
        <HoldButton k="left" label="Move left">◀</HoldButton>
        <HoldButton k="right" label="Move right">▶</HoldButton>
      </div>
      <HoldButton k="jump" label="Jump">⤒</HoldButton>
    </div>
  )
}
