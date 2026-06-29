import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  shims: true, // Shims wapas true kar do
  minify: false,
  sourcemap: true,
  noExternal: ['tslib'], 
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