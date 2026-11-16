import { useSyncExternalStore } from 'react'
import { hud } from '../game/bridge.ts'

// Shown once the player has shattered: the game waits for Jump.
export function DeathPrompt() {
  const { dead } = useSyncExternalStore(hud.subscribe, hud.get)
  if (!dead) return null
  const touch = document.documentElement.dataset.touch === '1'
  return (
    <p
      role="status"
      className="pointer-events-none absolute inset-x-0 top-[38%] text-center text-lg font-semibold tracking-wide text-[#f2f2f2] [text-shadow:0_2px_0_#1a1a26] motion-safe:animate-pulse"
    >
      {touch ? 'Tap Jump to continue' : 'Press Jump to continue'}
    </p>
  )
}
