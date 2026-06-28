# Monorepo Refactor Tasks

## Phase 1 — SDK Package
- [x] Create `packages/sdk/package.json`
- [x] Create `packages/sdk/tsconfig.json`
- [x] Create `packages/sdk/tsup.config.ts`
- [x] Create `packages/sdk/src/types.ts`
- [x] Copy `src/utils/biometrics.ts` → `packages/sdk/src/biometrics.ts`
- [x] Copy `src/utils/zkLayer.ts` → `packages/sdk/src/zkLayer.ts`
- [x] Copy `src/utils/storageLayer.ts` → `packages/sdk/src/storageLayer.ts`
- [x] Copy `src/contracts/FaceRegistry.json` → `packages/sdk/src/contracts/FaceRegistry.json`
- [x] Create `packages/sdk/src/client.ts` (PramanClient class)
- [x] Create `packages/sdk/src/index.ts` (barrel exports)
- [x] Implement `DeviceGuard` utility (`packages/sdk/src/device.ts`)
- [x] Implement `LivenessGuard` logic (`packages/sdk/src/liveness.ts`)
- [x] Update SDK Types and Client Configuration (`packages/sdk/src/types.ts` & `client.ts`)
- [x] Integrate virtual camera, liveness, and handover UI in `packages/sdk/src/PramanAuth.tsx`

## Phase 2 — identity-provider App
- [x] Create `apps/identity-provider/package.json`
- [x] Create `apps/identity-provider/tsconfig.json` + `tsconfig.app.json` + `tsconfig.node.json`
- [x] Create `apps/identity-provider/vite.config.ts`
- [x] Create `apps/identity-provider/tailwind.config.js`
- [x] Create `apps/identity-provider/postcss.config.js`
- [x] Create `apps/identity-provider/index.html`
- [x] Copy all `src/` files to `apps/identity-provider/src/` with updated imports
- [x] Symlink/reference `public/` in identity-provider
- [x] Connect `identity-provider` app hook and UI to new SDK features (`apps/identity-provider/src/hooks/usePramanIdentity.ts` & `OnboardingFlow.tsx`)

## Phase 3 — Root Monorepo Wiring
- [x] Update root `package.json` → workspace manifest
- [x] Create `turbo.json`
- [x] Create `.npmrc`

## Phase 4 — Docs + Server
- [x] Create `apps/documentation/README.md`
- [x] Create `server/verify-endpoint/package.json`
- [x] Create `server/verify-endpoint/index.ts`
- [x] Create `server/verify-endpoint/README.md`

## Phase 5 — Install & Verify
- [x] Run `npm install` from root
- [x] Build SDK (`tsup`)
- [x] Run identity-provider dev server
