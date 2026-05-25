import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import compression from 'vite-plugin-compression'
import { createHtmlPlugin } from 'vite-plugin-html'
import packageJson from './package.json'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [
      vue(),
      wasm({
        // WebAssembly plugin configuration
        fuseWasmLoader: false,
        targetEnv: 'web',
      }),
      topLevelAwait({
        // Top-level await support for WASM
        polyfill: false,
      }),
      compression({
        algorithm: 'gzip',
        ext: '.gz',
        threshold: 10240, // 10KB
      }),
      compression({
        algorithm: 'brotliCompress',
        ext: '.br',
        threshold: 10240,
      }),
      createHtmlPlugin({
        minify: mode === 'production',
        inject: {
          data: {
            title: 'Earth Guardians',
            version: packageJson.version,
            description: packageJson.description,
          },
        },
      }),
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        '@components': resolve(__dirname, 'src/components'),
        '@composables': resolve(__dirname, 'src/composables'),
        '@stores': resolve(__dirname, 'src/stores'),
        '@utils': resolve(__dirname, 'src/utils'),
        '@types': resolve(__dirname, 'src/types'),
        '@shared': resolve(__dirname, '../../packages/shared/pkg'),
      },
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.vue'],
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: mode !== 'production',
      minify: mode === 'production' ? 'terser' : false,
      target: 'esnext',
      modulePreload: {
        polyfill: false,
      },
      rollupOptions: {
        output: {
          manualChunks: {
            'vue-vendor': ['vue', 'vue-router', 'pinia'],
            'supabase': ['@supabase/supabase-js'],
            'wasm-core': ['@earth-guardians/shared'],
          },
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
        external: ['__WRAPPER_JS__'],
      },
      wasm: {
        // WebAssembly build options
        destDir: 'assets/wasm',
        name: 'earth_guardians_wasm',
      },
      reportCompressedSize: true,
      chunkSizeWarningLimit: 1000, // 1MB
    },
    server: {
      port: 3000,
      host: env.VITE_DEV_HOST || false,
      https: env.VITE_HTTPS === 'true' ? {
        cert: env.VITE_SSL_CERT,
        key: env.VITE_SSL_KEY,
      } : false,
      open: mode !== 'test',
      cors: true,
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:4000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
        '/supabase': {
          target: env.VITE_SUPABASE_URL || 'http://localhost:4000',
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: 4173,
      host: true,
      cors: true,
    },
    optimizeDeps: {
      exclude: ['@earth-guardians/shared'],
      include: ['vue', 'vue-router', 'pinia', '@supabase/supabase-js'],
    },
    worker: {
      format: 'es',
      plugins: () => [wasm(), topLevelAwait()],
    },
    define: {
      __APP_VERSION__: JSON.stringify(packageJson.version),
      __APP_ENV__: JSON.stringify(mode),
      __VUE_OPTIONS_API__: JSON.stringify(true),
      __VUE_PROD_DEVTOOLS__: JSON.stringify(false),
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: JSON.stringify(false),
    },
    esbuild: {
      target: 'esnext',
      supported: {
        'top-level-await': true,
      },
    },
  }
})
