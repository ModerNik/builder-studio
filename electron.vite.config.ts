import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'

// src/shared is imported by all three processes, so its alias does not depend on folder depth
const shared = { '@shared': resolve('src/shared') }

export default defineConfig({
  main: { resolve: { alias: shared } },
  preload: { resolve: { alias: shared } },
  renderer: {
    resolve: {
      alias: {
        ...shared,
        '@': resolve('src/renderer/src')
      }
    },
    // React Compiler memoizes components and hooks at build time (React 19)
    plugins: [react(), babel({ presets: [reactCompilerPreset()] }), tailwindcss()],
    // electron-vite leaves the renderer unminified by default; minified JS and CSS parse faster at boot
    build: { minify: true }
  }
})
