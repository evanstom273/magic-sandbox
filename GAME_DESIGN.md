# GAME_DESIGN.md

Authoritative, living record of the game's design. It's updated after everything: every decision, change of mind, build, playtest and fix goes in as it happens, so this is always the current picture. Timestamps are Europe/London, ISO 8601 with UTC offset, recorded at the time the decision was confirmed in conversation unless marked otherwise.

**How this document works:**
- Every confirmed decision goes in §B with its timestamp and a History number, and gets a matching line in §G.
- Nothing is deleted. When a decision changes, the old wording is ~~struck through~~ and points to the History entry that replaced it; the new decision gets its own entry.
- Each decision says whose it was ("Lyra's pick", "Lyra's own option", "Claude's recommendation, approved") and, where it matters, what wasn't chosen.
- Recommendations aren't decisions. Anything Claude drew or suggested that wasn't asked for stays up for change until Lyra approves it.
- Artifacts used in design are listed in §C with their link, what they show, and Claude's choices that are up for change.
- Open questions in §E are struck through as they're answered, with the History number that answered them.
- §F says what's built, what's broken, and every technical interpretation Claude made that Lyra didn't decide, to be flagged if wrong.
- §G is append-only.

---

## A. Project Overview

A **voxel-based magic physics game** (History #7, #8): **the look of Terraria with the physics and magic of Noita** (History #9, #11), flat and seen side-on (History #12), with **characters in Lyra's Stylised Geometry art style** (History #10). Working title: none yet; the repository is `magic-sandbox`.

**Where the project stands (as of 2026-11-16T21:48:38+00:00):**
- Living design document created, reset to the base of `STEALTH_GAME_DESIGN.md`: its structure and conventions, none of the stealth game's design (History #1).
- Art style reference added to the repository as `stylised-geometry/`, including `make_sheets.py` (History #2).
- Stack and deployment settled: the stealth game's stack, on GitHub Pages for now (History #3, #4).
- Project scaffold built and tested (History #5, #6): a Phaser scene inside React, deployed to GitHub Pages by a workflow on every push to `main`.
- Magic Sandbox Artifact made; Fine cells chosen from it (History #34). Characters are voxels too (History #35).
- **The player is in the game, as a blank square** (History #36–#40): a 12-cell body of real cells in a test room, with walking, jumping, squash and stretch and dust, playable with keyboard, gamepad and touch. Since then: a double jump and Celeste-style wall climbing and wall jumps (History #41–#46), now with auto grab (History #47), made less sticky after Lyra's first playtest (History #48), and only holding on while pushing towards the wall (History #49). No climbing now: walls are held, slid down and kicked off, and scaled by wall-jumping and steering back (History #50). **Health and fall damage built** (History #51–#61): a health bar, falls that dent the body, a stand-in rest spot to heal and a stand-in respawn. Waiting on Lyra's playtest.
- Top-level design from Lyra (History #7–#13).
- Designing the magic: round 1 settled what it's for, how spells are made, and how much is scripted (History #14–#16); round 2 how spells are built, when, how elements mix, and that spells make real material (History #17–#20); round 3 what the elements are, mana, catalysts, and learning by experiment (History #21–#24); round 4 drawing elements in, shapes and triggers from the start, what catalysts do, and holding one at a time (History #25–#28). Shapes and casting types come from Lyra's Magic Mod (History #29, #30); round 5 settled how casting types fit, the starting triggers, and that weapons exist (History #31–#33).

**Stack:** React, Vite, TypeScript, Tailwind CSS, Phaser and IndexedDB via Dexie.js, the same as the stealth game's, deployed on GitHub Pages for now (History #3, #4).
- **React** is the outer shell; **Phaser** (v4) runs the game inside a single React component.
- **Tailwind** styles anything React draws.
- **Dexie** comes in when there's first something to save.
- **GitHub Pages** serves the built game, deployed by a GitHub Actions workflow on every push to `main`. It's static hosting, so there's no server code.

**Art style:** Stylised Geometry, kept in `stylised-geometry/`: the guide (`STYLISED_GEOMETRY.md`), seven SVG reference sheets and `make_sheets.py`, which regenerates them. In short: characters built from simple geometric shapes, with faces and floating hands, in a dark world lit around them, all drawn from shapes in code or SVG rather than sprites. The guide is the reference for how things look; this document records the game's own design.

**The style guide is a reference, not gospel** *(Lyra, for the stealth game, and restated for this one — History #13)*. It informs how things look; it doesn't decide anything. Where this game wants something different, the game wins, and Claude shouldn't present the guide's rules as reasons on their own.

**Guiding principles** *(carried over from Lyra's previous design documents; flag if any don't apply here)*:
- Small, polished and functional beats large and placeholder-filled.
- The creative director (Lyra) makes design decisions; recommendations are not decisions until approved.

### Development Philosophy: Depth Before Breadth

*Lyra's own words, written for the stealth game (2026-11-16T05:51:48+00:00) and carried over.*

I want us to prioritise making existing mechanics genuinely polished, satisfying and fully functional before introducing new ones.

This doesn't mean limiting the game's ambition or avoiding complex systems. It means building that complexity gradually, on strong foundations.

Our workflow should be:

**Design → Implement → Test → Refine → Test Again → Refine Further → Move On.**

- **Depth before breadth:** Make each mechanic feel excellent before expanding the game with additional mechanics, enemies, levels or systems.
- **Iterative development:** Nothing should be considered finished simply because it works technically. It needs to feel good in actual gameplay.
- **Playtesting drives decisions:** If something feels awkward, frustrating, too easy or too difficult, we adjust it. We should be willing to substantially change or remove mechanics.
- **No one-shotting:** Don't attempt to build entire interconnected systems in one enormous implementation. Break development into manageable, independently testable stages.
- **Polish before expansion:** Animations, responsiveness, feedback, AI behaviour and interactions deserve attention before we move on.
- **Document everything:** Record decisions, refinements and reversals in `GAME_DESIGN.md`, including why changes were made.
- **Creative control:** Suggest improvements and possibilities, but don't treat recommendations as approved decisions.

Our previous simple-shooter project demonstrated why this works. Through repeated testing, we fundamentally improved movement, enemy behaviour, health, combat balance and weapons. Those refinements gave the game its identity.

The goal isn't to make a small game. It's to build an ambitious game one exceptionally well-developed system at a time.

I'd rather have one brilliant, polished stealth encounter than ten levels of shallow, unfinished mechanics.

### Development Workflow: Use Claude Artifacts for Visual Design and Prototyping

*Lyra's own words, written for the stealth game (2026-11-16T05:51:48+00:00) and carried over.*

I want us to make extensive use of Claude's Artifacts throughout development, particularly for smaller, self-contained design tasks.

Rather than immediately implementing every idea into the game, we should use Artifacts as a visual workshop where we can experiment, review, refine and approve designs before committing them to the codebase.

Examples include:

- **Character designs:** Draw characters, guards, enemies and NPCs in our established Stylised Geometry art style. Show different appearances, expressions, poses and animations.
- **Animation previews:** Demonstrate movement, idle animations, patrol behaviour, detection reactions and other visual effects.
- **Environment concepts:** Mock up individual rooms, obstacles, hiding places, platforms and environmental features.
- **Gameplay mechanics:** Create small interactive prototypes to demonstrate ideas before implementing them in the actual game.
- **UI and HUD:** Design and preview menus, detection indicators, health displays, interaction prompts and other interface elements.
- **Side-by-side comparisons:** Present multiple visual options so I can compare them, choose elements I like and request changes.

The important principles:

1. **Show, don't just describe.** Whenever a design decision would benefit from seeing something, offer to create an Artifact rather than relying entirely on written descriptions.
2. **Iterate visually.** We should be able to experiment with different designs and refine them repeatedly before approval.
3. **Keep Artifacts focused.** They're for individual designs, small prototypes and experiments, not for building the entire game separately.
4. **Respect the art style.** Character and environment concepts should follow our Stylised Geometry reference unless we're deliberately exploring alternatives.
5. **Don't implement prematurely.** An Artifact is an opportunity to explore an idea, not automatic permission to add it to the game.
6. **Transfer approved designs into the game.** Once we're happy with something, use the approved design as the reference for implementation.
7. **Document decisions.** Record approved designs and relevant decisions in `GAME_DESIGN.md`.

This worked particularly well in our previous simple-shooter project, where visual concepts and mockups helped us develop characters, enemies, environments and bosses.

The philosophy is simple: **design it, see it, refine it, approve it, then build it.**

Use Artifacts proactively whenever they would make a design discussion more productive, but always leave the final creative decisions to me.

### Design Workflow: Structured Questions and Collaborative Decision-Making

*Lyra's own words, written for the stealth game (2026-11-16T05:51:48+00:00) and carried over.*

I want you to actively guide me through designing the game's mechanics, characters, enemies, environments and systems using structured rounds of questions, just as we've done successfully in my previous projects.

How this should work:

1. **Ask focused questions.** When we're designing something, break it down into its individual components rather than asking one enormous, open-ended question.
2. **Provide multiple-choice options.** For each question, offer several distinct, well-considered possibilities, with brief explanations where useful. Always include the freedom for me to suggest something different or combine options.
3. **Group related questions.** Ask several questions together when they concern the same aspect of a feature. For example, when designing a guard, we might first decide its appearance and movement, then its detection behaviour, then its reactions and animations.
4. **Work through multiple rounds.** Don't try to settle every detail in one batch. Use my answers to inform the next set of questions, progressively developing the design.
5. **Make recommendations without making decisions.** You're welcome to explain which options you think would work best and why, but the final creative decisions belong to me.
6. **Consider the details.** Don't stop at the headline mechanic. Explore how something feels, behaves, looks, sounds, interacts with other systems and communicates information to the player.
7. **Record approved decisions.** Update `GAME_DESIGN.md` with what we've agreed, including important reasoning and subsequent changes.
8. **Implement only when the design is sufficiently settled.** Once we've agreed on the relevant details, explain the proposed implementation and wait for my approval before building.

**Example:** When designing a guard, don't simply ask whether it should patrol. Explore how it patrols, what it can see, what it can hear, how it communicates suspicion, how it investigates disturbances, what happens when it detects the player, and how it eventually returns to normal behaviour.

We don't necessarily need to decide all of these immediately. The point is to explore each feature properly, in manageable rounds.

Combine this with our other principles:

- Depth before breadth.
- Build, test and refine repeatedly.
- Use Claude Artifacts for visual concepts and small prototypes.
- Document decisions and reversals.
- Never mistake a suggestion for an approved design.

I want the process to feel like a genuine collaborative game design session, with you presenting thoughtful possibilities and me directing the creative vision.

Don't rush through the questions simply to get to implementation. The design process is part of what I enjoy.

---

## B. Confirmed Design Decisions

*Categories are added as the design grows.*

### Concept
- **Voxel-based.** Lyra's word; ~~whether that means a flat grid of cells or 3D voxels is open (§E)~~ a flat grid of cells, seen side-on (#12). *(2026-11-16T20:10:35+00:00, documentation time — History #7)*
- **A magic physics game.** *(2026-11-16T20:10:35+00:00, documentation time — History #8)*
- **A mix between Terraria and Noita.** ~~Which parts of each is still to be explored.~~ Terraria's look, Noita's physics and magic (#11). *(2026-11-16T20:10:35+00:00, documentation time — History #9)*
- **The look of Terraria, with the physics and magic of Noita.** That's what the mix means. *(2026-11-16T20:13:02+00:00, documentation time — History #11)*
- **Flat and seen side-on**, like Terraria: the voxels are a 2D grid of cells, not 3D. Read from "the look of Terraria"; flag if wrong. *(2026-11-16T20:13:02+00:00, documentation time — History #12)*

### Magic
- **Magic does everything:** fighting, shaping the world (digging, building, moving and transforming materials), getting around, and solving problems the world throws up. All four picked. *(2026-11-16T20:19:20+00:00 — History #14)*
- **Spells are mixed from elements and built from parts, simpler than Noita.** Lyra's own combination of two options: elements mixed at cast time (a bit like Magicka; Claude's recommendation) and spells assembled from parts (like Noita's wands). ~~How the two fit together is round 2.~~ They fit as element + shape + trigger (#17). Fixed spells, and fixed spells with modifiers, were not chosen. *(2026-11-16T20:19:20+00:00 — History #15)*
- **Mostly emergent, with some set pieces.** Spells are simple ingredients and most of the interesting results come from the simulated world, plus a few hand-made moments where it matters, such as a boss's weakness. Claude's recommendation, approved; fully emergent, designed spell combos and mostly scripted were not chosen. *(2026-11-16T20:19:20+00:00 — History #16)*
- **A spell is element + shape + trigger.** The elements are what it's made of; the shape is how it's delivered (such as a bolt, a spray, a beam, a wall, a burst or a trap); an optional trigger sets off a second spell (such as on impact or after a delay), the part of Noita that makes chains. Chosen over element + shape alone (Claude's recommendation) and a short row of slots. *(2026-11-16T20:21:38+00:00 — History #17)*
- **Spells are both prepared and mixed on the fly:** a few built in a spell menu and kept ready on a hotbar, plus quick mixing in the moment. Chosen over prepared only (Claude's recommendation) and mixed on the fly only. *(2026-11-16T20:21:38+00:00 — History #18)*
- **When a spell has more than one element, the world decides.** The elements come out together and react by the world's own rules (fire and water make steam because that's what they do), with no separate mixing table. Claude's recommendation, approved; designed mixes, elements side by side, and one element per spell were not chosen. *(2026-11-16T20:21:38+00:00 — History #19)*
- **Spells make real material.** Where the element is a substance, the spell leaves actual stuff in the world (water that flows and pools, rock that stays, fire that spreads); things like lightning stay effects. Claude's recommendation, approved; fading material and effects only were not chosen. *(2026-11-16T20:21:38+00:00 — History #20)*
- **Elements are substances and forces, and the substances can be any of the world's materials.** Forces (heat, cold, lightning, push, for example) act on whatever's there; substances make real material (#20), and in principle anything in the world could become castable: water, oil, sand, lava, acid, gunpowder. Lyra combined two options: substances and forces (Claude's recommendation) and any world material. Classic elements and forces only were not chosen. *(2026-11-16T20:24:36+00:00 — History #21)*
- **Mana limits casting:** one pool that refills over time, with bigger spells costing more. Claude's recommendation, approved; per-spell recharge, drawing on the world, and mana and matter were not chosen. *(2026-11-16T20:24:36+00:00 — History #22)*
- **The player casts with catalysts, Elden Ring style.** Lyra's own answer, over bare hands, a wand or staff, a spellbook and something worn. ~~What a catalyst does beyond enabling casting is round 4.~~ See #27, #28. *(2026-11-16T20:24:36+00:00 — History #23)*
- **New magic is discovered by experimenting**, plus **a debug/cheat menu**. Lyra added the menu. Found, crafted and learned through use were not chosen. *(2026-11-16T20:24:36+00:00 — History #24)*
- **Elements are learned by drawing them in:** point the catalyst at a material (or a force, such as fire's heat) and draw a sample in, and from then on it can be cast. Anything made by accident (steam, obsidian) can be drawn in too. Claude's recommendation, approved; witnessing it, making it yourself and studying samples were not chosen. *(2026-11-16T20:27:29+00:00 — History #25)*
- **Shapes and triggers are all there from the start**, ~~a small set~~ (the shapes are the Magic Mod's eleven, #29); discovery is about elements. Claude's recommendation, approved over learning them by watching the world. *(2026-11-16T20:27:29+00:00 — History #26)*
- **Catalysts change power, affinity, capacity and quirks** (all four picked): how strong, big or far-reaching spells are; which elements, shapes or triggers they favour; how many elements a spell can mix or how many prepared spells fit on the hotbar; and odd properties of their own. **Any spell can be cast from any catalyst; some are just better at it.** Lyra's note. *(2026-11-16T20:27:29+00:00 — History #27)*
- **One catalyst at a time,** swapping between those carried. Chosen over one in each hand. *(2026-11-16T20:27:29+00:00 — History #28)*
- **The shapes are the spell types from Lyra's Magic Mod design** (a Minecraft mod of hers): **Projectile, Beam, AoE, Rune, Self, Target, Summon, Orbit, Wave, Cone** and **Weapon enchantment**. Lyra's call, replacing the examples Claude gave. *(2026-11-16T20:30:15+00:00 — History #29)*
- **The casting types come from the Magic Mod too:** **Instant** (one activation casts once), **Charged** (holding strengthens a spell before release), **Channeled** (holding sustains an effect), **Burst** (one activation releases several shots) and **Continuous** (holding repeatedly casts individual shots). ~~How they fit into element + shape + trigger is open.~~ Each shape allows a few (#31). *(2026-11-16T20:30:15+00:00 — History #30)*
- **Each shape allows the casting types that make sense for it**, and the player picks among those when building (a Beam can be Channeled; a Projectile Instant, Charged or Burst, for example). Claude's recommendation, approved; a free choice of casting type and one set by the shape were not chosen. Which shape allows which is still to be worked out. *(2026-11-16T20:31:38+00:00 — History #31)*
- **Four triggers to start with** (all four picked): **on impact**, **after a delay**, **when something comes near** (a creature or the player), and **on recast** (cast again to set it off). *(2026-11-16T20:31:38+00:00 — History #32)*
- **Weapons exist too,** alongside magic, and **Weapon enchantment enchants them.** Chosen over enchanting the catalyst (Claude's recommendation) and dropping the shape. What the weapons are is open. *(2026-11-16T20:31:38+00:00 — History #33)*

### Player movement
*Extra movement that doesn't need magic.*
- **A double jump:** one extra jump in the air, with the guide's 0.8 × 1.22 stretch and a ring. Lyra's request. *(2026-11-16T21:13:37+00:00 — History #41)*
- **Celeste-style walls:** ~~**hold Grab** to cling to a wall~~ cling to a wall (auto grab since #47) and climb up and down it; ~~push into a wall in the air to **slide** down it slowly~~ (climbing down is the slide since #47); **jump off a wall** to kick away and up, with input unable to pull straight back for a moment; **jump while grabbing** with no direction to hop straight up the wall; climbing past the top **pops** the player up onto it. Lyra's request; hold to grab was Claude's recommendation, approved over automatic and toggle; the rest is Claude's plan, approved. *(2026-11-16T21:13:37+00:00 — History #42)*
- **Auto grab** replaces holding Grab: push into a wall in the air (while not rising) to cling, or press up against one on the ground to start climbing. ~~Once on, the player stays without holding anything; pushing away lets go, as do jumping and climbing down to the floor.~~ The player only stays on while pushing towards the wall (#49). Pushing into a wall now clings rather than slides, so climbing down is the wall slide. There's no Grab button any more. Lyra's change; the details are Claude's, up for change. Supersedes hold-to-grab in #42 and the Grab controls in #45 and #46. *(2026-11-16T21:16:39+00:00 — History #47)*
- **Less sticky, and bumps aren't walls,** after Lyra's first playtest of the walls: the player was too sticky towards walls, and got caught on the floor's bumps, climbing them like walls and hopping about. Now a wall only counts if it's beside the upper body (bumps the player can step over never count, for clinging or wall jumps); clinging needs a tenth of a second of pushing into a wall while falling, so brushing past or the top of a jump doesn't grab; and small bumps are stepped up while coming down as well as on the ground. Claude's fix; the amounts are Claude's, to tune. *(2026-11-16T21:30:13+00:00 — History #48)*
- **The player only stays on a wall while pushing towards it.** Letting go of the stick or pushing away drops off; climbing is pushing in plus up or down. A jump while pushing in hops straight up the wall (the climb jump); a jump with no direction held, or pushing away, is a wall jump. What Lyra meant by auto grab all along: "stays without holding anything" was a detail Claude filled in. Supersedes that part of #47. *(2026-11-16T21:32:47+00:00 — History #49)*
- **No climbing; scale a wall by jumping off it and steering back.** On a wall, pushing towards it holds still, letting go slides down it, and pushing away drops off; up and down do nothing. Every jump off a wall kicks away from it, and to go up you steer back to the wall and jump again. Lyra's change. Claude's knock-ons, up for change: the climb jump and the ledge pop are gone (topping out is steering over the edge), W and Up jump again since they no longer climb, and the kick-off is shorter (70 out instead of 95, with input locked for 0.1 s instead of 0.16) so the same wall can be scaled. Supersedes climbing, the climb jump and the ledge pop in #42, the climbing parts of #47 and #49, and W/S climbing in #46. *(2026-11-16T21:37:39+00:00 — History #50)*
- **No stamina limit** on ~~clinging and climbing~~ holding onto walls. Chosen over Celeste-style stamina (Claude's recommendation). *(2026-11-16T21:13:37+00:00 — History #43)*
- **The double jump comes back on landing or on a wall** (grabbing one or jumping off one). Chosen over landing only (Claude's recommendation). *(2026-11-16T21:13:37+00:00 — History #44)*

### Health and damage
- **Fall damage.** With walls and magic there will be ways to avoid it. ~~Which ways is round 1.~~ See #55, #56. *(2026-11-16T21:41:08+00:00 — History #51)*
- **Health shows two ways: a bar,** so it can be read at a glance, **and the player's body deforming.** ~~How the body deforms is round 1.~~ See #53, #54. *(2026-11-16T21:41:08+00:00 — History #52)*

- **Health is a number, and damage marks the body where it came from:** a fall dents it from below, fire scorches the side that burned. Claude's recommendation, approved over the body deforming evenly and the body's cells being the health. *(2026-11-16T21:42:51+00:00 — History #53)*
- **The deformation depends on the kind of damage:** falls and blows dent and crack the body; fire and acid eat cells away, and those cells drop into the world. Claude's recommendation, approved over dents only, chunks only and cracks only. *(2026-11-16T21:42:51+00:00 — History #54)*
- **Fall damage is moderate:** safe up to about 6 body heights (higher than a jump plus a double jump); damage grows quickly after that, and a long fall can take most of your health but doesn't kill outright. Claude's recommendation, approved over gentle and harsh. *(2026-11-16T21:42:51+00:00 — History #55)*
- **Besides magic, falls are broken by catching a wall** (holding or sliding resets the fall), **landing in liquid** (cushions or cancels it) **and soft materials** such as sand (soften it, less than liquid). The double jump was not chosen, so it doesn't reset a fall. *(2026-11-16T21:42:51+00:00 — History #56)*

- **Middling toughness:** a long fall takes most of your health; a few bad hits, or one real mistake (a swim in lava), ends you. Claude's recommendation, approved over sturdy and fragile. *(2026-11-16T21:44:11+00:00 — History #57)*
- **Health comes back from resting, from things** (food, potions and other items) **and from magic** (healing as something you can cast, discovered like any other element). **Not over time:** there's no passive regeneration. *(2026-11-16T21:44:11+00:00 — History #58)*
- **The marks mend as health refills:** dents fill out and eaten cells grow back, so the body and the bar keep agreeing. Claude's recommendation, approved over marks staying until rest. *(2026-11-16T21:44:11+00:00 — History #59)*
- **What happens at zero health is decided later**, with the game's structure. For testing, the player respawns at the start. Claude's recommendation, approved. *(2026-11-16T21:44:11+00:00 — History #60)*

- **The health build plan is approved** (Lyra: "Go"), with Claude's starting values to tune: 100 health; falls safe to 6 body heights, then 12 per body height, capped at 85; a red bar top left; a stand-in rest spot and a stand-in respawn at the start for testing. *(2026-11-16T21:48:38+00:00 — History #61)*

### Platforms and input
- **Touch: a fixed thumbstick** bottom left for moving and climbing, with **Jump** ~~and a held **Grab** button~~ bottom right (no Grab since #47). Claude's recommendation, approved over arrow buttons. *(2026-11-16T21:13:37+00:00 — History #45)*
- **Keyboard and gamepad:** A/D or Left/Right to move; ~~W/S or Up/Down to climb~~ (no climbing since #50); **Space or K to jump** ~~(W and Up no longer jump)~~ (W and Up jump again since #50); ~~**Shift or J to grab**~~. Gamepad: left stick or d-pad, A to jump~~, RB or RT to grab~~ (no grab since #47). Part of Claude's plan, approved. *(2026-11-16T21:13:37+00:00 — History #46)*

### Art and presentation
- **Art style: Stylised Geometry**, as set out in `stylised-geometry/STYLISED_GEOMETRY.md` and its reference sheets. *(2026-11-16T19:56:10+00:00, documentation time — History #2)*
- **The characters are in Lyra's Stylised Geometry style.** The world is voxels~~; how much of the guide applies to it is open (§E)~~, with Terraria's look (#11). *(2026-11-16T20:10:35+00:00, documentation time — History #10)*
- **Cell size: Fine** ("All day long"), from the Magic Sandbox: the room is 320 × 180 cells and the stand-in caster about 8 cells wide. Chosen over Medium and Chunky. *(2026-11-16T20:59:12+00:00 — History #34)*
- **Characters are made of voxels too**, keeping the Stylised Geometry character style: the player, NPCs and every other character are drawn in cells like the world. Lyra's idea. *(2026-11-16T20:59:12+00:00 — History #35)*
- **Characters are 12 cells across**, so the style's proportions survive in cells (eyes about 2 × 3 cells, hands 2, a one-cell outline). The player is 1.5 times the sandbox caster's size against the world. Claude's recommendation, approved over 8 and 16. *(2026-11-16T21:06:53+00:00 — History #37)*
- **Characters' cells are part of the simulation.** Bodies are real cells the world acts on (burnt or dissolved cell by cell, chunks knocked off), not just drawn in cells. Chosen over drawn-only (Claude's recommendation). *(2026-11-16T21:06:53+00:00 — History #38)*
- **Characters move smoothly,** positioned between the world's cells rather than snapping to its grid; their cells are the world's size but don't line up with it. Chosen over snapping (Claude's recommendation). *(2026-11-16T21:06:53+00:00 — History #39)*
- **The style guide is a guide, not gospel.** Lyra, restating it for this game: it informs the look, it doesn't set rules the game has to follow. *(2026-11-16T20:13:02+00:00, documentation time — History #13)*

### Technical architecture / platform
- **Stack: the same as the stealth game's.** React, Vite, TypeScript, Tailwind CSS, Phaser and IndexedDB via Dexie.js; React as the outer shell with Phaser running inside one React component, Phaser 4, and Dexie added when there's first something to save. *(2026-11-16T20:00:02+00:00, documentation time — History #3)*
- **Deployed on GitHub Pages, for now**, instead of the stealth game's Cloudflare Workers. Lyra has activated Pages in the repository settings. *(2026-11-16T20:00:02+00:00, documentation time — History #4)*

- **Collision is our own, against the cell grid,** not Phaser's built-in Arcade physics, because the world is made of cells. Part of Claude's build plan for the player, approved. *(2026-11-16T21:06:53+00:00 — History #40)*

### Development approach
- **The scaffold was approved as proposed** (Lyra: "Yes scaffold"): the stealth game's, without Cloudflare. Strict TypeScript, Tailwind, Phaser 4 with one empty scene inside a React component, and the guide's colour tokens; no Dexie until something needs saving. *(2026-11-16T20:07:36+00:00, documentation time — History #5)*

- **First piece in the game: just the player.** A blank square with movement, jumping, squash and stretch and the style's particles, before anything else. Built (§F). *(2026-11-16T20:59:12+00:00 — History #36)*

### Testing
- **Vitest for logic, plus a Playwright smoke test** that boots the game in a real browser and fails if the canvas doesn't appear or anything errors. The same as the stealth game's; Claude's recommendation, approved with the scaffold. *(2026-11-16T20:07:36+00:00, documentation time — History #6)*

### Documentation
- **Living `GAME_DESIGN.md`**, reset to the base of `STEALTH_GAME_DESIGN.md`: the same structure and conventions, updated after everything, with none of the stealth game's design. *(2026-11-16T19:56:10+00:00, documentation time — History #1)*

---

## C. Current Development Scope

**In design: magic.** The top level is from Lyra: a voxel-based magic physics game with the look of Terraria and the physics and magic of Noita, flat and side-on, with Stylised Geometry characters (#7–#13). Magic rounds 1–4 are done (#14–#28): the core of the magic is settled, and the shapes and casting types come from Lyra's Magic Mod (#29, #30). Round 5 settled how casting types fit, the triggers and that weapons exist (#31–#33). What's left in magic is mostly feel: quick mixing on touch, mana's numbers, which shapes allow which casting types. Also open: the weapons, and cell size. Stack and deployment are settled (#3, #4) and the scaffold is built and deploying (#5, #6; see §F).

**Artifacts:**

**Magic Sandbox** (Artifact, first cut, 2026-11-16T20:52:52+00:00): https://claude.ai/artifact/6vJkRt4FAt1BMiRto3XuzX. Requested by Lyra to feel the magic and settle cell size. A falling-sand room (a water pool, an oil pool, a lava pit, a sand pile on a ledge, a wooden bridge, icicles and an ice ledge) where a stand-in caster casts six elements (Water, Oil, Sand, Lava, Heat, Cold) as a Projectile or a Cone, with a mana bar, at three cell sizes (Fine 320 × 180 cells, Medium 160 × 90, Chunky 80 × 45, all the same room). Deliberately small: no other shapes, triggers, spell builder, drawing in or creatures yet; those come in later passes. Claude's choices, all up for change: the room; the stand-in caster (the style guide's white square with eyes and floating hands, not a design for the player) and its catalyst as a rod with a gem in the element's colour; every colour; the reactions (heat turns water to steam, melts ice, sets wood and oil alight; cold freezes water, turns lava to obsidian, condenses steam, puts fire out; lava and water make obsidian and steam; steam rises and partly rains back as water; fire spreads along wood and oil and leaves smoke); mana at 100, refilling 14 a second, with bolts costing 5 to 12 and the Cone 2.2 times that per second; the Projectile's arc and burst size; the Cone's spread and reach; the caster can't be hurt, and lava bounces it out. Switching cell size or resetting rebuilds the room.

---

## D. Future Possibilities

*Proposals only — not confirmed features.*

- None yet.

---

## E. Open Questions

1. **Title.**
2. **The concept:** ~~what the game is~~ (#7–#10); who the player is.
3. ~~**Stack.**~~ The stealth game's, on GitHub Pages for now (#3, #4).
4. **Platforms and input.**
5. ~~**What "voxel" means here** (#7): a flat grid of cells seen side-on, as in Terraria and Noita, or 3D voxels. It decides the engine: Phaser is 2D only, so 3D voxels would reopen the stack (#3).~~ Flat and side-on (#12).
6. ~~**Which parts of Terraria and which of Noita** (#9).~~ Terraria's look, Noita's physics and magic (#11). ~~They pull in different directions in places, such as a persistent world built up over hours against runs that end and start fresh.~~ Still open: how the game is structured, such as a world that's kept or runs that start fresh. Neither game's structure was part of the mix.
7. ~~**How the style guide applies to a voxel world** (#10): characters are in the style, but the guide's environments are built from shapes. Its light and darkness, colour jobs and world palettes may still carry over.~~ The wrong question: the guide is a reference, not rules to apply (#13).
8. **Magic details** (#14–#20): ~~how elements and parts fit together~~ (#17); ~~when spells are put together~~ (#18); ~~what the elements are~~ (#21); ~~what limits casting~~ (#22); ~~what the player casts with~~ (#23); ~~where spells come from~~ (#24); ~~how experimenting teaches magic~~ (#25); ~~what catalysts do~~ (#27, #28); mana's numbers; how many elements a spell can mix to begin with; ~~the list of shapes~~ (#29); ~~the triggers~~ (#32); ~~how casting types fit into a spell~~ (#31), though which shape allows which is still open; ~~what Weapon enchantment enchants~~ (weapons, #33); how quick mixing works on touch.
9. ~~**Cell size.**~~ Fine (#34). Terraria's blocks are chunky; Noita's cells are about a pixel each, which is a lot of why its sand, liquids and fire look and move the way they do. Where this sits shapes the look, the physics and how much the Fold has to simulate.
10. **Weapons** (#33): what they are, how they sit beside magic (which was picked as the main way to fight in #14's options), and how they're got.
11. **What losing body cells means** (#38): for the player and for everything else, once the world can burn or dissolve them. Health is designed (#52–#60): a number shown as a bar, with marks on the body by kind of damage, mending as it heals. Still open: death (#60), and the actual numbers.

---

## F. Implementation Status

*Updated 2026-11-16T21:06:53+00:00.*

| Feature | Status | Notes |
|---|---|---|
| Design doc | Done | `GAME_DESIGN.md`, reset to the base of `STEALTH_GAME_DESIGN.md`. *(2026-11-16T19:56:10+00:00)* |
| Art style reference | Added | `stylised-geometry/`, unpacked from `stylised-geometry.zip` as supplied, with Lyra's `make_sheets.py` in `sheets/`. Checked: the script regenerates all seven sheets byte for byte. *(2026-11-16T19:56:10+00:00)* |
| Project scaffold | Done | Vite 8, React 19, TypeScript 7 (strict), Tailwind v4, Phaser 4.2.1. One empty scene filling the window; the style guide's colour tokens in `src/game/style/tokens.ts`. Typecheck, lint and build pass; the build's asset paths point under `/magic-sandbox/`. *(2026-11-16T20:07:36+00:00)* |
| Test room | Built | 320 × 180 Fine cells, static for now (no simulation yet): a bumpy floor, a low and a high ledge, a wall and a low step, in placeholder colours with a lighter top edge on everything standable. `src/game/world/`. *(2026-11-16T21:06:53+00:00)* |
| The player, in the game | Built | A blank square, 12 × 12 cells, drawn as real cells: a one-cell ink outline around white (`src/game/player/body.ts`). It moves smoothly and is redrawn in whole cells each frame for squash and stretch, which keeps the outline on all four sides. No face, hands or feet yet. *(2026-11-16T21:06:53+00:00)* |
| Movement | Built | Walk; jump, higher the longer it's held; a tenth of a second to still jump after walking off a ledge, and a jump pressed just before landing still counts; walks up and down bumps up to 3 cells without jumping; stops flush against floors, walls and ceilings. All values in `src/game/player/tuning.ts`. *(2026-11-16T21:06:53+00:00)* |
| Squash and stretch | Built | The guide's numbers: 0.72 × 1.32 on take-off, (1 + 0.4k) × (1 − 0.4k) on landing by impact, a slight stretch while falling, springing back with a little overshoot. Drawing only; the hitbox is always the plain square. *(2026-11-16T21:06:53+00:00)* |
| Dust | Built | One-cell motes in the guide's dust colour, drifting and fading: a puff on take-off, a bigger one on harder landings, and a kick when turning sharply. *(2026-11-16T21:06:53+00:00)* |
| Double jump and walls | Built | One air jump, coming back on landing or on a wall, with a ring of cells. Walls (#50): push into one within a cell for 0.1 s while falling to catch hold (#48); while on it, push towards it to hold still with no time limit, let go to slide down at up to 60 cells a second (with dust), push away to drop off; sliding to the floor leaves it. No climbing. Only walls beside the top 8 rows of the body count, so bumps of up to 4 cells are never walls, and bumps up to 3 cells are stepped up while falling as well as walking (#48). Every jump off a wall, or from up to 2 cells away, kicks away (70 out, 190 up) and locks input away from the wall for 0.1 s; steering back and jumping again scales a wall. *(2026-11-16T21:37:39+00:00)* |
| Controls | Built | Keyboard: A/D or Left/Right move; Space, K, W or Up jump. Gamepad: left stick or d-pad, A jump. Touch (phones and tablets): a fixed thumbstick bottom left (left and right only), Jump bottom right. No grab or climb input (#47, #50). *(2026-11-16T21:13:37+00:00; first version 2026-11-16T21:06:53+00:00) *(2026-11-16T21:06:53+00:00)* |
| Tests (player) | Passing | 29 unit tests: walking, variable jumps, coyote time, the jump buffer, stepping over bumps, landing impact; the double jump and its return on a wall; catching hold of a wall and its delay, holding while pushing, sliding when let go, dropping off, sliding to the floor, not being caught while rising, every wall jump kicking away, the input lock, scaling a wall by jumping off and steering back, wall jumps from 2 cells away, bumps never being walls; fall damage's threshold and cap, a jump plus double jump being safe, a double jump before landing not saving you, a wall slide resetting a fall; hurting, healing and marks, the dent's shape and outline; squash; the cell body; dust. Playwright: walking and a double jump with the keyboard; the thumbstick and Jump on a phone-sized screen; a long fall hurting, denting and showing on the bar, then the rest spot healing it; plus the smoke test in development and as a Pages build. *(2026-11-16T21:48:38+00:00)* |
| Health and fall damage | Built | 100 health. A fall is every cell fallen since last on the ground or a wall (going up, including a double jump, doesn't subtract; catching or sliding on a wall resets it). Safe up to 6 body heights; 12 damage per body height past that, capped at 85. A hurt landing squashes the body 1.35 × 0.7 (the guide's getting-hurt squash), flashes it damage red for a tenth of a second, and kicks up dust. Liquids and soft materials can't cushion falls yet: there are none in the game. *(2026-11-16T21:48:38+00:00)* |
| Marks on the body | Built | A fall dents the bottom of the body where it landed, deeper for more damage (up to about 40% of the body's height), with a crack or two running up from it; the outline is redrawn along the dent. Healing shrinks the newest marks first, so the dent fills back out as the bar refills. Fire and acid eating cells away come with the simulation. *(2026-11-16T21:48:38+00:00)* |
| Health bar | Built | Top left: a red fill on a dark track with an ink border; the lost part lingers as a pale trail for a moment, then drains. No number. *(2026-11-16T21:48:38+00:00)* |
| Stand-ins for testing | Built | A rest spot (a faint pulsing strip on the floor just right of the low ledge) that heals 40 a second while standing on it, and zero health respawning at the start, whole. A high ledge near the top right, reached by scaling the right-hand wall, to fall from. None of these are designs. *(2026-11-16T21:48:38+00:00)* |
| Tests (scaffold) | Passing | The Playwright smoke test passes in development and against a production build served from `/magic-sandbox/`, as on Pages, and was checked to fail when the scene throws. *(2026-11-16T20:07:36+00:00)* |
| Deployment | Live | `.github/workflows/deploy.yml`: on every push to `main` (or run by hand from the Actions tab), builds with Node 24 and deploys `dist/` to GitHub Pages. The first deploy succeeded; the live site at https://evanstom273.github.io/magic-sandbox/ boots in a headless browser with one canvas filling the window and no errors. *(2026-11-16T20:00:02+00:00; first deploy 2026-11-16T20:08:26+00:00)* |

### Known issues and limitations
- **Only tested in a headless browser** so far, which renders on the CPU. Feel and frame rate on the Fold are unknown until Lyra plays it.
- **Cells can look slightly uneven on high-density screens.** The canvas is drawn at CSS-pixel size and scaled up without blurring, so a cell that's, say, 3.8 screen pixels across is drawn 3 or 4 pixels wide. Drawing at the screen's full density would fix it.
- **The body isn't simulated yet** (#38): there's no simulation in the game for it to be part of. It's built as real cells, ready for the world.
- **Only falls can hurt for now,** and none of the real ways to heal exist yet (resting, things, magic, #58), so the rest spot and the respawn are stand-ins.

### Implementation interpretations (technical, not design decisions — flag if wrong)
- **The art style zip was committed unpacked**, as the `stylised-geometry/` folder rather than the `.zip` itself, since the guide is written to be copied into a project as a folder. `make_sheets.py` went into `sheets/`, where the guide says it lives. Same as in the stealth game.
- **The document is named `GAME_DESIGN.md`**, the name the stealth game's design doc started with, until this game has a name of its own.
- **Carried over from `STEALTH_GAME_DESIGN.md` rather than decided for this project:** ~~the style guide being a reference, not gospel;~~ (since restated by Lyra, #13); the guiding principles and Lyra's three workflow sections in §A (with the document's name in her words changed to `GAME_DESIGN.md`); and the "explain before adding" and merge-to-`main` standing orders in §H. Everything else, from the stealth game's concept to its stack, was left behind.
- **"Basically the same" stack** is read as including how the stealth game's parts fit together (its History #7–#9): React as the shell with Phaser in one component, Phaser 4, and Dexie only once something needs saving. Its testing setup (Vitest, plus a Playwright smoke test) isn't recorded as decided here.
- ~~**The workflow skips cleanly while there's no `package.json`**, so pushes to `main` don't pile up failed runs before the scaffold exists. The check can come out once the scaffold is in.~~ Taken out with the scaffold.
- **Linter: oxlint**, which Vite's template ships now, as in the stealth game.
- **TypeScript 7** is what Vite's template ships now (the Go-based compiler). `strict` is set explicitly in every tsconfig. The Playwright tests have their own tsconfig (`tsconfig.e2e.json`), since code they run in the page needs the browser's types.
- **Colour tokens** cover the whole colour-jobs table in the guide's §5.1, so they include power-light (`#cfeaff`) and hot tell (`#fff0d8`) as well as the seven in §12.4. The guide's light, squash and hit-stop numbers are left out until something moves, because they were tuned for a platformer. The backdrop (`#14141c`) is a placeholder from the reference sheets until the game has a world palette.
- **The canvas fills the window** and follows it when it changes size (Phaser's `RESIZE` mode), at one canvas pixel per CSS pixel. No resolution, aspect ratio or handling of high-density screens has been decided; the stealth game needed its own for the Fold.
- **No physics configured yet.** The stealth game used Phaser Arcade; that was a decision for that game, so it waits for this one's design.
- **The smoke test runs twice:** against the development server, and against a production build served from `/magic-sandbox/`, which is how Pages serves it, so a broken base path fails the test.
- **Vite's 500 kB chunk-size warning is raised to 2 MB**, because Phaser alone is about 1.5 MB minified (about 425 kB gzipped) and would trip it on every build.
- **`@playwright/test` is pinned to 1.63.0**, to match the browser installed in Claude's cloud environment. On a new machine, `npx playwright install chromium` fetches the matching browser.
- **Elden Ring-style catalysts (#23)** are read as: a held item that lets the player cast and shapes how they cast, like Elden Ring's staffs and sacred seals, with spells kept separately on the hotbar (#18) rather than stored inside the catalyst as in Noita's wands. ~~Flag if wrong.~~ Confirmed by Lyra's note in #27: any spell can be cast from any catalyst.
- **The debug/cheat menu (#24)** is taken to give any element, shape or trigger at will. Whether players get it in the finished game, or it's only for development, hasn't been said.
- **"The cast shapes and shit" (#29, #30)** is read as the Magic Mod's spell types (as shapes) and its casting types. Nothing else from the Magic Mod's design is carried over; it's a different game with handcrafted spells. Claude's reading of the shapes, from how the Magic Mod's spells use them: Self acts on the caster; Target acts directly on what's aimed at; Rune is placed on a surface and goes off later; Orbit circles the caster; Wave spreads outward from the caster in rings; Summon calls up something that acts on its own.
- **How smooth movement and simulated bodies fit together (#38, #39):** each character has its own small grid of cells that moves smoothly; the world will act on whichever body cells it overlaps, and knocked-off cells will drop into the world as world cells.
- **The player's starting values** are Claude's, to tune in play: walking at 66 cells a second (5.5 body widths); a full jump about 3 body heights; gravity 560 cells/s²; falls capped at 380 cells a second; squash spring stiffness 420, damping 24.
- **The camera** draws a cell 3 to 6 screen pixels across, set from the screen size so the player is about 40–70 px tall, and follows smoothly within the room.
- **The touch controls** show on touch screens (or with `?touch=1` in the address; `?touch=0` hides them). ~~Hold buttons in the bottom corners~~ A thumbstick, Grab and Jump since #45. Platforms and input are otherwise still open (§E).
- **Wall and double-jump values** are Claude's, to tune in play: double jump 180 cells a second (a little under the ground jump's 200); wall slide capped at 60; wall jump 70 out and 190 up, locking input for 0.1 s (#50). ~~Climbing, the climb jump and the ledge pop~~ are gone (#50). The thumbstick ignores nudges under 30% across.
- **The double jump's ring** is in the guide's pale dust colour rather than power blue, since this movement isn't magic. A small squash when grabbing a wall (0.9 × 1.08) and the double jump's stretch on climb jumps and ledge pops are Claude's additions.
- **Testing hooks:** in development the page exposes `window.__player()` and `window.__teleport(x, y)` for the browser tests; they're left out of production builds.
- **Health's look is Claude's:** red for the bar and the hurt flash, from the guide's colour jobs (damage red is for losing health and hurt flashes); the pale trail on the bar; dents up to about 40% of the body's height with a crack or two; where on the bottom a dent lands is random for now.
- **The page has an empty icon** (`data:,`) so the browser doesn't ask for a missing `favicon.ico`. No icon has been designed.
- **Vite's base path comes from the workflow.** The site is served from `/magic-sandbox/`, not the domain root, so the build gets `BASE_PATH` from Pages' own settings, and the scaffold's `vite.config` should read it (falling back to `/` locally). A custom domain later wouldn't need a code change.
- **Pages must deploy from GitHub Actions** (Settings → Pages → Source). ~~Claude can't see the repository settings, so this is unconfirmed.~~ Confirmed by the first deploy going live.

---

## G. Decision History

*Append-only. Changed decisions are recorded as new entries; earlier entries are preserved.*

| # | Timestamp (Europe/London) | Category | Decision |
|---|---|---|---|
| 1 | 2026-11-16T19:56:10+00:00 *(documentation time)* | Documentation | Living `GAME_DESIGN.md`, reset to the base of `STEALTH_GAME_DESIGN.md`: the same structure and conventions, none of the stealth game's design. |
| 2 | 2026-11-16T19:56:10+00:00 *(documentation time)* | Art | Art style: Stylised Geometry (`stylised-geometry/`). |
| 3 | 2026-11-16T20:00:02+00:00 *(documentation time)* | Technical | Stack: the same as the stealth game's (React, Vite, TypeScript, Tailwind CSS, Phaser 4, IndexedDB via Dexie.js; React shell, Phaser in one component, Dexie when first needed). |
| 4 | 2026-11-16T20:00:02+00:00 *(documentation time)* | Deployment | Deployed on GitHub Pages for now, instead of Cloudflare Workers. Pages activated by Lyra. |
| 5 | 2026-11-16T20:07:36+00:00 *(documentation time)* | Workflow | Scaffold approved as proposed: the stealth game's, without Cloudflare. |
| 6 | 2026-11-16T20:07:36+00:00 *(documentation time)* | Testing | Vitest for logic, plus a Playwright smoke test that boots the game in a real browser (Claude's recommendation, approved). |
| 7 | 2026-11-16T20:10:35+00:00 *(documentation time)* | Concept | Voxel-based (2D grid or 3D voxels not yet decided). |
| 8 | 2026-11-16T20:10:35+00:00 *(documentation time)* | Concept | A magic physics game. |
| 9 | 2026-11-16T20:10:35+00:00 *(documentation time)* | Concept | A mix between Terraria and Noita. |
| 10 | 2026-11-16T20:10:35+00:00 *(documentation time)* | Art | Characters in Lyra's Stylised Geometry art style; the world is voxels. |
| 11 | 2026-11-16T20:13:02+00:00 *(documentation time)* | Concept | The mix means the look of Terraria with the physics and magic of Noita. Refines #9. |
| 12 | 2026-11-16T20:13:02+00:00 *(documentation time)* | Concept | Flat and seen side-on: the voxels are a 2D grid of cells, not 3D (read from "the look of Terraria"). Answers the open question on #7. |
| 13 | 2026-11-16T20:13:02+00:00 *(documentation time)* | Art | The style guide is a guide, not gospel (restated by Lyra for this game). |
| 14 | 2026-11-16T20:19:20+00:00 | Magic | Magic is for fighting, shaping the world, getting around and solving problems (all four). |
| 15 | 2026-11-16T20:19:20+00:00 | Magic | Spells are mixed from elements and built from parts, simpler than Noita (Lyra combined two options). |
| 16 | 2026-11-16T20:19:20+00:00 | Magic | Mostly emergent, with some hand-made set pieces (Claude's recommendation, approved). |
| 17 | 2026-11-16T20:21:38+00:00 | Magic | A spell is element + shape + trigger (the trigger optional, setting off a second spell). |
| 18 | 2026-11-16T20:21:38+00:00 | Magic | Spells are both prepared (a hotbar of ready spells) and mixed on the fly. |
| 19 | 2026-11-16T20:21:38+00:00 | Magic | Multiple elements in a spell react by the world's own rules; no mixing table (Claude's recommendation, approved). |
| 20 | 2026-11-16T20:21:38+00:00 | Magic | Spells make real material where the element is a substance (Claude's recommendation, approved). |
| 21 | 2026-11-16T20:24:36+00:00 | Magic | Elements are substances and forces; the substances can be any of the world's materials (Lyra combined two options). |
| 22 | 2026-11-16T20:24:36+00:00 | Magic | Mana limits casting (Claude's recommendation, approved). |
| 23 | 2026-11-16T20:24:36+00:00 | Magic | The player casts with catalysts, Elden Ring style (Lyra's own answer). |
| 24 | 2026-11-16T20:24:36+00:00 | Magic | New magic is discovered by experimenting; plus a debug/cheat menu (Lyra's addition). |
| 25 | 2026-11-16T20:27:29+00:00 | Magic | Elements are learned by drawing them in with the catalyst (Claude's recommendation, approved). |
| 26 | 2026-11-16T20:27:29+00:00 | Magic | Shapes and triggers are all available from the start (Claude's recommendation, approved). |
| 27 | 2026-11-16T20:27:29+00:00 | Magic | Catalysts change power, affinity, capacity and quirks; any spell can be cast from any catalyst, some are just better (Lyra's note). |
| 28 | 2026-11-16T20:27:29+00:00 | Magic | One catalyst at a time. |
| 29 | 2026-11-16T20:30:15+00:00 | Magic | Shapes are the Magic Mod's spell types: Projectile, Beam, AoE, Rune, Self, Target, Summon, Orbit, Wave, Cone, Weapon enchantment (Lyra's call). |
| 30 | 2026-11-16T20:30:15+00:00 | Magic | Casting types from the Magic Mod: Instant, Charged, Channeled, Burst, Continuous. How they fit in is open. |
| 31 | 2026-11-16T20:31:38+00:00 | Magic | Each shape allows the casting types that make sense for it; the player picks among them (Claude's recommendation, approved). |
| 32 | 2026-11-16T20:31:38+00:00 | Magic | Starting triggers: on impact, after a delay, when something comes near, on recast. |
| 33 | 2026-11-16T20:31:38+00:00 | Combat | Weapons exist alongside magic; Weapon enchantment enchants them. |
| 34 | 2026-11-16T20:59:12+00:00 | World | Cell size: Fine (from the Magic Sandbox). |
| 35 | 2026-11-16T20:59:12+00:00 | Art | Characters (player, NPCs, everything) are made of voxels too, in the Stylised Geometry style (Lyra's idea). |
| 36 | 2026-11-16T20:59:12+00:00 | Workflow | First piece in the game: just the player, a blank square with movement, jumping, squash and stretch and particles. |
| 37 | 2026-11-16T21:06:53+00:00 | Art | Characters are 12 cells across (Claude's recommendation, approved). |
| 38 | 2026-11-16T21:06:53+00:00 | Art | Characters' cells are part of the simulation, not just drawn in cells. |
| 39 | 2026-11-16T21:06:53+00:00 | Art | Characters move smoothly, not snapped to the world's grid. |
| 40 | 2026-11-16T21:06:53+00:00 | Technical | Our own collision against the cell grid instead of Phaser Arcade (Claude's build plan, approved). |
| 41 | 2026-11-16T21:13:37+00:00 | Player | A double jump (Lyra's request). |
| 42 | 2026-11-16T21:13:37+00:00 | Player | Celeste-style walls: hold Grab to cling and climb, wall slide, wall jump, climb jump, ledge pop (hold to grab: Claude's recommendation, approved). |
| 43 | 2026-11-16T21:13:37+00:00 | Player | No stamina limit on walls. |
| 44 | 2026-11-16T21:13:37+00:00 | Player | The double jump comes back on landing or on a wall. |
| 45 | 2026-11-16T21:13:37+00:00 | Platform | Touch: fixed thumbstick, Jump and Grab (Claude's recommendation, approved). |
| 46 | 2026-11-16T21:13:37+00:00 | Platform | Keyboard: W/S climb, Space or K jump, Shift or J grab; gamepad RB/RT grab (Claude's plan, approved). |
| 47 | 2026-11-16T21:16:39+00:00 | Player | Auto grab instead of holding Grab: push into a wall (while not rising) to cling, stay on until pushing away; climbing down is the slide; no Grab button. Supersedes hold-to-grab in #42 and the Grab controls in #45, #46. |
| 48 | 2026-11-16T21:30:13+00:00 | Player | After Lyra's playtest (too sticky; caught on floor bumps): only walls beside the upper body count, a 0.1 s cling delay while falling, and stepping up bumps while coming down. |
| 49 | 2026-11-16T21:32:47+00:00 | Player | Only stay on a wall while pushing towards it; letting go drops off; a jump pushing in is the climb jump, a neutral jump is a wall jump. Supersedes "stays without holding anything" in #47 (Claude's detail, not Lyra's). |
| 50 | 2026-11-16T21:37:39+00:00 | Player | No climbing: on a wall, push towards it to hold, let go to slide, push away to drop off; every jump off a wall kicks away; scale walls by jumping off and steering back (Lyra). Claude's knock-ons: climb jump and ledge pop removed, W/Up jump again, shorter kick-off (70, 0.1 s lock). Supersedes climbing in #42, #46, #47, #49. |
| 51 | 2026-11-16T21:41:08+00:00 | Health | Fall damage, with walls and magic as ways to avoid it. |
| 52 | 2026-11-16T21:41:08+00:00 | Health | Health shows as a bar (at a glance) and as the player's body deforming. |
| 53 | 2026-11-16T21:42:51+00:00 | Health | Health is a number; damage marks the body where it came from (Claude's recommendation, approved). |
| 54 | 2026-11-16T21:42:51+00:00 | Health | Deformation by kind of damage: falls and blows dent and crack; fire and acid eat cells away into the world (Claude's recommendation, approved). |
| 55 | 2026-11-16T21:42:51+00:00 | Health | Moderate fall damage: safe to about 6 body heights, long falls take most health but don't kill outright (Claude's recommendation, approved). |
| 56 | 2026-11-16T21:42:51+00:00 | Health | Falls are broken by walls, landing in liquid, and soft materials (and magic); not by the double jump. |
| 57 | 2026-11-16T21:44:11+00:00 | Health | Middling toughness (Claude's recommendation, approved). |
| 58 | 2026-11-16T21:44:11+00:00 | Health | Health comes back from resting, things and magic; no passive regeneration. |
| 59 | 2026-11-16T21:44:11+00:00 | Health | Marks mend as health refills (Claude's recommendation, approved). |
| 60 | 2026-11-16T21:44:11+00:00 | Health | Death decided later, with the game's structure; respawn at the start for testing (Claude's recommendation, approved). |
| 61 | 2026-11-16T21:48:38+00:00 | Workflow | Health build plan approved, with Claude's starting values and stand-ins (rest spot, respawn at the start). |

---

## H. Technical Notes

- **Repository:** `evanstom273/magic-sandbox`. Working branch `ccr-0ed275cd-237irz`.
- **Art style reference:** `stylised-geometry/STYLISED_GEOMETRY.md` and `stylised-geometry/sheets/01-anatomy.svg` to `07-colour.svg`, regenerated by `stylised-geometry/sheets/make_sheets.py` (Python standard library only; takes the output folder as its one argument). The guide was developed in a side-on platformer; rules it marks **(untested)** haven't been through a real game yet.
- **Live site:** https://evanstom273.github.io/magic-sandbox/
- **Deployment:** `.github/workflows/deploy.yml` builds (`npm ci`, `npm run build` with `BASE_PATH` set) and deploys `dist/` to GitHub Pages on every push to `main`. Pages' source has to be set to GitHub Actions.
- **Project layout:**
  - `src/App.tsx`: the React shell. `src/game/PhaserGame.tsx` holds the canvas; `src/game/createGame.ts` configures Phaser.
  - `src/game/scenes/MainScene.ts`: the one scene: the test room, the player, the camera, drawing.
  - `src/game/world/`: the cell grid, the test room and how it's painted.
  - `src/game/player/`: `tuning.ts` (every starting value), `movement.ts` (walking, jumping, collision), `squash.ts`, `body.ts` (the body's cells).
  - `src/game/player/health.ts`: health, fall damage and the marks on the body (drawn by `body.ts`).
  - `src/game/bridge.ts`: what the game tells the React interface (health, for now). `src/ui/HealthBar.tsx` draws the bar.
  - `src/game/effects/`: dust motes (`dust.ts`) and rings (`rings.ts`).
  - `src/game/input/touchInput.ts` and `src/ui/TouchControls.tsx`: the thumbstick and touch buttons.
  - `src/game/style/tokens.ts`: the style guide's colour tokens.
  - `tests/e2e/`: Playwright. `playwright.config.ts` starts both servers it tests against.
  - `vite.config.ts`: the Pages base path (`BASE_PATH`), Tailwind, and Vitest's settings.
  - Commands are in the README.
- **Explain before adding** *(carried over from Lyra's previous design documents)*: before building anything, Claude says what it's about to add and how, then waits for the go-ahead.
- **Workflow** *(Lyra's standing order across all her projects)*: after committing to the working branch, always merge straight to `main` as well; no need to ask each time.
