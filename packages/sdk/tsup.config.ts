import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  shims: true,
  minify: false,
  sourcemap: true,
  external: [
    'react',
    'ethers',
    'snarkjs',
    '@lit-protocol/lit-node-client'
  ],
  loader: {
    '.json': 'copy'
  }
});
