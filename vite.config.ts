/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as {
  version: string;
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
