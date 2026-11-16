import * as Phaser from 'phaser'
import { Dust } from '../effects/dust.ts'
import { Rings } from '../effects/rings.ts'
import { Gather, Shatter, type CellPoint } from '../effects/shatter.ts'
import { Caster } from '../magic/caster.ts'
import { Dummy } from '../magic/dummies.ts'
import { Magic, type Body } from '../magic/effects.ts'
import { DEFAULT_HOTBAR, describe } from '../magic/hotbar.ts'
import { elementInfo, Mana, type Spell } from '../magic/spells.ts'
import { hud, spellEdits } from '../bridge.ts'
import { touchInput } from '../input/touchInput.ts'
import { BodyCell, type CellBody } from '../player/body.ts'
import { feet, FIG, figureBody, HAND_CELLS, hands, type Face, type Pose } from '../player/figure.ts'
import { fallDamage, Health, HEALTH } from '../player/health.ts'
import { createPlayer, stepPlayer, type PlayerState } from '../player/movement.ts'
import { Squash } from '../player/squash.ts'
import { PLAYER, SQUASH } from '../player/tuning.ts'
import { DAMAGE, DUST, FOOT, HERO, INK } from '../style/tokens.ts'
import { Material, type CellGrid } from '../world/grid.ts'
import { step as simulate, STEPS_PER_SECOND } from '../world/simulate.ts'
import { buildTestRoom, REST_SPOT, ROOM_H, ROOM_W, SPAWN } from '../world/testRoom.ts'
import { paintGrid } from '../world/worldTexture.ts'

const FOOT_CELL = 3
const BODY_COLOURS: Record<number, number> = { [BodyCell.INK]: INK, [BodyCell.HERO]: HERO, [FOOT_CELL]: FOOT }

export class MainScene extends Phaser.Scene {
  private grid!: CellGrid
  private magic!: Magic
  private caster = new Caster()
  private mana = new Mana()
  private hotbar: Spell[] = DEFAULT_HOTBAR.map((s) => ({ ...s, elements: [...s.elements] }))
  private slot = 0
  private aim = { x: 0, y: 0, dirX: 1, dirY: 0 } // where the catalyst points, in world cells
  private aimSource: 'mouse' | 'pad' | 'touch' = 'mouse'
  private playerBody!: Body
  private dummies: Dummy[] = []
  private worldTex!: Phaser.Textures.CanvasTexture
  private worldImg!: ImageData
  private simAcc = 0
  private player!: PlayerState
  private body!: CellBody
  private face: Face = 'open'
  private hurtFace = 0
  private blinkIn = 3
  private blinkFor = 0
  private walkPhase = 0
  private health = new Health()
  private bodyKey = ''
  private hurtFlash = 0
  // Alive, shattering (slow motion), dead (waiting for Jump), or gathering back together at the start.
  private mode: 'alive' | 'dying' | 'dead' | 'returning' = 'alive'
  private modeTime = 0
  private jumpWasDown = false
  private jumpLatch = false // a key press since the last frame, so a tap shorter than a frame still counts
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
    this.worldTex = this.textures.createCanvas('world', ROOM_W, ROOM_H)!
    this.worldImg = this.worldTex.getContext().createImageData(ROOM_W, ROOM_H)
    this.paintWorld()
    this.add.image(0, 0, 'world').setOrigin(0, 0)

    this.gfx = this.add.graphics()
    this.player = createPlayer(SPAWN.x, SPAWN.y)
    this.body = figureBody('open')
    hud.set({ health: this.health.value, maxHealth: HEALTH.max })
    this.keys = this.input.keyboard!.addKeys('A,D,W,LEFT,RIGHT,UP,SPACE,K,ONE,TWO,THREE,FOUR,B') as Record<string, Phaser.Input.Keyboard.Key>
    this.input.mouse?.disableContextMenu()
    // A tap on the world shorter than a frame still casts: latch where it landed until the next update.
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (!ptr.wasTouch) return
      const wp = ptr.positionToCamera(this.cameras.main) as Phaser.Math.Vector2
      this.tapLatch = { x: wp.x, y: wp.y }
    })
    this.magic = new Magic(this.grid)
    this.playerBody = this.makePlayerBody()
    this.dummies = [new Dummy(100, 159), new Dummy(262, 159)]
    this.magic.bodies = [this.playerBody, ...this.dummies]
    this.syncHotbar()
    const jumpKeys = new Set(['Space', 'KeyK', 'KeyW', 'ArrowUp'])
    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => {
      if (jumpKeys.has(e.code) && !e.repeat) this.jumpLatch = true
    })

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
      w.__world = () => this.grid
      w.__magic = () => ({ mana: this.mana.value, slot: this.slot, projectiles: this.magic.projectiles.length, hotbar: this.hotbar, charge: this.caster.charge })
      w.__setSpell = (i: number, spell: Spell) => { this.hotbar[i] = spell; this.syncHotbar() }
      w.__infiniteMana = (on: boolean) => { this.mana.infinite = on }
      w.__dummies = () => this.dummies.map((d) => ({ x: d.x, y: d.y, vx: d.vx, frozen: d.frozen, healed: d.healed, scorched: d.scorched }))
      w.__runes = () => this.magic.runes.length
      w.__Material = Material
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
    let jump = k.SPACE.isDown || k.K.isDown || k.W.isDown || k.UP.isDown || touchInput.jump || this.jumpLatch || touchInput.jumpTap
    this.jumpLatch = false
    touchInput.jumpTap = false
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
    // The spell builder: B or the gamepad's Select opens it; while it's open the game pauses.
    for (const e of spellEdits.splice(0)) { this.hotbar[e.slot] = e.spell; this.caster.reset(); this.syncHotbar() }
    const pad0 = this.input.gamepad?.pad1
    const select = !!pad0 && pad0.buttons[8]?.pressed
    const open = hud.get().builderOpen
    if ((this.keys.B.isDown && !this.builderKey) || (select && !this.selectHeld)) hud.set({ builderOpen: !open })
    this.builderKey = this.keys.B.isDown
    this.selectHeld = select
    const nowOpen = hud.get().builderOpen
    if (nowOpen !== this.wasOpen) {
      // Hand the keyboard to the builder while it's open, and forget keys held across the switch.
      this.input.keyboard!.enabled = !nowOpen
      this.input.keyboard!.resetKeys()
      this.builderKey = false
      this.wasOpen = nowOpen
    }
    if (nowOpen) return
    const realDt = Math.min(0.05, deltaMs / 1000)
    this.modeTime += realDt
    // A beat of slow motion as the body shatters.
    const dt = this.mode === 'dying' && this.modeTime < 0.5 ? realDt * 0.3 : realDt
    const input = this.readInput()
    const jumpPressed = input.jump && !this.jumpWasDown
    this.jumpWasDown = input.jump
    this.shatter.update(dt, this.grid.isSolid)
    // The world simulation runs at a fixed rate, whatever the frame rate.
    this.simAcc += dt * STEPS_PER_SECOND
    for (let n = 0; this.simAcc >= 1 && n < 4; n++, this.simAcc--) simulate(this.grid)
    if (this.simAcc > 4) this.simAcc = 0

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
    const ev = stepPlayer(p, input, dt, this.grid.isSolid, { submerged: this.submerged() })
    this.updateMagic(dt)

    if (ev.jumped) { this.squash.jump(); this.dust.puff(p.x, p.y, 6, 30) }
    if (ev.doubleJumped) { this.squash.set(SQUASH.doubleJump[0], SQUASH.doubleJump[1]); this.rings.add(p.x, p.y, 3, 34, 0.28) }
    if (ev.wallJumped) {
      this.squash.jump()
      this.dust.puff(p.x + ev.wallJumped * (PLAYER.width / 2), p.y - PLAYER.height / 2, 5, 25, ev.wallJumped === 1 ? -1 : 1)
    }
    if (ev.grabbed) this.squash.set(0.9, 1.08)
    this.slideDust -= dt
    if (ev.wallSliding && this.slideDust <= 0) {
      this.slideDust = 0.07
      this.dust.puff(p.x + ev.wallSliding * (PLAYER.width / 2), p.y - PLAYER.height * 0.6, 1, 8, ev.wallSliding === 1 ? -1 : 1)
    }
    if (ev.landed >= 0) { this.squash.land(ev.landed); this.dust.puff(p.x, p.y, 4 + Math.round(ev.landed * 8), 25 + ev.landed * 45) }
    // Landing on something soft (sand, rubble, ash) halves the damage.
    const under = this.grid.get(Math.floor(p.x), Math.floor(p.y))
    const soft = under === Material.SAND || under === Material.RUBBLE || under === Material.ASH
    const damage = Math.round(fallDamage(ev.fell) * (soft ? 0.5 : 1))
    if (damage > 0) this.hurt(damage, 0.25 + Math.random() * 0.5)
    if (this.mode !== 'alive') return
    // Stand-in rest spot: heals while standing on it.
    if (p.grounded && p.x > REST_SPOT.x0 && p.x < REST_SPOT.x1 && this.health.value < HEALTH.max) {
      this.health.heal(HEALTH.restRate * dt)
    }
    this.hurtFlash = Math.max(0, this.hurtFlash - dt)
    if (p.grounded) this.walkPhase += Math.abs(p.vx) * dt * 0.2
    this.updateFace(dt)
    this.syncHealth()
    if (ev.skidded) this.dust.puff(p.x - p.facing * 4, p.y, 3, 25, p.facing === 1 ? -1 : 1)
    this.squash.update(dt, p.grounded ? 0 : Math.max(0, p.vy) / PLAYER.maxFall)
    this.dust.update(dt)
    this.rings.update(dt)

    this.followCamera(dt)
    this.draw()
  }

  /** The player as something magic can heal and shove. */
  private makePlayerBody(): Body {
    const body = {
      x: 0,
      y: 0,
      w: PLAYER.width,
      h: PLAYER.height,
      isCaster: true,
      heal: (n: number) => { if (this.mode === 'alive') this.health.heal(n) },
      impulse: (vx: number, vy: number) => {
        const p = this.player
        p.vx += vx; p.vy += vy; p.boost = 0.35; p.grounded = false; p.onWall = 0
      },
      thrust: (ax: number, ay: number, dt: number) => {
        const p = this.player
        p.vx += ax * dt; p.vy += ay * dt; p.boost = 0.15; p.onWall = 0
        if (ay < 0) p.grounded = false
      },
    }
    // Position always reads the player's current one.
    Object.defineProperties(body, { x: { get: () => this.player.x }, y: { get: () => this.player.y } })
    return body
  }

  /** Aiming, picking spells and casting, from mouse, gamepad or the touch aim stick. */
  private updateMagic(dt: number): void {
    const p = this.player
    const k = this.keys
    // Picking a spell: 1–4, a tapped hotbar slot, or the gamepad's bumpers.
    const keySlot = [k.ONE, k.TWO, k.THREE, k.FOUR].findIndex((key) => Phaser.Input.Keyboard.JustDown(key))
    let pick = keySlot >= 0 ? keySlot : touchInput.pickSlot
    touchInput.pickSlot = -1
    const pad = this.input.gamepad?.pad1
    if (pad) {
      const lb = pad.L1 > 0, rb = pad.R1 > 0
      if (lb && !this.padBumpers.lb) pick = (this.slot + 3) % 4
      if (rb && !this.padBumpers.rb) pick = (this.slot + 1) % 4
      this.padBumpers = { lb, rb }
    }
    if (pick >= 0 && pick < this.hotbar.length && pick !== this.slot) { this.slot = pick; this.caster.reset(); this.syncHotbar() }

    // Aim: a finger on the world (it aims and casts there while it's down), else the gamepad's right
    // stick when pushed, else the mouse.
    const centreY = p.y - PLAYER.height * 0.6
    const pointer = this.input.activePointer
    let down = false
    const finger = this.input.manager.pointers.find((ptr) => ptr.wasTouch && ptr.isDown)
    if (finger) {
      this.aimSource = 'touch'
      const wp = finger.positionToCamera(this.cameras.main) as Phaser.Math.Vector2
      this.aimAt(wp.x, wp.y, centreY)
      down = true
    } else if (this.tapLatch) {
      this.aimSource = 'touch'
      this.aimAt(this.tapLatch.x, this.tapLatch.y, centreY)
      down = true // a tap: pressed this frame, released the next
    } else if (pad && Math.hypot(pad.rightStick.x, pad.rightStick.y) > 0.3) {
      this.aimSource = 'pad'
      const { x, y } = pad.rightStick, m = Math.hypot(x, y)
      this.aimAt(p.x + (x / m) * (25 + Math.min(1, m) * 75), centreY + (y / m) * (25 + Math.min(1, m) * 75), centreY)
    } else if (!pointer.wasTouch && (pointer.x !== this.lastPointer.x || pointer.y !== this.lastPointer.y || this.aimSource === 'mouse')) {
      this.aimSource = 'mouse'
      const wp = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2
      this.aimAt(wp.x, wp.y, centreY)
      this.lastPointer = { x: pointer.x, y: pointer.y }
    }
    if (this.aimSource === 'mouse' && !pointer.wasTouch && pointer.leftButtonDown()) down = true
    if (pad && pad.R2 > 0.5) down = true
    this.tapLatch = null

    const spell = this.hotbar[this.slot]
    const casts = this.caster.update(spell, down, dt, this.mana)
    const tip = this.catalystTip()
    for (const ev of casts) this.magic.cast(spell, ev, tip, this.aim, this.playerBody)
    if (this.caster.channelling && Math.random() < 0.5) {
      this.magic.sparks.push({ x: tip.x, y: tip.y, vx: (Math.random() - 0.5) * 20, vy: -10 - Math.random() * 15, life: 0.3, max: 0.3, colour: elementInfo(spell.elements[0]).colour })
    }
    this.mana.update(dt, this.caster.casting)
    this.magic.update(dt)
    for (const d of this.dummies) {
      d.update(dt, this.grid.isSolid)
      if (d.y > 400) Object.assign(d, { x: d.home.x, y: d.home.y, vx: 0, vy: 0 })
    }
    hud.set({ mana: this.mana.value, charge: this.caster.charging ? this.caster.charge : 0 })
  }
  private padBumpers = { lb: false, rb: false }
  private lastPointer = { x: -1, y: -1 }
  private tapLatch: { x: number; y: number } | null = null
  private builderKey = false
  private wasOpen = false
  private selectHeld = false

  private aimAt(x: number, y: number, centreY: number): void {
    const dx = x - this.player.x, dy = y - centreY, m = Math.hypot(dx, dy) || 1
    this.aim = { x, y, dirX: dx / m, dirY: dy / m }
  }

  /** The catalyst is held in the hand on the side being aimed at (#69); its tip is where spells leave. */
  private catalystHand(top: number): { x: number; y: number } {
    const p = this.player
    return { x: p.x + this.aim.dirX * 7.5, y: top + 7 + this.aim.dirY * 4.5 }
  }

  private catalystTip(): { x: number; y: number } {
    const L = this.layout()
    const h = this.catalystHand(L.top)
    return { x: h.x + this.aim.dirX * 6, y: h.y + this.aim.dirY * 6 }
  }

  private syncHotbar(): void {
    hud.set({ slots: this.hotbar.map(describe), spells: this.hotbar.map((s) => ({ ...s, elements: [...s.elements] })), activeSlot: this.slot, maxMana: this.mana.max })
  }

  /** How much of the player's body is in liquid, 0–1. */
  private submerged(): number {
    const p = this.player
    let wet = 0, all = 0
    for (let y = Math.floor(p.y - PLAYER.height); y < p.y; y += 2) {
      for (let x = Math.floor(p.x - PLAYER.width / 2); x < p.x + PLAYER.width / 2; x += 2) {
        all++
        if (this.grid.get(x, y) === Material.WATER) wet++
      }
    }
    return all ? wet / all : 0
  }

  private paintWorld(): void {
    paintGrid(this.grid, this.worldImg)
    this.worldTex.getContext().putImageData(this.worldImg, 0, 0)
    this.worldTex.refresh()
  }

  private followCamera(dt: number): void {
    const t = 1 - Math.exp(-(this.mode === 'returning' ? 5 : 8) * dt)
    this.cam.x += (this.player.x - this.cam.x) * t
    this.cam.y += (this.player.y - PLAYER.height - this.cam.y) * t
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
    this.hurtFace = 0.5
    this.updateFace(0)
    this.dust.puff(p.x, p.y, 10, 60)
    this.syncHealth()
    if (dead) {
      this.shatter.burst(this.figureCells(), p.x, p.y - PLAYER.height / 2)
      this.setMode('dying')
    }
  }

  /** Jump pressed after dying: back to the start, whole, the body gathering together from cells. */
  private startReturn(): void {
    this.health.reset()
    this.hurtFace = 0
    this.updateFace(0)
    this.syncHealth()
    Object.assign(this.player, createPlayer(SPAWN.x, SPAWN.y))
    this.squash.set(1, 1)
    this.gather.start(this.figureCells())
    this.setMode('returning')
  }

  /** The top of the floor at column x (for drawing the rest spot). */
  private restY(x: number): number {
    let y = ROOM_H - 5
    while (y > 0 && this.grid.isSolid(x, y)) y--
    return y + 1
  }

  /** Blinks every few seconds; a grimace for half a second after being hurt. */
  private updateFace(dt: number): void {
    this.hurtFace = Math.max(0, this.hurtFace - dt)
    this.blinkIn -= dt
    if (this.blinkIn <= 0) { this.blinkFor = 0.12; this.blinkIn = 2.5 + Math.random() * 2 }
    this.blinkFor = Math.max(0, this.blinkFor - dt)
    this.face = this.hurtFace > 0 ? 'hurt' : this.blinkFor > 0 ? 'blink' : 'open'
  }

  /** Keeps the bar, the face and the body's marks in step. */
  private syncHealth(): void {
    hud.set({ health: this.health.value })
    const key = this.face + '|' + this.health.marks.map((m) => `${m.seed}:${Math.round(m.amount)}`).join(',')
    if (key !== this.bodyKey) {
      this.bodyKey = key
      const base = figureBody(this.face)
      this.body = this.health.marks.length ? base.withMarks(this.health.marks, HEALTH.fallCap) : base
    }
  }

  private pose(): Pose {
    const p = this.player
    return {
      walkPhase: this.walkPhase,
      walking: p.grounded && Math.abs(p.vx) > 5,
      airborne: !p.grounded && p.onWall === 0,
      wall: p.onWall,
      hurt: this.hurtFace > 0,
      time: this.time.now / 1000,
    }
  }

  /** The figure's parts, laid out where they're drawn: feet, then the (squashed) body, then hands. */
  private layout() {
    const p = this.player
    const pose = this.pose()
    const w = Math.max(4, Math.round(FIG.bodyW * this.squash.sx))
    const h = Math.max(4, Math.round(FIG.bodyH * this.squash.sy))
    const bodyBottom = p.y - FIG.footH - FIG.feetGap // the body stands on the gap above the feet
    const left = p.x - w / 2
    const top = bodyBottom - h
    return { w, h, left, top, cells: this.body.resample(w, h), feet: feet(p.x, p.y, pose), hands: hands(p.x, top, h, pose) }
  }

  /** Every cell of the figure, where it is now (for the shatter and the gather). */
  private figureCells(): CellPoint[] {
    const L = this.layout()
    const out: CellPoint[] = []
    for (const f of L.feet) for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) out.push({ x: Math.round(f.x) + x, y: Math.round(f.y) + y, cell: FOOT_CELL })
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
      const c = L.cells[y * L.w + x]
      if (c !== BodyCell.EMPTY) out.push({ x: L.left + x, y: L.top + y, cell: c })
    }
    for (const hnd of L.hands) for (const c of HAND_CELLS) out.push({ x: hnd.x + c.dx, y: hnd.y + c.dy, cell: c.cell })
    return out
  }

  private draw(): void {
    this.paintWorld()
    const g = this.gfx
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

    // The figure: floating feet, the body (redrawn at its squashed size in whole cells), floating hands.
    const L = this.layout()
    const flash = this.hurtFlash > 0
    for (const f of L.feet) {
      g.fillStyle(FOOT, 1)
      g.fillRect(f.x, f.y, f.w, f.h)
    }
    for (let y = 0; y < L.h; y++) {
      let x = 0
      while (x < L.w) {
        const c = L.cells[y * L.w + x]
        let run = 1
        while (x + run < L.w && L.cells[y * L.w + x + run] === c) run++
        if (c !== BodyCell.EMPTY) {
          g.fillStyle(flash ? (c === BodyCell.INK ? INK : DAMAGE) : BODY_COLOURS[c], 1)
          g.fillRect(L.left + x, L.top + y, run, 1)
        }
        x += run
      }
    }
    // Hands: the one on the aiming side holds the catalyst out towards the aim.
    const hold = this.catalystHand(L.top)
    const holdSide = this.aim.dirX >= 0 ? 1 : 0
    const drawn = L.hands.map((h, i) => (i === holdSide ? { x: hold.x - 1, y: hold.y - 1 } : h))
    // The stand-in catalyst: a dark rod from the hand, a gem in the spell's first element's colour.
    const spell = this.hotbar[this.slot]
    const gem = elementInfo(spell.elements[0]).colour
    for (let i = 1; i <= 5; i++) {
      g.fillStyle(0x5c4630, 1)
      g.fillRect(Math.floor(hold.x + this.aim.dirX * i), Math.floor(hold.y + this.aim.dirY * i), 1, 1)
    }
    const tip = { x: hold.x + this.aim.dirX * 6, y: hold.y + this.aim.dirY * 6 }
    const glow = this.caster.charging ? 1 + this.caster.charge * 2 : this.caster.channelling ? 1.5 : 1
    g.fillStyle(gem, 1)
    g.fillRect(Math.floor(tip.x - glow / 2), Math.floor(tip.y - glow / 2), Math.ceil(glow), Math.ceil(glow))
    for (const hnd of drawn) {
      for (const c of HAND_CELLS) {
        g.fillStyle(flash && c.cell === BodyCell.HERO ? DAMAGE : BODY_COLOURS[c.cell], 1)
        g.fillRect(hnd.x + c.dx, hnd.y + c.dy, 1, 1)
      }
    }

    // Stand-in dummies: grey blocks with dot eyes, tinted by what's affecting them.
    for (const d of this.dummies) {
      const left = Math.round(d.x - d.w / 2), top = Math.round(d.y - d.h)
      const body = d.frozen > 0 ? 0xa8dcf0 : d.scorched > 0 ? 0xd88a5a : d.wet > 0 ? 0x7f9fc8 : 0x8a8aa0
      g.fillStyle(INK, 1); g.fillRect(left, top, d.w, d.h)
      g.fillStyle(body, 1); g.fillRect(left + 1, top + 1, d.w - 2, d.h - 2)
      g.fillStyle(INK, 1); g.fillRect(left + 3, top + 3, 1, 2); g.fillRect(left + d.w - 4, top + 3, 1, 2)
      if (d.healed > 0) { g.fillStyle(0x4fdc6a, d.healed / 0.6); for (let i = 0; i < 4; i++) g.fillRect(left + 1 + ((i * 7 + Math.floor(this.time.now / 90)) % (d.w - 2)), top - 2 - (i % 2) * 2, 1, 1) }
    }

    // Spells: beams, runes, waves, wisps, orbiting motes, projectiles, sparks, flashes, and an aim marker.
    for (const b of this.magic.beams) {
      const n = Math.ceil(Math.hypot(b.x1 - b.x0, b.y1 - b.y0))
      for (let i = 0; i <= n; i++) {
        const t = i / Math.max(1, n)
        g.fillStyle(b.colour, 0.55 + 0.45 * Math.random())
        g.fillRect(Math.floor(b.x0 + (b.x1 - b.x0) * t), Math.floor(b.y0 + (b.y1 - b.y0) * t), 1, 1)
      }
    }
    for (const r of this.magic.runes) {
      const pulse = 0.5 + 0.5 * Math.sin(r.age * 5)
      g.fillStyle(elementInfo(r.els[0]).colour, r.armed ? 0.6 + 0.4 * pulse : 0.35)
      for (let i = 0; i < 6; i++) g.fillRect(Math.floor(r.x + Math.cos(i * 1.047) * 3), Math.floor(r.y + Math.sin(i * 1.047) * 3), 1, 1)
      g.fillRect(Math.floor(r.x), Math.floor(r.y), 1, 1)
    }
    for (const w of this.magic.waves) {
      const n = Math.max(12, Math.round(w.r * 4))
      g.fillStyle(elementInfo(w.els[0]).colour, 0.8 * (1 - w.r / w.max) + 0.2)
      for (let i = 0; i < n; i++) g.fillRect(Math.floor(w.x + Math.cos((i / n) * 6.283) * w.r), Math.floor(w.y + Math.sin((i / n) * 6.283) * w.r), 1, 1)
    }
    for (const w of this.magic.wisps) {
      const x = Math.round(w.x), y = Math.round(w.y), c = elementInfo(w.els[0]).colour
      g.fillStyle(c, 1)
      g.fillRect(x - 1, y - 2, 3, 5); g.fillRect(x - 2, y - 1, 5, 3)
      g.fillStyle(INK, 1); g.fillRect(x, y, 1, 1)
    }
    for (const m of this.magic.motes) {
      g.fillStyle(elementInfo(m.els[0]).colour, 1)
      g.fillRect(Math.floor(m.x), Math.floor(m.y), 2, 2)
    }
    for (const f of this.magic.flashes) {
      const t = 1 - f.life / f.max
      const r = f.r * (0.4 + 0.6 * t)
      g.fillStyle(f.colour, (f.life / f.max) * 0.9)
      const n = Math.max(12, Math.round(r * 5))
      for (let i = 0; i < n; i++) g.fillRect(Math.floor(f.x + Math.cos((i / n) * 6.283) * r), Math.floor(f.y + Math.sin((i / n) * 6.283) * r), 1, 1)
    }
    for (const s of this.magic.sparks) {
      g.fillStyle(s.colour, Math.min(1, (s.life / s.max) * 1.5))
      g.fillRect(s.x - 0.5, s.y - 0.5, 1, 1)
    }
    for (const pr of this.magic.projectiles) {
      g.fillStyle(elementInfo(pr.els[0]).colour, 1)
      g.fillRect(Math.floor(pr.x) - 1, Math.floor(pr.y) - 1, 3, 3)
      g.fillStyle(0xffffff, 0.8)
      g.fillRect(Math.floor(pr.x), Math.floor(pr.y), 1, 1)
    }
    if (this.aimSource === 'pad') {
      g.fillStyle(0xffffff, 0.5)
      g.fillRect(Math.floor(this.aim.x) - 1, Math.floor(this.aim.y), 3, 1)
      g.fillRect(Math.floor(this.aim.x), Math.floor(this.aim.y) - 1, 1, 3)
    }
  }
}
