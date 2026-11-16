# magic-sandbox

The design lives in [`GAME_DESIGN.md`](GAME_DESIGN.md); the art style in [`stylised-geometry/`](stylised-geometry/).

Live at https://evanstom273.github.io/magic-sandbox/, deployed from `main` by GitHub Actions.

## Commands

```sh
npm install          # once
npm run dev          # local dev server at http://localhost:5173
npm run build        # typecheck and build into dist/
npm run preview      # serve the built dist/
npm run typecheck
npm run lint         # oxlint
npm test             # Vitest unit tests
npm run test:e2e     # Playwright: boots the game in dev and as a Pages build
```

Playwright is pinned to 1.63.0 to match the browser in Claude's cloud environment. On a new machine, `npx playwright install chromium` fetches the matching browser.
