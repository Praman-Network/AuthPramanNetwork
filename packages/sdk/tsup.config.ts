import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  shims: true,
  minify: false,
  sourcemap: true,
  // Fix: Bundling tslib inside so it doesn't try to require() it
  noExternal: ['tslib'], 
  // Fix: Better CJS interop
  cjsInterop: true, 
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