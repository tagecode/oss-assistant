import { resolve } from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/component/**/*.test.tsx'],
    setupFiles: ['./tests/setup.web.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/renderer/src/**/*.{ts,tsx}'],
      exclude: ['src/renderer/src/main.tsx'],
      reportsDirectory: 'coverage/web',
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        statements: 45,
        branches: 45,
        functions: 40,
        lines: 45
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve('src/renderer/src')
    }
  }
})
