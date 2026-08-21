import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  // 1. Point to your repository subdirectory for GitHub Pages deployment
  base: '/silverhand/', 

  // 2. Register bundled plugins together in a single array
  plugins: [
    react(), 
    tailwindcss()
  ],

  // 3. Configure path mapping alias mapping '@/' to your root directory
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url))
    },
  },

  // 4. Preserve configuration server watch controls
  server: {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modify—file watching is disabled to prevent flickering during agent edits.
    hmr: process.env.DISABLE_HMR !== 'true',
    // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
  },
});
