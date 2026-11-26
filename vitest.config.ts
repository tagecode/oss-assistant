import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/main/**/*.ts'],
      exclude: ['src/main/index.ts'],
      reportsDirectory: 'coverage/node',
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        statements: 60,
        branches: 50,
        functions: 60,
        lines: 65
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve('src/renderer/src')
    }
  }
})
