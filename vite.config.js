import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  // ponytail: pi-ai's isolated chunk is 80 kB gzip; split it only if loading metrics regress.
  build: { outDir: 'dist', chunkSizeWarningLimit: 600 },
});
