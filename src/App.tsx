import { PhaserGame } from './game/PhaserGame.tsx'

// The React shell. Phaser runs the game inside PhaserGame; anything React draws
// around it later (menus, overlays, HUD) goes here.
export default function App() {
  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <PhaserGame />
    </main>
  )
}
