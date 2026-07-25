/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as {
  version: string;
};

/**
 * Font subsets @fontsource emits that this app can never draw: every face is
 * unicode-range gated and the UI ships ru/en/es only, so the browser never
 * requests them. They stay in dist (the CSS still references them) but are kept
 * out of the precache, which is otherwise downloaded in full on first visit.
 */
const UNUSED_FONT_SUBSETS = ['**/*-greek-*.woff*', '**/*-vietnamese-*.woff*'];
// Legacy .woff fallbacks: every face also ships as .woff2, which any browser
// able to run this PWA prefers — precaching the .woff pair would add ~646 KB
// nobody ever fetches. They stay in dist for the CSS src list, unprecached.
const LEGACY_WOFF = ['**/*.woff'];

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // The learner decides when to reload: an automatic update mid-drill would
      // discard the round in progress. See src/services/pwaUpdate.ts.
      registerType: 'prompt',
      // pwaUpdate.ts owns registration; no injected inline script.
      injectRegister: null,
      manifest: {
        name: 'wordavi — испанские числа',
        short_name: 'wordavi',
        description: 'Учим испанские числа: цены, веса, количество.',
        // The plugin writes `lang` whether or not we ask; match index.html
        // rather than let it default to English for a Russian name.
        lang: 'ru',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#FAF2E1',
        theme_color: '#FAF2E1',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icons/icon-maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Full precache, no runtimeCaching: the app is static and must work
        // offline on first launch, so every emitted asset ships up front.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2,webmanifest}'],
        globIgnores: [...UNUSED_FONT_SUBSETS, ...LEGACY_WOFF],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
    // Cap worker forks: 57+ happy-dom test files across parallel sessions
    // otherwise fan out into tens of node processes and exhaust RAM.
    maxWorkers: 2,
  },
});
