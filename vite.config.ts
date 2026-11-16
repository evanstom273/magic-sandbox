/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  // GitHub Pages serves the site from /magic-sandbox/; the deploy workflow sets
  // BASE_PATH from Pages' own settings. Locally it's the root.
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
  build: {
    // Phaser alone is about 1.5 MB minified, so the default 500 kB warning would trip on every build.
    chunkSizeWarningLimit: 2000,
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    // There's no game logic to test yet.
    passWithNoTests: true,
  },
})
