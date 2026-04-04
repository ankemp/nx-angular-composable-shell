# The Definitive Guide: Nx Angular Build-Time White-Labeling & Versioning (Production Parity Edition)

## Architectural Overview

This POC demonstrates how to maintain a single monorepo while deploying highly customized, version-locked Angular applications to different clients.

1. **The Source of Truth:** Client-specific JSON files dictate which features and versions a client receives.
2. **The Registry & Release:** Features are published to a private registry (Verdaccio, simulating Nexus) using native `nx release` commands and `.npmrc` routing.
3. **The Pre-Build Engine:** A Node.js script reads the JSON config. For versioned features, it dynamically installs them into `node_modules` under an **alias**. For unversioned features, it relies on local workspace code. It then writes an `app.composition.generated.ts` file.
4. **The Build:** Angular compiles the shell using `esbuild`. The compiler natively tree-shakes any feature not included in the generated route file, guaranteeing dead-code elimination.

---

## Phase 1: Workspace & Library Setup

First, scaffold the integrated monorepo and create the feature libraries explicitly in the `libs/` directory.

1. **Initialize the Monorepo:**
   ```bash
   npx create-nx-workspace@latest nx-angular-composeable-shell --preset=angular-monorepo --appName=shell --standaloneApi
   ```
2. **Navigate into the workspace:**
   ```bash
   cd nx-angular-composeable-shell
   ```
3. **Generate Publishable Features:**

   ```bash
   npx nx g @nx/angular:lib --name=feature-a --directory=libs/feature-a --routing --standalone --publishable --importPath="@nacs/feature-a"

   npx nx g @nx/angular:lib --name=feature-b --directory=libs/feature-b --routing --standalone --publishable --importPath="@nacs/feature-b"

   npx nx g @nx/angular:lib --name=feature-dashboard --directory=libs/feature-dashboard --routing --standalone --publishable --importPath="@nacs/feature-dashboard"
   ```

4. **Add Identifiable UI:**
   Open `libs/feature-a/src/lib/feature-a/feature-a.component.ts` (and B). Add a distinct background color and hardcoded text like _"Feature A - Version 1"_. Export these component routes in the libraries' `index.ts`.

---

## Phase 2: Production Parity Registry Setup (Nexus Simulation)

You will use Verdaccio to simulate Nexus and configure Nx to publish to it automatically.

1. **Configure the Registry Route (`.npmrc`):**
   Create a `.npmrc` file at the root of your workspace. This tells all npm and Nx commands to route packages with the `@nacs` scope to your local registry instead of the public internet. _(In production, you'll change this URL to your real Nexus)._

   ```text
   @nacs:registry=http://localhost:4873/
   ```

2. **Configure Nx Release (`nx.json`):**
   Open your root `nx.json` and add the release configuration block so Nx knows to version and publish these libraries independently.

   ```json
   {
     // ... rest of nx.json
     "release": {
       "projects": ["feature-a", "feature-b"],
       "projectsRelationship": "independent"
     }
   }
   ```

3. **Start the Registry:** In a separate terminal, run `npx nx local-registry`. Leave this running.

4. **Publish Version 1.0.0:**
   Commit your current code to Git (Nx Release requires a clean working tree). Then, run the native release command:

   ```bash
   npx nx release --first-release
   ```

   _Nx will automatically version `feature-a` and `feature-b` to `0.0.0` or `1.0.0` (depending on config), run the builds, and publish them to Verdaccio._ Take note of the exact version number it outputs.

5. **Advance the Codebase to V2:**
   Go back to your source code in `libs/feature-a/src/...`. Change the text to _"Feature A - Mainline / Version 2"_ and change the color. **Do not publish this.** This represents your active, unreleased work.

---

## Phase 3: Client Configurations

Create a `configs/` folder at the root of your workspace to hold the JSON manifests.

**`configs/client-dev.json`** (Local Dev: No versions, uses local source)

```json
{
  "clientId": "client-dev",
  "features": [
    { "path": "feature-a", "module": "@nacs/feature-a", "exportName": "featureARoutes", "title": "Dashboard", "icon": "home" },
    { "path": "feature-b", "module": "@nacs/feature-b", "exportName": "featureBRoutes", "title": "Reports", "icon": "chart" }
  ]
}
```

**`configs/client-prod-v1.json`** (Prod App: Forces V1 from the registry)
_(Note: Ensure the `"version"` matches whatever `nx release --first-release` outputted)._

```json
{
  "clientId": "client-prod-v1",
  "features": [{ "path": "feature-a", "module": "@nacs/feature-a", "version": "1.0.0", "exportName": "featureARoutes", "title": "Dashboard", "icon": "home" }]
}
```

---

## Phase 4: The Pre-Build Engine (`libs/build-tools`)

The pre-build logic lives in `libs/build-tools` — an internal Nx library that exposes a custom Nx executor (`@nacs/build-tools:prepare-build`). It reads the client JSON config, performs npm aliasing for versioned features, and generates `app.composition.generated.ts` using a TypeScript AST (ts-morph) rather than string concatenation.

The library is split into focused modules:

```
libs/build-tools/
  src/
    lib/
      schemas.ts        — Zod schemas + validation for package.json, client config, tsconfig
      resolve.ts        — Resolves a feature module's package.json from tsconfig paths or node_modules
      emit.ts           — ts-morph AST emission of app.composition.generated.ts
      prepare-build.ts  — Orchestration: reads config, discovers extension points, calls emit
    executors/
      prepare-build/
        executor.ts     — Nx executor entry point
        schema.json     — { "client": { "type": "string", "default": "client-dev" } }
  executors.json        — Registers the executor under @nacs/build-tools
  package.json          — { "name": "@nacs/build-tools", "executors": "./executors.json" }
```

The executor is wired into `apps/shell/project.json`:

```json
"prepare-build": {
  "executor": "@nacs/build-tools:prepare-build",
  "inputs": [
    "{workspaceRoot}/configs/*.json",
    "{workspaceRoot}/libs/build-tools/src/**/*.ts"
  ],
  "outputs": [
    "{workspaceRoot}/apps/shell/src/app/app.composition.generated.ts"
  ],
  "options": { "client": "client-dev" }
}
```

This gives full Nx caching: the executor only re-runs when the client configs or the build-tools source changes.

_Note: Add `apps/shell/src/app/app.composition.generated.ts` to your `.gitignore`._

---

## Phase 5: Shell Application Architecture

Wire up the shell to consume the generated routes and power the UI.

**1. The Main Routing File** (`apps/shell/src/app/app.routes.ts`):

```typescript
import { Route } from '@angular/router';
import { generatedRoutes } from './app.composition.generated';
import { ShellLayoutComponent } from './layout/shell-layout.component';

export const appRoutes: Route[] = [
  {
    path: '',
    component: ShellLayoutComponent,
    children: [...generatedRoutes],
  },
];
```

**2. The Dynamic Sidebar** (`apps/shell/src/app/layout/sidebar.ts`):

---

## Phase 6: Orchestration & Execution

Use Nx project targets with `dependsOn` so `prepare-build` always runs before the associated command. The `prepare-build` target in `apps/shell/project.json` accepts named configurations that map to the correct client JSON, and `build`/`serve` declare it as a dependency via `dependsOn`.

Run the demos with:

```bash
# Local dev — hardcoded to client-dev.json, no args needed
nx run shell:serve:dev

# Prod versioned build — pass the client config name as an argument
nx run shell:build:production --client=client-prod-v1
```

For `serve:dev`, Nx automatically runs `shell:prepare-build:dev` first (hardcoded via `dependsOn`).

For production builds, `prepare-build` uses `{args.client}` interpolation. Nx forwards `--client` from the `build` target to `prepare-build` via `"params": "forward"` in `dependsOn`, so you can target any client config by name without adding a new configuration entry:

```bash
nx run shell:build:production --client=client-prod-v2
nx run shell:build:production --client=client-acme
```

### The Demonstration Steps

1. **Show Local Dev DX:** Run `npx nx run shell:serve:dev`. The script skips NPM, generates local workspace imports, and serves the app. The UI will show your "Mainline / Version 2" code. Demonstrate that editing the local code triggers instant hot-reloading.
2. **Show Strict Versioning & Tree Shaking:** Run `npx nx run shell:build-client --client=client-prod-v1`. Watch the terminal—NPM will actively download the alias from Verdaccio (simulating Nexus). Serve the resulting `dist/apps/shell` folder (e.g., `npx http-server-spa dist/apps/shell/browser`).
3. **The Proof:** The UI will now show your "Version 1" code, proving it pulled from the registry. Furthermore, because Feature B was not in `client-prod-v1.json`, show the team that Feature B is completely missing from the generated routing file and physically absent from the compiled `dist` chunks.
