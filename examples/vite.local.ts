import { fileURLToPath } from 'node:url';
import type { UserConfig } from 'vite';

// En mode "lib", on remplace le package npm "drawing-drum-machine"
// par les sources de ../lib pour profiter du HMR pendant le développement.
const examplesDir = fileURLToPath(new URL('.', import.meta.url));
const libSrc = fileURLToPath(new URL('../lib/src', import.meta.url));

export function localLib(mode: string): UserConfig {
  if (mode !== 'lib') return {};

  return {
    resolve: {
      alias: { 'drawing-drum-machine': `${libSrc}/index.ts` }
    },
    server: {
      fs: { allow: [examplesDir, libSrc] }
    }
  };
}
