import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' so the same build works inside the Android app and on a GitHub Pages link.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { target: 'es2020', chunkSizeWarningLimit: 4000 },
  server: { port: 4174, host: true },
  preview: { port: 4174, host: true },
});
