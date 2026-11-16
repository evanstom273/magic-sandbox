import { PhaserGame } from './game/PhaserGame.tsx'
import { DeathPrompt } from './ui/DeathPrompt.tsx'
import { HealthBar } from './ui/HealthBar.tsx'
import { Hotbar } from './ui/Hotbar.tsx'
import { TouchControls } from './ui/TouchControls.tsx'

// The React shell. Phaser runs the game inside PhaserGame; React draws what sits on top of it.
export default function App() {
  return (
    <main className="relative h-dvh w-full touch-none overflow-hidden select-none">
      <PhaserGame />
      <HealthBar />
      <Hotbar />
      <DeathPrompt />
      <TouchControls />
    </main>
  )
}
