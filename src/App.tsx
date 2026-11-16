import { PhaserGame } from './game/PhaserGame.tsx'
import { HealthBar } from './ui/HealthBar.tsx'
import { TouchControls } from './ui/TouchControls.tsx'

// The React shell. Phaser runs the game inside PhaserGame; React draws what sits on top of it.
export default function App() {
  return (
    <main className="relative h-dvh w-full touch-none overflow-hidden select-none">
      <PhaserGame />
      <HealthBar />
      <TouchControls />
    </main>
  )
}
