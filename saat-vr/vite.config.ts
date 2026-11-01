import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
// Entrega: jogar/index.html autocontido (publicado no GitHub Pages em saat-vr/jogar/).
export default defineConfig({
  plugins: [viteSingleFile()],
  base: './', build: { outDir: 'jogar', emptyOutDir: true, target: 'es2020', assetsInlineLimit: 100000000, cssCodeSplit: false, chunkSizeWarningLimit: 4000 },
  test: { include: ['tests/**/*.test.ts'] },
} as any);
