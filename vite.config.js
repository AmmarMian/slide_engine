import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { glob } from 'node:fs/promises';
import { resolve } from 'node:path';

// Collect all decks/*/index.html as multipage inputs.
async function getDeckInputs() {
  const entries = {};
  for await (const file of glob('decks/*/index.html')) {
    const name = file.split('/')[1]; // decks/<name>/index.html → <name>
    entries[name] = resolve(process.cwd(), file);
  }
  return entries;
}

export default defineConfig(async () => {
  const input = await getDeckInputs();
  const singleFile = !!process.env.SINGLEFILE;

  return {
    server: { port: 5174 },
    plugins: [
      react(),
      ...(singleFile ? [viteSingleFile()] : []),
    ],
    build: {
      rollupOptions: { input },
      // For singlefile mode, inline everything; otherwise allow chunks for multi-deck sharing.
      ...(singleFile
        ? { assetsInlineLimit: 100_000_000, cssCodeSplit: false }
        : {}),
    },
  };
});
