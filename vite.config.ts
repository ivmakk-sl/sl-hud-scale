// Builds the page script: one IIFE file, not minified, that C# embeds and sends to the root page.
// The entry sets window.__hudscale itself, so the bundle exports nothing. The page tests run against
// that bundle and the game's own HUD pages and settings window.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/Web/page/main.ts',
      formats: ['iife'],
      name: 'hudscalePage',
      fileName: () => 'page.js',
    },
    outDir: 'obj/page',
    emptyOutDir: true,
    minify: false,
  },
  test: {
    include: ['tests/page/**/*.test.ts'],
    // Each test loads a game page in jsdom, which takes about half a second.
    testTimeout: 20000,
  },
});
