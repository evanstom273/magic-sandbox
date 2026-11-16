import { defineConfig, devices } from '@playwright/test'

const DEV = 'http://localhost:5173/'
// The production build, served from the same path as on GitHub Pages.
const PAGES = 'http://localhost:4173/magic-sandbox/'

export default defineConfig({
  testDir: 'tests/e2e',
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: { trace: 'off' },
  projects: [
    { name: 'dev', use: { ...devices['Desktop Chrome'], baseURL: DEV } },
    { name: 'pages-build', use: { ...devices['Desktop Chrome'], baseURL: PAGES } },
  ],
  webServer: [
    {
      command: 'npm run dev -- --port 5173 --strictPort',
      url: DEV,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run build && npm run preview -- --port 4173 --strictPort',
      url: PAGES,
      env: { BASE_PATH: '/magic-sandbox/' },
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
})
