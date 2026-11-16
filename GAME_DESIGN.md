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

*Not decided yet: what the game is, who the player is, and what it's called.* The repository is `magic-sandbox`.

**Where the project stands (as of 2026-11-16T20:00:02+00:00):**
- Living design document created, reset to the base of `STEALTH_GAME_DESIGN.md`: its structure and conventions, none of the stealth game's design (History #1).
- Art style reference added to the repository as `stylised-geometry/`, including `make_sheets.py` (History #2).
- Stack and deployment settled: the stealth game's stack, on GitHub Pages for now (History #3, #4). The deploy workflow is in, with nothing to deploy until the project is scaffolded.
- Nothing designed or built yet.

**Stack:** React, Vite, TypeScript, Tailwind CSS, Phaser and IndexedDB via Dexie.js, the same as the stealth game's, deployed on GitHub Pages for now (History #3, #4).
- **React** is the outer shell; **Phaser** (v4) runs the game inside a single React component.
- **Tailwind** styles anything React draws.
- **Dexie** comes in when there's first something to save.
- **GitHub Pages** serves the built game, deployed by a GitHub Actions workflow on every push to `main`. It's static hosting, so there's no server code.

**Art style:** Stylised Geometry, kept in `stylised-geometry/`: the guide (`STYLISED_GEOMETRY.md`), seven SVG reference sheets and `make_sheets.py`, which regenerates them. In short: characters built from simple geometric shapes, with faces and floating hands, in a dark world lit around them, all drawn from shapes in code or SVG rather than sprites. The guide is the reference for how things look; this document records the game's own design.

**The style guide is a reference, not gospel** *(Lyra, for the stealth game; carried over)*. It informs how things look; it doesn't decide anything. Where this game wants something different, the game wins, and Claude shouldn't present the guide's rules as reasons on their own.

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
- *Nothing decided yet.*

### Art and presentation
- **Art style: Stylised Geometry**, as set out in `stylised-geometry/STYLISED_GEOMETRY.md` and its reference sheets. *(2026-11-16T19:56:10+00:00, documentation time — History #2)*

### Technical architecture / platform
- **Stack: the same as the stealth game's.** React, Vite, TypeScript, Tailwind CSS, Phaser and IndexedDB via Dexie.js; React as the outer shell with Phaser running inside one React component, Phaser 4, and Dexie added when there's first something to save. *(2026-11-16T20:00:02+00:00, documentation time — History #3)*
- **Deployed on GitHub Pages, for now**, instead of the stealth game's Cloudflare Workers. Lyra has activated Pages in the repository settings. *(2026-11-16T20:00:02+00:00, documentation time — History #4)*

### Documentation
- **Living `GAME_DESIGN.md`**, reset to the base of `STEALTH_GAME_DESIGN.md`: the same structure and conventions, updated after everything, with none of the stealth game's design. *(2026-11-16T19:56:10+00:00, documentation time — History #1)*

---

## C. Current Development Scope

Nothing in design yet. Stack and deployment are settled (#3, #4), and the GitHub Pages workflow is in, waiting for a project scaffold to build.

**Artifacts:** none yet.

---

## D. Future Possibilities

*Proposals only — not confirmed features.*

- None yet.

---

## E. Open Questions

1. **Title.**
2. **The concept:** what the game is, and who the player is.
3. ~~**Stack.**~~ The stealth game's, on GitHub Pages for now (#3, #4).
4. **Platforms and input.**

---

## F. Implementation Status

*Updated 2026-11-16T20:00:02+00:00.*

| Feature | Status | Notes |
|---|---|---|
| Design doc | Done | `GAME_DESIGN.md`, reset to the base of `STEALTH_GAME_DESIGN.md`. *(2026-11-16T19:56:10+00:00)* |
| Art style reference | Added | `stylised-geometry/`, unpacked from `stylised-geometry.zip` as supplied, with Lyra's `make_sheets.py` in `sheets/`. Checked: the script regenerates all seven sheets byte for byte. *(2026-11-16T19:56:10+00:00)* |
| Deployment workflow | Added, idle until there's an app | `.github/workflows/deploy.yml`: on every push to `main` (or run by hand from the Actions tab), builds with Node 24 and deploys `dist/` to GitHub Pages. While there's no `package.json` it skips the build and deploy instead of failing. Hasn't deployed anything yet. *(2026-11-16T20:00:02+00:00)* |

### Known issues and limitations
- None yet.

### Implementation interpretations (technical, not design decisions — flag if wrong)
- **The art style zip was committed unpacked**, as the `stylised-geometry/` folder rather than the `.zip` itself, since the guide is written to be copied into a project as a folder. `make_sheets.py` went into `sheets/`, where the guide says it lives. Same as in the stealth game.
- **The document is named `GAME_DESIGN.md`**, the name the stealth game's design doc started with, until this game has a name of its own.
- **Carried over from `STEALTH_GAME_DESIGN.md` rather than decided for this project:** the style guide being a reference, not gospel; the guiding principles and Lyra's three workflow sections in §A (with the document's name in her words changed to `GAME_DESIGN.md`); and the "explain before adding" and merge-to-`main` standing orders in §H. Everything else, from the stealth game's concept to its stack, was left behind.
- **"Basically the same" stack** is read as including how the stealth game's parts fit together (its History #7–#9): React as the shell with Phaser in one component, Phaser 4, and Dexie only once something needs saving. Its testing setup (Vitest, plus a Playwright smoke test) isn't recorded as decided here.
- **The workflow skips cleanly while there's no `package.json`**, so pushes to `main` don't pile up failed runs before the scaffold exists. The check can come out once the scaffold is in.
- **Vite's base path comes from the workflow.** The site is served from `/magic-sandbox/`, not the domain root, so the build gets `BASE_PATH` from Pages' own settings, and the scaffold's `vite.config` should read it (falling back to `/` locally). A custom domain later wouldn't need a code change.
- **Pages must deploy from GitHub Actions** (Settings → Pages → Source). Claude can't see the repository settings, so this is unconfirmed.

---

## G. Decision History

*Append-only. Changed decisions are recorded as new entries; earlier entries are preserved.*

| # | Timestamp (Europe/London) | Category | Decision |
|---|---|---|---|
| 1 | 2026-11-16T19:56:10+00:00 *(documentation time)* | Documentation | Living `GAME_DESIGN.md`, reset to the base of `STEALTH_GAME_DESIGN.md`: the same structure and conventions, none of the stealth game's design. |
| 2 | 2026-11-16T19:56:10+00:00 *(documentation time)* | Art | Art style: Stylised Geometry (`stylised-geometry/`). |
| 3 | 2026-11-16T20:00:02+00:00 *(documentation time)* | Technical | Stack: the same as the stealth game's (React, Vite, TypeScript, Tailwind CSS, Phaser 4, IndexedDB via Dexie.js; React shell, Phaser in one component, Dexie when first needed). |
| 4 | 2026-11-16T20:00:02+00:00 *(documentation time)* | Deployment | Deployed on GitHub Pages for now, instead of Cloudflare Workers. Pages activated by Lyra. |

---

## H. Technical Notes

- **Repository:** `evanstom273/magic-sandbox`. Working branch `ccr-0ed275cd-237irz`.
- **Art style reference:** `stylised-geometry/STYLISED_GEOMETRY.md` and `stylised-geometry/sheets/01-anatomy.svg` to `07-colour.svg`, regenerated by `stylised-geometry/sheets/make_sheets.py` (Python standard library only; takes the output folder as its one argument). The guide was developed in a side-on platformer; rules it marks **(untested)** haven't been through a real game yet.
- **Live site:** https://evanstom273.github.io/magic-sandbox/, once something's been deployed.
- **Deployment:** `.github/workflows/deploy.yml` builds (`npm ci`, `npm run build` with `BASE_PATH` set) and deploys `dist/` to GitHub Pages on every push to `main`. Pages' source has to be set to GitHub Actions.
- **Project layout:** nothing yet beyond this document, the deploy workflow, the art style reference and the README.
- **Explain before adding** *(carried over from Lyra's previous design documents)*: before building anything, Claude says what it's about to add and how, then waits for the go-ahead.
- **Workflow** *(Lyra's standing order across all her projects)*: after committing to the working branch, always merge straight to `main` as well; no need to ask each time.
