import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  root: '.',
  base: './',
  build: {
    outDir: resolve(__dirname, '../dashboard'),
    emptyOutDir: true,
  },
})
