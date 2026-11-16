import { useEffect, useRef } from 'react'
import { createGame } from './createGame.ts'

// Holds the canvas. The game is created when this mounts and destroyed when it
// unmounts, so React's development double-mount leaves exactly one game running.
export function PhaserGame() {
  const parent = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const game = createGame(parent.current!)
    return () => game.destroy(true)
  }, [])

  return <div ref={parent} className="absolute inset-0" />
}
