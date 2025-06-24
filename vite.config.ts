// vite.config.ts
import {defineConfig} from 'vite'
import {resolve} from 'path'

export default defineConfig({
  build: {
    target: 'node16', // Target Node.js 16+
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'Threader',
      formats: ['cjs', 'es'], // Only Node.js formats
      fileName: format => {
        switch (format) {
          case 'es':
            return 'index.esm.js'
          case 'cjs':
            return 'index.cjs'
          default:
            return `index.${format}.js`
        }
      }
    },
    rollupOptions: {
      // Mark Node.js built-ins as external
      external: [
        'worker_threads',
        'path',
        'fs',
        'os',
        'crypto',
        'child_process',
        'util',
        // Also mark the Rust binary as external
        /.*\.node$/
      ],
      output: {
        // Preserve Node.js module structure
        exports: 'named',
        interop: 'auto'
      }
    },
    minify: false, // Keep readable for debugging
    sourcemap: true,
    emptyOutDir: true,
    // Build for Node.js environment
    ssr: true
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production')
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  // Ensure we're building for Node.js
  esbuild: {
    platform: 'node',
    target: 'node16'
  }
})
