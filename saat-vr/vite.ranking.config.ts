import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
// Tela de ranking (outra tela/TV): ranking/index.html autocontido, mesma origem do simulador (lê o cadastro deste navegador).
export default defineConfig({
  root: 'ranking-src', plugins: [viteSingleFile()],
  base: './', build: { outDir: '../ranking', emptyOutDir: true, target: 'es2020', assetsInlineLimit: 100000000, cssCodeSplit: false, chunkSizeWarningLimit: 4000 },
} as any);
