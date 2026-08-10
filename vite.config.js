import { copyFile, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'sites-static-output',
      apply: 'build',
      async buildStart() {
        await rm(resolve('dist'), { recursive: true, force: true });
      },
      async closeBundle() {
        await mkdir(resolve('dist/server'), { recursive: true });
        await copyFile(resolve('dist/client/server/index.js'), resolve('dist/server/index.js'));
      },
    },
  ],
  base: './',
  // ponytail: pi-ai's isolated chunk is 80 kB gzip; split it only if loading metrics regress.
  build: { outDir: 'dist/client', chunkSizeWarningLimit: 600 },
});
