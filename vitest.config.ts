import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // the renderer's alias (electron.vite.config.ts), so lib modules that import app helpers load in tests
  resolve: { alias: { '@': resolve('src/renderer/src'), '@shared': resolve('src/shared') } },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    globalSetup: ['src/main/testing/test-temp.ts']
  }
})
