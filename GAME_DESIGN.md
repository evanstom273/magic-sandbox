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

**Where the project stands (as of 2026-11-16T20:24:36+00:00):**
- Living design document created, reset to the base of `STEALTH_GAME_DESIGN.md`: its structure and conventions, none of the stealth game's design (History #1).
- Art style reference added to the repository as `stylised-geometry/`, including `make_sheets.py` (History #2).
- Stack and deployment settled: the stealth game's stack, on GitHub Pages for now (History #3, #4).
- Project scaffold built and tested (History #5, #6): an empty Phaser scene inside React, deployed to GitHub Pages by a workflow on every push to `main`. Nothing game-related yet.
- Top-level design from Lyra (History #7–#13).
- Designing the magic: round 1 settled what it's for, how spells are made, and how much is scripted (History #14–#16); round 2 how spells are built, when, how elements mix, and that spells make real material (History #17–#20); round 3 what the elements are, mana, catalysts, and learning by experiment (History #21–#24).

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
- **The player casts with catalysts, Elden Ring style.** Lyra's own answer, over bare hands, a wand or staff, a spellbook and something worn. What a catalyst does beyond enabling casting is round 4. *(2026-11-16T20:24:36+00:00 — History #23)*
- **New magic is discovered by experimenting**, plus **a debug/cheat menu**. Lyra added the menu. Found, crafted and learned through use were not chosen. *(2026-11-16T20:24:36+00:00 — History #24)*

### Art and presentation
- **Art style: Stylised Geometry**, as set out in `stylised-geometry/STYLISED_GEOMETRY.md` and its reference sheets. *(2026-11-16T19:56:10+00:00, documentation time — History #2)*
- **The characters are in Lyra's Stylised Geometry style.** The world is voxels~~; how much of the guide applies to it is open (§E)~~, with Terraria's look (#11). *(2026-11-16T20:10:35+00:00, documentation time — History #10)*
- **The style guide is a guide, not gospel.** Lyra, restating it for this game: it informs the look, it doesn't set rules the game has to follow. *(2026-11-16T20:13:02+00:00, documentation time — History #13)*

### Technical architecture / platform
- **Stack: the same as the stealth game's.** React, Vite, TypeScript, Tailwind CSS, Phaser and IndexedDB via Dexie.js; React as the outer shell with Phaser running inside one React component, Phaser 4, and Dexie added when there's first something to save. *(2026-11-16T20:00:02+00:00, documentation time — History #3)*
- **Deployed on GitHub Pages, for now**, instead of the stealth game's Cloudflare Workers. Lyra has activated Pages in the repository settings. *(2026-11-16T20:00:02+00:00, documentation time — History #4)*

### Development approach
- **The scaffold was approved as proposed** (Lyra: "Yes scaffold"): the stealth game's, without Cloudflare. Strict TypeScript, Tailwind, Phaser 4 with one empty scene inside a React component, and the guide's colour tokens; no Dexie until something needs saving. *(2026-11-16T20:07:36+00:00, documentation time — History #5)*

### Testing
- **Vitest for logic, plus a Playwright smoke test** that boots the game in a real browser and fails if the canvas doesn't appear or anything errors. The same as the stealth game's; Claude's recommendation, approved with the scaffold. *(2026-11-16T20:07:36+00:00, documentation time — History #6)*

### Documentation
- **Living `GAME_DESIGN.md`**, reset to the base of `STEALTH_GAME_DESIGN.md`: the same structure and conventions, updated after everything, with none of the stealth game's design. *(2026-11-16T19:56:10+00:00, documentation time — History #1)*

---

## C. Current Development Scope

**In design: magic.** The top level is from Lyra: a voxel-based magic physics game with the look of Terraria and the physics and magic of Noita, flat and side-on, with Stylised Geometry characters (#7–#13). Magic rounds 1–3 are done (#14–#24); round 4 is how experimenting teaches magic, and what catalysts do. Stack and deployment are settled (#3, #4) and the scaffold is built and deploying (#5, #6; see §F).

**Artifacts:** none yet.

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
8. **Magic details** (#14–#20): ~~how elements and parts fit together~~ (#17); ~~when spells are put together~~ (#18); ~~what the elements are~~ (#21); ~~what limits casting~~ (#22); ~~what the player casts with~~ (#23); ~~where spells come from~~ (#24); how experimenting teaches magic; what catalysts do; mana's numbers; the list of shapes and triggers; how quick mixing works on touch.
9. **Cell size.** Terraria's blocks are chunky; Noita's cells are about a pixel each, which is a lot of why its sand, liquids and fire look and move the way they do. Where this sits shapes the look, the physics and how much the Fold has to simulate.

---

## F. Implementation Status

*Updated 2026-11-16T20:07:36+00:00.*

| Feature | Status | Notes |
|---|---|---|
| Design doc | Done | `GAME_DESIGN.md`, reset to the base of `STEALTH_GAME_DESIGN.md`. *(2026-11-16T19:56:10+00:00)* |
| Art style reference | Added | `stylised-geometry/`, unpacked from `stylised-geometry.zip` as supplied, with Lyra's `make_sheets.py` in `sheets/`. Checked: the script regenerates all seven sheets byte for byte. *(2026-11-16T19:56:10+00:00)* |
| Project scaffold | Done | Vite 8, React 19, TypeScript 7 (strict), Tailwind v4, Phaser 4.2.1. One empty scene filling the window; the style guide's colour tokens in `src/game/style/tokens.ts`. Typecheck, lint and build pass; the build's asset paths point under `/magic-sandbox/`. *(2026-11-16T20:07:36+00:00)* |
| Tests | Passing | Vitest is set up with no tests yet (there's no logic to test). The Playwright smoke test passes in development and against a production build served from `/magic-sandbox/`, as on Pages, and was checked to fail when the scene throws. *(2026-11-16T20:07:36+00:00)* |
| Deployment | Live | `.github/workflows/deploy.yml`: on every push to `main` (or run by hand from the Actions tab), builds with Node 24 and deploys `dist/` to GitHub Pages. The first deploy succeeded; the live site at https://evanstom273.github.io/magic-sandbox/ boots in a headless browser with one canvas filling the window and no errors. *(2026-11-16T20:00:02+00:00; first deploy 2026-11-16T20:08:26+00:00)* |

### Known issues and limitations
- **Only tested in a headless browser** so far, which renders on the CPU. Nothing has been checked on a real phone, but there's nothing on screen to check yet.

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
- **Elden Ring-style catalysts (#23)** are read as: a held item that lets the player cast and shapes how they cast, like Elden Ring's staffs and sacred seals, with spells kept separately on the hotbar (#18) rather than stored inside the catalyst as in Noita's wands. Flag if wrong.
- **The debug/cheat menu (#24)** is taken to give any element, shape or trigger at will. Whether players get it in the finished game, or it's only for development, hasn't been said.
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

---

## H. Technical Notes

- **Repository:** `evanstom273/magic-sandbox`. Working branch `ccr-0ed275cd-237irz`.
- **Art style reference:** `stylised-geometry/STYLISED_GEOMETRY.md` and `stylised-geometry/sheets/01-anatomy.svg` to `07-colour.svg`, regenerated by `stylised-geometry/sheets/make_sheets.py` (Python standard library only; takes the output folder as its one argument). The guide was developed in a side-on platformer; rules it marks **(untested)** haven't been through a real game yet.
- **Live site:** https://evanstom273.github.io/magic-sandbox/
- **Deployment:** `.github/workflows/deploy.yml` builds (`npm ci`, `npm run build` with `BASE_PATH` set) and deploys `dist/` to GitHub Pages on every push to `main`. Pages' source has to be set to GitHub Actions.
- **Project layout:**
  - `src/App.tsx`: the React shell. `src/game/PhaserGame.tsx` holds the canvas; `src/game/createGame.ts` configures Phaser.
  - `src/game/scenes/MainScene.ts`: the one scene, empty for now.
  - `src/game/style/tokens.ts`: the style guide's colour tokens.
  - `tests/e2e/`: Playwright. `playwright.config.ts` starts both servers it tests against.
  - `vite.config.ts`: the Pages base path (`BASE_PATH`), Tailwind, and Vitest's settings.
  - Commands are in the README.
- **Explain before adding** *(carried over from Lyra's previous design documents)*: before building anything, Claude says what it's about to add and how, then waits for the go-ahead.
- **Workflow** *(Lyra's standing order across all her projects)*: after committing to the working branch, always merge straight to `main` as well; no need to ask each time.
