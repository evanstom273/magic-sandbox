import * as Phaser from 'phaser'
import { Dust } from '../effects/dust.ts'
import { touchInput } from '../input/touchInput.ts'
import { BodyCell, CellBody } from '../player/body.ts'
import { createPlayer, stepPlayer, type PlayerState } from '../player/movement.ts'
import { Squash } from '../player/squash.ts'
import { PLAYER } from '../player/tuning.ts'
import { DUST, HERO, INK } from '../style/tokens.ts'
import type { CellGrid } from '../world/grid.ts'
import { buildTestRoom, ROOM_H, ROOM_W, SPAWN } from '../world/testRoom.ts'
import { paintGrid } from '../world/worldTexture.ts'

const BODY_COLOURS: Record<number, number> = { [BodyCell.INK]: INK, [BodyCell.HERO]: HERO }

export class MainScene extends Phaser.Scene {
  private grid!: CellGrid
  private player!: PlayerState
  private body!: CellBody
  private squash = new Squash()
  private dust = new Dust()
  private gfx!: Phaser.GameObjects.Graphics
  private keys!: Record<string, Phaser.Input.Keyboard.Key>
  private cam = { x: SPAWN.x, y: SPAWN.y }

  constructor() {
    super('main')
  }

  create(): void {
    this.grid = buildTestRoom()
    const tex = this.textures.createCanvas('world', ROOM_W, ROOM_H)!
    const ctx = tex.getContext()
    const img = ctx.createImageData(ROOM_W, ROOM_H)
    paintGrid(this.grid, img)
    ctx.putImageData(img, 0, 0)
    tex.refresh()
    this.add.image(0, 0, 'world').setOrigin(0, 0)

    this.gfx = this.add.graphics()
    this.player = createPlayer(SPAWN.x, SPAWN.y)
    this.body = CellBody.square(PLAYER.size)
    this.keys = this.input.keyboard!.addKeys('A,D,W,LEFT,RIGHT,UP,SPACE') as Record<string, Phaser.Input.Keyboard.Key>

    this.cameras.main.setBounds(0, 0, ROOM_W, ROOM_H)
    this.fitCamera()
    this.scale.on('resize', () => this.fitCamera())

    if (import.meta.env.DEV) {
      const w = window as unknown as Record<string, unknown>
      w.__player = () => ({ ...this.player, sx: this.squash.sx, sy: this.squash.sy, dust: this.dust.motes.length })
    }
  }

  /** Cells are drawn about 3–6 screen pixels across, so the 12-cell player is roughly 40–70 px. */
  private fitCamera(): void {
    const { width, height } = this.scale.gameSize
    const cellPx = Math.max(3, Math.min(6, Math.min(width / 110, height / 150)))
    this.cameras.main.setZoom(cellPx)
    this.cameras.main.centerOn(this.cam.x, this.cam.y)
  }

  private readInput() {
    const k = this.keys
    let move = (k.D.isDown || k.RIGHT.isDown || touchInput.right ? 1 : 0) - (k.A.isDown || k.LEFT.isDown || touchInput.left ? 1 : 0)
    let jump = k.W.isDown || k.UP.isDown || k.SPACE.isDown || touchInput.jump
    const pad = this.input.gamepad?.pad1
    if (pad) {
      const sx = pad.leftStick.x
      if (Math.abs(sx) > 0.25) move = sx
      if (pad.left) move = -1
      if (pad.right) move = 1
      if (pad.A) jump = true
    }
    return { move, jump }
  }

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(0.05, deltaMs / 1000)
    const p = this.player
    const ev = stepPlayer(p, this.readInput(), dt, this.grid.isSolid)

    if (ev.jumped) { this.squash.jump(); this.dust.puff(p.x, p.y, 6, 30) }
    if (ev.landed >= 0) { this.squash.land(ev.landed); this.dust.puff(p.x, p.y, 4 + Math.round(ev.landed * 8), 25 + ev.landed * 45) }
    if (ev.skidded) this.dust.puff(p.x - p.facing * 4, p.y, 3, 25, p.facing === 1 ? -1 : 1)
    this.squash.update(dt, p.grounded ? 0 : Math.max(0, p.vy) / PLAYER.maxFall)
    this.dust.update(dt)

    // Camera follows smoothly.
    const t = 1 - Math.exp(-8 * dt)
    this.cam.x += (p.x - this.cam.x) * t
    this.cam.y += (p.y - PLAYER.size - this.cam.y) * t
    this.cameras.main.centerOn(this.cam.x, this.cam.y)

    this.draw()
  }

  private draw(): void {
    const g = this.gfx
    const p = this.player
    g.clear()

    for (const m of this.dust.motes) {
      g.fillStyle(DUST, Math.min(1, (m.life / m.max) * 1.4))
      g.fillRect(m.x - 0.5, m.y - 0.5, 1, 1)
    }

    // The body, redrawn at its squashed size in whole cells, standing on its feet.
    const w = Math.max(4, Math.round(PLAYER.size * this.squash.sx))
    const h = Math.max(4, Math.round(PLAYER.size * this.squash.sy))
    const cells = this.body.resample(w, h)
    const left = p.x - w / 2
    const top = p.y - h
    for (let y = 0; y < h; y++) {
      let x = 0
      while (x < w) {
        const c = cells[y * w + x]
        let run = 1
        while (x + run < w && cells[y * w + x + run] === c) run++
        if (c !== BodyCell.EMPTY) {
          g.fillStyle(BODY_COLOURS[c], 1)
          g.fillRect(left + x, top + y, run, 1)
        }
        x += run
      }
    }
  }
}
