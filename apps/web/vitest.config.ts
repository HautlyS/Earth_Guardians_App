import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import wasm from '@vitejs/plugin-wasm'
import topLevelAwait from '@vitejs/plugin-top-level-await'
import { resolve } from 'path'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [
    vue(),
    wasm(),
    topLevelAwait()
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/tests/**',
        '**/dist/**'
      ],
      thresholds: {
        statements: 0,
        branches: 0,
        functions: 0,
        lines: 0
      }
    },
    include: ['**/*.test.ts', '**/*.spec.ts', '**/*.test.vue'],
    exclude: ['node_modules', 'dist', 'target', '**/*.js'],
    testTimeout: 10000,
    hookTimeout: 10000
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@composables': resolve(__dirname, 'src/composables'),
      '@stores': resolve(__dirname, 'src/stores'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@types': resolve(__dirname, 'src/types'),
      '@shared': resolve(__dirname, '../../packages/shared/pkg')
    }
  },
  server: {
    deps: {
      inline: ['vue', 'vue-router', 'pinia', '@supabase/supabase-js']
    }
  },
  build: {
    rollupOptions: {
      external: ['@earth-guardians/shared']
    }
  }
})