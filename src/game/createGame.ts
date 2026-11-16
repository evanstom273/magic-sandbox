import * as Phaser from 'phaser'
import { MainScene } from './scenes/MainScene.ts'
import { BACKDROP } from './style/tokens.ts'

export function createGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: BACKDROP,
    scale: {
      // The canvas fills its parent and follows it when the window changes size.
      mode: Phaser.Scale.RESIZE,
      width: '100%',
      height: '100%',
    },
    scene: [MainScene],
  })
}
