import * as Phaser from 'phaser'
import { Dust } from '../effects/dust.ts'
import { Rings } from '../effects/rings.ts'
import { Gather, Shatter } from '../effects/shatter.ts'
import { hud } from '../bridge.ts'
import { touchInput } from '../input/touchInput.ts'
import { BodyCell, CellBody } from '../player/body.ts'
import { fallDamage, Health, HEALTH } from '../player/health.ts'
import { createPlayer, stepPlayer, type PlayerState } from '../player/movement.ts'
import { Squash } from '../player/squash.ts'
import { PLAYER, SQUASH } from '../player/tuning.ts'
import { DAMAGE, DUST, HERO, INK } from '../style/tokens.ts'
import type { CellGrid } from '../world/grid.ts'
import { buildTestRoom, REST_SPOT, ROOM_H, ROOM_W, SPAWN } from '../world/testRoom.ts'
import { paintGrid } from '../world/worldTexture.ts'

const BODY_COLOURS: Record<number, number> = { [BodyCell.INK]: INK, [BodyCell.HERO]: HERO }

export class MainScene extends Phaser.Scene {
  private grid!: CellGrid
  private player!: PlayerState
  private body!: CellBody
  private pristine!: CellBody
  private health = new Health()
  private marksKey = ''
  private hurtFlash = 0
  // Alive, shattering (slow motion), dead (waiting for Jump), or gathering back together at the start.
  private mode: 'alive' | 'dying' | 'dead' | 'returning' = 'alive'
  private modeTime = 0
  private jumpWasDown = false
  private shatter = new Shatter()
  private gather = new Gather()
  private squash = new Squash()
  private dust = new Dust()
  private rings = new Rings()
  private slideDust = 0
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
    this.pristine = CellBody.square(PLAYER.size)
    this.body = this.pristine
    hud.set({ health: this.health.value, maxHealth: HEALTH.max })
    this.keys = this.input.keyboard!.addKeys('A,D,W,LEFT,RIGHT,UP,SPACE,K') as Record<string, Phaser.Input.Keyboard.Key>

    this.cameras.main.setBounds(0, 0, ROOM_W, ROOM_H)
    this.fitCamera()
    this.scale.on('resize', () => this.fitCamera())

    if (import.meta.env.DEV) {
      const w = window as unknown as Record<string, unknown>
      w.__player = () => ({
        ...this.player, sx: this.squash.sx, sy: this.squash.sy, dust: this.dust.motes.length, rings: this.rings.rings.length,
        health: this.health.value, marks: this.health.marks.length, mode: this.mode, shards: this.shatter.shards.length,
      })
      w.__hurt = (n: number) => this.hurt(n, 0.5)
      w.__teleport = (x: number, y: number) => Object.assign(this.player, { x, y, vx: 0, vy: 0, grounded: false, fallDist: 0 })
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
    let move = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0) || touchInput.moveX
    let jump = k.SPACE.isDown || k.K.isDown || k.W.isDown || k.UP.isDown || touchInput.jump
    const pad = this.input.gamepad?.pad1
    if (pad) {
      const x = pad.leftStick.x
      if (Math.abs(x) > 0.3) move = x
      if (pad.left) move = -1
      if (pad.right) move = 1
      if (pad.A) jump = true
    }
    return { move, jump }
  }

  update(_time: number, deltaMs: number): void {
    const realDt = Math.min(0.05, deltaMs / 1000)
    this.modeTime += realDt
    // A beat of slow motion as the body shatters.
    const dt = this.mode === 'dying' && this.modeTime < 0.5 ? realDt * 0.3 : realDt
    const input = this.readInput()
    const jumpPressed = input.jump && !this.jumpWasDown
    this.jumpWasDown = input.jump
    this.shatter.update(dt, this.grid.isSolid)

    if (this.mode !== 'alive') {
      if (this.mode === 'dying' && this.modeTime > 1.1) this.setMode('dead')
      else if (this.mode === 'dead' && jumpPressed) this.startReturn()
      else if (this.mode === 'returning') {
        this.gather.update(realDt)
        if (this.gather.done) {
          this.setMode('alive')
          this.squash.land(0.6)
          this.dust.puff(this.player.x, this.player.y, 8, 40)
        }
      }
      this.dust.update(dt)
      this.rings.update(dt)
      this.squash.update(dt)
      this.followCamera(dt)
      this.draw()
      return
    }

    const p = this.player
    const ev = stepPlayer(p, input, dt, this.grid.isSolid)

    if (ev.jumped) { this.squash.jump(); this.dust.puff(p.x, p.y, 6, 30) }
    if (ev.doubleJumped) { this.squash.set(SQUASH.doubleJump[0], SQUASH.doubleJump[1]); this.rings.add(p.x, p.y, 3, 34, 0.28) }
    if (ev.wallJumped) {
      this.squash.jump()
      this.dust.puff(p.x + ev.wallJumped * (PLAYER.size / 2), p.y - PLAYER.size / 2, 5, 25, ev.wallJumped === 1 ? -1 : 1)
    }
    if (ev.grabbed) this.squash.set(0.9, 1.08)
    this.slideDust -= dt
    if (ev.wallSliding && this.slideDust <= 0) {
      this.slideDust = 0.07
      this.dust.puff(p.x + ev.wallSliding * (PLAYER.size / 2), p.y - PLAYER.size * 0.6, 1, 8, ev.wallSliding === 1 ? -1 : 1)
    }
    if (ev.landed >= 0) { this.squash.land(ev.landed); this.dust.puff(p.x, p.y, 4 + Math.round(ev.landed * 8), 25 + ev.landed * 45) }
    const damage = fallDamage(ev.fell)
    if (damage > 0) this.hurt(damage, 0.25 + Math.random() * 0.5)
    if (this.mode !== 'alive') return
    // Stand-in rest spot: heals while standing on it.
    if (p.grounded && p.x > REST_SPOT.x0 && p.x < REST_SPOT.x1 && this.health.value < HEALTH.max) {
      this.health.heal(HEALTH.restRate * dt)
    }
    this.hurtFlash = Math.max(0, this.hurtFlash - dt)
    this.syncHealth()
    if (ev.skidded) this.dust.puff(p.x - p.facing * 4, p.y, 3, 25, p.facing === 1 ? -1 : 1)
    this.squash.update(dt, p.grounded ? 0 : Math.max(0, p.vy) / PLAYER.maxFall)
    this.dust.update(dt)
    this.rings.update(dt)

    this.followCamera(dt)
    this.draw()
  }

  private followCamera(dt: number): void {
    const t = 1 - Math.exp(-(this.mode === 'returning' ? 5 : 8) * dt)
    this.cam.x += (this.player.x - this.cam.x) * t
    this.cam.y += (this.player.y - PLAYER.size - this.cam.y) * t
    this.cameras.main.centerOn(this.cam.x, this.cam.y)
  }

  private setMode(mode: MainScene['mode']): void {
    this.mode = mode
    this.modeTime = 0
    hud.set({ dead: mode === 'dead' })
  }

  /** Damage from anywhere (falls, for now). The body squashes, flashes and dents; at zero it shatters. */
  private hurt(amount: number, at: number): void {
    const p = this.player
    const dead = this.health.hurt(amount, 'dent', at)
    this.squash.set(1.35, 0.7) // the guide's getting-hurt squash
    this.hurtFlash = 0.1
    this.dust.puff(p.x, p.y, 10, 60)
    this.syncHealth()
    if (dead) {
      const w = this.body.width, h = this.body.height
      this.shatter.burst(this.body.cells, w, h, p.x - w / 2, p.y - h)
      this.setMode('dying')
    }
  }

  /** Jump pressed after dying: back to the start, whole, the body gathering together from cells. */
  private startReturn(): void {
    this.health.reset()
    this.syncHealth()
    Object.assign(this.player, createPlayer(SPAWN.x, SPAWN.y))
    this.squash.set(1, 1)
    const w = this.pristine.width, h = this.pristine.height
    this.gather.start(this.pristine.cells, w, h, SPAWN.x - w / 2, SPAWN.y - h)
    this.setMode('returning')
  }

  /** The top of the floor at column x (for drawing the rest spot). */
  private restY(x: number): number {
    let y = ROOM_H - 5
    while (y > 0 && this.grid.isSolid(x, y)) y--
    return y + 1
  }

  /** Keeps the bar and the body's marks in step with health. */
  private syncHealth(): void {
    hud.set({ health: this.health.value })
    const key = this.health.marks.map((m) => `${m.seed}:${Math.round(m.amount)}`).join(',')
    if (key !== this.marksKey) {
      this.marksKey = key
      this.body = this.health.marks.length ? this.pristine.withMarks(this.health.marks, HEALTH.fallCap) : this.pristine
    }
  }

  private draw(): void {
    const g = this.gfx
    const p = this.player
    g.clear()

    // The stand-in rest spot: a pale strip on the floor that pulses gently.
    const pulse = 0.25 + 0.15 * Math.sin(this.time.now / 400)
    g.fillStyle(HERO, pulse)
    for (let x = REST_SPOT.x0; x < REST_SPOT.x1; x += 2) g.fillRect(x, this.restY(x) - 1, 1, 1)

    for (const m of this.dust.motes) {
      g.fillStyle(DUST, Math.min(1, (m.life / m.max) * 1.4))
      g.fillRect(m.x - 0.5, m.y - 0.5, 1, 1)
    }

    // Rings: an outline of cells that grows and fades.
    for (const r of this.rings.rings) {
      g.fillStyle(DUST, (r.life / r.max) * 0.9)
      const n = Math.max(12, Math.round(r.r * 5))
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2
        g.fillRect(Math.floor(r.x + Math.cos(a) * r.r), Math.floor(r.y + Math.sin(a) * r.r * 0.45), 1, 1)
      }
    }

    // Shattered pieces, where the player died.
    for (const s of this.shatter.shards) {
      g.fillStyle(BODY_COLOURS[s.cell], 1)
      g.fillRect(s.x - 0.5, s.y - 0.5, 1, 1)
    }

    if (this.mode === 'returning') {
      for (const c of this.gather.positions()) {
        g.fillStyle(BODY_COLOURS[c.cell], 1)
        g.fillRect(c.x, c.y, 1, 1)
      }
      return
    }
    if (this.mode !== 'alive') return

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
          g.fillStyle(this.hurtFlash > 0 ? (c === BodyCell.INK ? INK : DAMAGE) : BODY_COLOURS[c], 1)
          g.fillRect(left + x, top + y, run, 1)
        }
        x += run
      }
    }
  }
}
