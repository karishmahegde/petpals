/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Unit and component tests (npm test). Specs sit beside the file they test
  // as *.test.ts(x); Cypress's *.cy.ts specs are a separate runner.
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx', 'src/vite-env.d.ts'],
      reporter: ['text-summary', 'lcov'],
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:5000'
    }
  }
});
