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
  const allInputs  = await getDeckInputs();
  const singleFile = !!process.env.SINGLEFILE;

  // Single-file mode requires exactly one Rollup entry; pick the requested deck or the first one.
  let input = allInputs;
  if (singleFile) {
    const deckName = process.env.DECK || Object.keys(allInputs)[0];
    if (!allInputs[deckName]) throw new Error(`build:single — deck "${deckName}" not found. Available: ${Object.keys(allInputs).join(', ')}`);
    input = { [deckName]: allInputs[deckName] };
  }

  return {
    server: { port: 5174 },
    plugins: [
      react(),
      ...(singleFile ? [viteSingleFile()] : []),
    ],
    build: {
      rollupOptions: { input },
      ...(singleFile
        ? { assetsInlineLimit: 100_000_000, cssCodeSplit: false }
        : {}),
    },
  };
});
