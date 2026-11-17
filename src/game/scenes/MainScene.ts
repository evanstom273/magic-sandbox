import * as Phaser from 'phaser'
import { Dust } from '../effects/dust.ts'
import { Rings } from '../effects/rings.ts'
import { Gather, Shatter, type CellPoint } from '../effects/shatter.ts'
import { Caster } from '../magic/caster.ts'
import { Dummy } from '../magic/dummies.ts'
import { Magic, type Body } from '../magic/effects.ts'
import { DEFAULT_HOTBAR, describe } from '../magic/hotbar.ts'
import { elementInfo, followUpCost, Mana, type Spell } from '../magic/spells.ts'
import { hud, spellEdits } from '../bridge.ts'
import { touchInput } from '../input/touchInput.ts'
import { BodyCell, type CellBody } from '../player/body.ts'
import { feet, FIG, figureBody, HAND_CELLS, hands, type Face, type Pose } from '../player/figure.ts'
import { fallDamage, Health, HEALTH } from '../player/health.ts'
import { createPlayer, stepPlayer, type PlayerState, type Surroundings } from '../player/movement.ts'
import { Squash } from '../player/squash.ts'
import { PLAYER, SQUASH } from '../player/tuning.ts'
import { DAMAGE, DUST, FOOT, HERO, INK } from '../style/tokens.ts'
import { Kind, KIND, Material, MATERIALS, type CellGrid } from '../world/grid.ts'
import { step as simulate, STEPS_PER_SECOND } from '../world/simulate.ts'
import { buildTestRoom, REST_SPOT, ROOM_H, ROOM_W, SPAWN } from '../world/testRoom.ts'
import { paintGrid } from '../world/worldTexture.ts'
import { LIGHTING, LightMap, type LightSource } from '../world/light.ts'

const FOOT_CELL = 3

/** Damage a second from touching these (Element Codex: burned, eaten, scalded, poisoned). Claude's numbers, to tune. */
const HURTS: Partial<Record<number, number>> = {
  [Material.LAVA]: 45, [Material.MOLTEN]: 45, [Material.PLASMA]: 60, [Material.BURNING_THERMITE]: 60,
  [Material.FIRE]: 12, [Material.ACID]: 20, [Material.STEAM]: 4, [Material.MIASMA]: 4, [Material.MERCURY]: 3,
}
/** Landing on these halves a fall's damage (snow and slime take all of it). Moss counts. */
const SOFT = new Set<number>([Material.SAND, Material.RUBBLE, Material.ASH, Material.DIRT, Material.MUD, Material.PLANT, Material.FUNGUS, Material.SEEDS])
/**
 * Liquid mana: standing in it refills mana, using the pool up as it does. Each cell gives about
 * what it cost to cast, so casting mana can't make mana from nothing. Claude's numbers, to tune.
 */
const MANA_POOL = { rate: 25, perCell: 0.1 }

interface Feel extends Surroundings {
  hurt: number // the worst damage a second from what's touching the body
  hurtAt: number // 0–1 across the body, where it's touching
  mana: number[] // liquid mana cells touching the body
}
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
  private light = new LightMap(ROOM_W, ROOM_H)
  /** The world's darkness and light; `?light=0` in the address turns it off (all lit). */
  private lighting = new URLSearchParams(location.search).get('light') !== '0'
  private lightFrame = 0
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
  private burnAcc = 0 // burn damage building up, taken in bites
  private magicAcc = 0 // the same, from magic that eats cells
  private manaDrain = 0 // liquid mana soaked up, in cells, still to remove from the pool
  private blastCool = 0 // a moment after a blast hurts before another can
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
    this.keys = this.input.keyboard!.addKeys('A,D,W,LEFT,RIGHT,UP,SPACE,K,ONE,TWO,THREE,FOUR') as Record<string, Phaser.Input.Keyboard.Key>
    this.input.mouse?.disableContextMenu()
    // A tap on the world shorter than a frame still casts: latch where it landed until the next update.
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (!ptr.wasTouch || !this.onWorld(ptr)) return
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
      w.__infiniteMana = (on: boolean) => hud.set({ cheats: { ...hud.get().cheats, infiniteMana: on } })
      w.__setMana = (n: number) => { this.mana.value = n }
      w.__health = () => ({ value: this.health.value, marks: this.health.marks.map((m) => m.kind) })
      w.__dummies = () => this.dummies.map((d) => ({ x: d.x, y: d.y, vx: d.vx, frozen: d.frozen, healed: d.healed, scorched: d.scorched, stunned: d.stunned, poisoned: d.poisoned }))
      w.__runes = () => this.magic.runes.length
      w.__anchors = () => this.magic.anchors.length
      w.__zones = () => this.magic.zones.map((z) => ({ kind: z.kind, x: z.x, y: z.y, r: z.r }))
      w.__lightAt = (x: number, y: number) => this.light.r[Math.floor(y) * ROOM_W + Math.floor(x)]
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
    // Menus (the spell builder, the guide, cheats) pause the game while they're open. Their keys (B,
    // G, C) are handled by the page (MenuButtons); the gamepad's Select opens and closes the builder.
    for (const e of spellEdits.splice(0)) { this.hotbar[e.slot] = e.spell; this.caster.reset(); this.syncHotbar() }
    const pad0 = this.input.gamepad?.pad1
    const select = !!pad0 && pad0.buttons[8]?.pressed
    if (select && !this.selectHeld) hud.set({ builderOpen: !hud.get().builderOpen })
    // Cheats take effect at once, even with the menu still open.
    const cheats = hud.get().cheats
    if (cheats.infiniteMana !== this.mana.infinite) {
      this.mana.infinite = cheats.infiniteMana
      if (cheats.infiniteMana) { this.mana.value = this.mana.max; hud.set({ mana: this.mana.value }) }
    }
    this.selectHeld = select
    const nowOpen = hud.get().builderOpen || hud.get().guideOpen || hud.get().cheatsOpen
    if (nowOpen !== this.wasOpen) {
      // Hand the keyboard to the menu while it's open, and forget keys held across the switch.
      this.input.keyboard!.enabled = !nowOpen
      this.input.keyboard!.resetKeys()
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
    this.blastCool = Math.max(0, this.blastCool - dt)
    this.handleBlasts()

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
    const env = this.surroundings()
    // In a time bubble, you're slowed or sped up too.
    const ev = stepPlayer(p, input, dt * this.magic.timeScaleAt(p.x, p.y - PLAYER.height / 2), this.grid.isSolid, env)
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
    // Landing on something soft (sand, rubble, ash, dirt, moss) halves the damage; snow and slime take it all.
    const under = this.grid.get(Math.floor(p.x), Math.floor(p.y)), at = this.grid.get(Math.floor(p.x), Math.floor(p.y) - 1)
    const cushion = under === Material.SNOW || under === Material.SLIME || at === Material.SLIME ? 0 : SOFT.has(under) || SOFT.has(at) ? 0.5 : 1
    const damage = Math.round(fallDamage(ev.fell) * cushion)
    if (damage > 0) this.hurt(damage, 0.25 + Math.random() * 0.5)
    if (this.mode !== 'alive') return
    this.touchHazards(env, dt)
    if (this.mode !== 'alive') return
    this.soakMana(env, dt)
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
      // Magic that eats cells (Void, Decay): taken as burn-like bites, built up like touching lava.
      hurt: (n: number) => {
        if (this.mode !== 'alive') return
        this.magicAcc += n
        if (this.magicAcc >= 3) { const k = Math.floor(this.magicAcc); this.magicAcc -= k; this.hurt(k, 0.5, 'burn') }
      },
      moveTo: (x: number, y: number) => Object.assign(this.player, { x, y, fallDist: 0, onWall: 0 }),
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
    const finger = this.input.manager.pointers.find((ptr) => ptr.wasTouch && ptr.isDown && this.onWorld(ptr))
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
    if (this.aimSource === 'mouse' && !pointer.wasTouch && pointer.leftButtonDown() && this.onWorld(pointer)) down = true
    if (pad && pad.R2 > 0.5) down = true
    this.tapLatch = null

    const spell = this.hotbar[this.slot]
    const tip = this.catalystTip()
    // Recasting a slot with triggers waiting "on recast" sets them off instead of casting again,
    // and that press is used up until it's let go.
    if (down && !this.castHeld && this.magic.hasRecast(this.slot)) { this.magic.recast(this.slot); this.recastHold = true }
    this.castHeld = down
    if (!down) this.recastHold = false
    const wasChannelling = this.caster.channelling
    const casts = this.caster.update(spell, down && !this.recastHold, dt, this.mana)
    for (const ev of casts) this.magic.cast(spell, ev, tip, this.aim, this.playerBody, { slot: this.slot })
    if (wasChannelling && !this.caster.channelling && this.mana.spend(followUpCost(spell))) this.magic.channelEnded(spell, this.slot, tip, this.aim, this.playerBody)
    if (this.caster.channelling && Math.random() < 0.5) {
      this.magic.sparks.push({ x: tip.x, y: tip.y, vx: (Math.random() - 0.5) * 20, vy: -10 - Math.random() * 15, life: 0.3, max: 0.3, colour: elementInfo(spell.elements[0]).colour })
    }
    this.mana.update(dt, this.caster.casting)
    this.magic.update(dt)
    for (const d of this.dummies) {
      d.update(dt * this.magic.timeScaleAt(d.x, d.y - d.h / 2), this.grid.isSolid)
      if (d.y > 400) Object.assign(d, { x: d.home.x, y: d.home.y, vx: 0, vy: 0 })
    }
    hud.set({ mana: this.mana.value, charge: this.caster.charging ? this.caster.charge : 0 })
  }
  private padBumpers = { lb: false, rb: false }
  private lastPointer = { x: -1, y: -1 }
  private tapLatch: { x: number; y: number } | null = null
  private wasOpen = false
  private castHeld = false
  private recastHold = false
  private selectHeld = false

  /**
   * Did this touch or click start on the world itself? Phaser also reports presses that start on the
   * controls over it (the move stick, Jump, the hotbar, the Spells button); those mustn't cast.
   */
  private onWorld(ptr: Phaser.Input.Pointer): boolean {
    return ptr.downElement === this.game.canvas
  }

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

  /**
   * What the player is in and touching: how much of the body is in liquid (or quicksand) and how
   * thick it is, what's underfoot (ice and blood slip, slime bounces), anything that burns or
   * poisons, and liquid mana.
   */
  private surroundings(): Feel {
    const p = this.player, g = this.grid
    const x0 = Math.floor(p.x - PLAYER.width / 2), x1 = Math.ceil(p.x + PLAYER.width / 2)
    const y0 = Math.floor(p.y - PLAYER.height), y1 = Math.ceil(p.y)
    let wet = 0, all = 0, drag = 0, hurt = 0, hurtX = 0, hurtN = 0, slippery = false, bouncy = false
    const mana: number[] = []
    for (let y = y0 - 1; y <= y1; y++) {
      for (let x = x0 - 1; x <= x1; x++) {
        const m = g.get(x, y), info = MATERIALS[m as Material]
        if (x >= x0 && x < x1 && y >= y0 && y < y1) {
          all++
          if (KIND[m] === Kind.LIQUID || info.sink) { wet++; drag += info.drag ?? 1 }
        }
        const h = HURTS[m]
        if (h) { hurt = Math.max(hurt, h); hurtX += x; hurtN++ }
        if (m === Material.MANA) mana.push(y * g.width + x)
        if (y >= y1 - 1 && x >= x0 && x < x1) {
          if (m === Material.ICE || m === Material.BLOOD) slippery = true
          if (m === Material.SLIME) bouncy = true
        }
      }
    }
    const hurtAt = hurtN ? Math.max(0, Math.min(1, (hurtX / hurtN + 0.5 - x0) / PLAYER.width)) : 0.5
    return { submerged: all ? wet / all : 0, drag: wet ? drag / wet : 1, slippery, bouncy, hurt, hurtAt, mana }
  }

  /** Lights in the world this frame: the player's own, cast Light, spells in flight, lightning's charge. */
  private lightSources(): LightSource[] {
    const out: LightSource[] = []
    const add = (x: number, y: number, c: number, k: number) => out.push({ x, y, r: ((c >> 16) & 255) / 255 * k, g: ((c >> 8) & 255) / 255 * k, b: (c & 255) / 255 * k })
    const p = this.player, P = LIGHTING.player, m = this.magic, W = this.grid.width
    if (!p || !m) return out // the very first paint, before the player and the magic exist
    out.push({ x: p.x, y: p.y - PLAYER.height / 2, r: P.r * P.power, g: P.g * P.power, b: P.b * P.power })
    for (const z of m.zones) if (z.kind === 'light') { const f = Math.min(1, z.life / 0.5) * (1 + z.r / 40); out.push({ x: z.x, y: z.y, r: 1.25 * f, g: 1.2 * f, b: 1.05 * f }) }
    for (const s of m.projectiles) add(s.x, s.y, elementInfo(s.els[0]).colour, 0.75)
    for (const s of m.wisps) if (s.els.length) add(s.x, s.y, elementInfo(s.els[0]).colour, 0.6)
    for (const s of m.motes) add(s.x, s.y, elementInfo(s.els[0]).colour, 0.4)
    for (const s of m.runes) add(s.x, s.y, elementInfo(s.els[0]).colour, 0.3)
    for (const f of m.flashes) add(f.x, f.y, f.colour, 0.9 * (f.life / f.max))
    for (const b of m.beams) {
      const len = Math.hypot(b.x1 - b.x0, b.y1 - b.y0)
      for (let t = 0; t <= len; t += 6) add(b.x0 + ((b.x1 - b.x0) * t) / (len || 1), b.y0 + ((b.y1 - b.y0) * t) / (len || 1), b.colour, 0.55)
    }
    for (const c of m.charged) add((c.p % W) + 0.5, Math.floor(c.p / W) + 0.5, 0xfff2b0, 1.2 * (c.life / 0.25))
    return out
  }

  /** Burning, eating and poisoning things eat cells away, a bite at a time. */
  private touchHazards(env: Feel, dt: number): void {
    if (env.hurt <= 0) { this.burnAcc = 0; return }
    this.burnAcc += env.hurt * dt
    if (this.burnAcc >= 3) {
      const n = Math.floor(this.burnAcc)
      this.burnAcc -= n
      this.hurt(n, env.hurtAt, 'burn')
    }
  }

  /** Standing in liquid mana refills mana, soaking the pool up. */
  private soakMana(env: Feel, dt: number): void {
    if (!env.mana.length || this.mana.infinite || this.mana.value >= this.mana.max) return
    const gain = Math.min(this.mana.max - this.mana.value, MANA_POOL.rate * dt)
    this.mana.value += gain
    this.manaDrain += gain / MANA_POOL.perCell
    const g = this.grid
    while (this.manaDrain >= 1 && env.mana.length) {
      const q = env.mana.splice((Math.random() * env.mana.length) | 0, 1)[0]
      g.cells[q] = Material.EMPTY
      g.life[q] = 0
      this.manaDrain--
    }
  }

  /** Explosions shove everything near and hurt the player (a blow: a dent), shaking the camera. */
  private handleBlasts(): void {
    const list = this.grid.blasts
    if (!list.length) return
    this.grid.blasts = []
    this.cameras.main.shake(140, Math.min(0.012, 0.003 + list.length * 0.0008))
    const alive = this.mode === 'alive'
    for (const b of alive ? [this.playerBody, ...this.dummies] : this.dummies) {
      const cx = b.x, cy = b.y - b.h / 2
      let ix = 0, iy = 0, hit = 0
      for (const bl of list) {
        const d = Math.hypot(cx - bl.x, cy - bl.y), reach = bl.r * 2.5 + 6
        if (d >= reach) continue
        const f = 1 - d / reach, l = d || 1
        hit += f
        ix += ((cx - bl.x) / l) * 140 * f
        iy += ((cy - bl.y) / l) * 140 * f - 60 * f
      }
      if (hit <= 0) continue
      const mag = Math.hypot(ix, iy), cap = 260
      if (mag > cap) { ix *= cap / mag; iy *= cap / mag }
      b.impulse(ix, iy)
      if (b === this.playerBody && this.blastCool <= 0) {
        this.blastCool = 0.35
        this.hurt(Math.min(45, Math.round(18 * hit)), 0.5)
      }
    }
  }

  private paintWorld(): void {
    if (this.lighting) {
      const darks = (this.magic?.zones ?? []).filter((z) => z.kind === 'dark').map((z) => ({ x: z.x, y: z.y, radius: z.r, strength: 0.85 * Math.min(1, z.life / 0.5) }))
      // Light changes slowly next to everything else, so it's worked out every other frame.
      if (this.lightFrame++ % 2 === 0) this.light.compute(this.grid, this.lightSources(), darks)
      paintGrid(this.grid, this.worldImg, this.light)
    } else paintGrid(this.grid, this.worldImg)
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

  /** Damage from anywhere. The body squashes, flashes and dents (or, burnt, loses cells); at zero it shatters. */
  private hurt(amount: number, at: number, kind: 'dent' | 'burn' = 'dent'): void {
    if (hud.get().cheats.invulnerable) return // the cheat: nothing hurts (you still get shoved about)
    const p = this.player
    const dead = this.health.hurt(amount, kind, at)
    if (kind === 'burn') this.squash.set(1.12, 0.9) // a flinch, not the full blow
    else this.squash.set(1.35, 0.7) // the guide's getting-hurt squash
    this.hurtFlash = 0.1
    this.hurtFace = 0.5
    this.updateFace(0)
    if (kind === 'dent') this.dust.puff(p.x, p.y, 10, 60)
    else this.dust.puff(p.x + (at - 0.5) * PLAYER.width, p.y - 1, 3, 18) // bits of the body, eaten away
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
      const body = d.eaten > 0 ? 0xc03aff : d.dazzled > 0 ? 0xf0eee0 : d.frozen > 0 ? 0xa8dcf0 : d.scorched > 0 ? 0xd88a5a : d.stunned > 0 && Math.floor(this.time.now / 80) % 2 ? 0x9ad8c8
        : d.poisoned > 0 ? 0x9aa63a : d.wet > 0 ? 0x7f9fc8 : 0x8a8aa0
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
    // Fields: a gravity well's dots spiralling in, a magnet's ring, a time bubble (pale and still when
    // slowed, bright and ticking when sped up). Sound's rings spread out.
    const now = this.time.now / 1000
    for (const z of this.magic.zones) {
      const fade = Math.min(1, z.life / 0.3)
      if (z.kind === 'light') { g.fillStyle(0xfff6c8, 0.9 * fade); g.fillRect(Math.floor(z.x) - 1, Math.floor(z.y) - 1, 2, 2); continue } // a mote of light; the light itself shows
      if (z.kind === 'dark') continue // the darkness shows
      const colour = z.kind === 'pull' ? 0x8a6cff : z.kind === 'magnet' ? 0xff7ab8 : z.kind === 'slow' ? 0xcbb27a : 0xffe6a0
      if (z.kind === 'slow' || z.kind === 'fast') { g.fillStyle(colour, 0.08 * fade); g.fillCircle(z.x, z.y, z.r) }
      const n = Math.max(16, Math.round(z.r * 3))
      g.fillStyle(colour, 0.55 * fade)
      for (let i = 0; i < n; i += z.kind === 'fast' ? 2 : 1) {
        const a = (i / n) * 6.283 + (z.kind === 'fast' ? now * 3 : z.kind === 'slow' ? now * 0.2 : 0)
        g.fillRect(Math.floor(z.x + Math.cos(a) * z.r), Math.floor(z.y + Math.sin(a) * z.r), 1, 1)
      }
      if (z.kind === 'pull' || z.kind === 'magnet') {
        for (let i = 0; i < 6; i++) {
          const t = ((now * 0.8 + i / 6) % 1), a = i * 1.047 + t * 3
          const rr = z.r * (1 - t)
          g.fillStyle(colour, 0.8 * fade * (1 - t * 0.5))
          g.fillRect(Math.floor(z.x + Math.cos(a) * rr), Math.floor(z.y + Math.sin(a) * rr), 1, 1)
        }
      }
    }
    // Lightning: the cells it ran through, and its bolts.
    const W = this.grid.width
    for (const c of this.magic.charged) { g.fillStyle(0xfff6c0, 0.75 * (c.life / 0.25)); g.fillRect(c.p % W, Math.floor(c.p / W), 1, 1) }
    for (const b of this.magic.bolts) {
      g.fillStyle(0xfffbe0, b.life / b.max)
      for (let i = 0; i + 3 < b.pts.length; i += 2) {
        const x0 = b.pts[i], y0 = b.pts[i + 1], x1 = b.pts[i + 2], y1 = b.pts[i + 3], len = Math.hypot(x1 - x0, y1 - y0)
        for (let t = 0; t <= len; t += 0.7) g.fillRect(Math.floor(x0 + ((x1 - x0) * t) / (len || 1)), Math.floor(y0 + ((y1 - y0) * t) / (len || 1)), 1, 1)
      }
    }
    for (const f of this.magic.ripples) {
      const t = 1 - f.life / f.max, r = f.r * t
      g.fillStyle(f.colour, (f.life / f.max) * 0.8)
      const n = Math.max(12, Math.round(r * 5))
      for (let i = 0; i < n; i++) g.fillRect(Math.floor(f.x + Math.cos((i / n) * 6.283) * r), Math.floor(f.y + Math.sin((i / n) * 6.283) * r), 1, 1)
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
      const half = Math.round(1 + ((pr.size ?? 1) - 1) * 1.2) // bigger spells, bigger bolts
      g.fillStyle(elementInfo(pr.els[0]).colour, 1)
      g.fillRect(Math.floor(pr.x) - half, Math.floor(pr.y) - half, half * 2 + 1, half * 2 + 1)
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
