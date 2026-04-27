# NACS Dynamic Shell POC

A build-time white-labeling system for Angular using a single Nx monorepo. Client-specific JSON configs drive which features are included and which version of each feature is loaded — either from local workspace source or from a private npm registry.

## Vision & Problem Statement

Most enterprise Angular applications pay a "Hidden Architectural Tax". They wait until runtime—in the user's browser—to decide which features to load, leading to bundle bloat, fragile runtime errors, and invisible complexity.

NACS (Nx Angular Composable Shell) is built on the premise of "Pushing Decisions Left". By moving composition logic out of the browser and back into the compiler, we create hermetically sealed, client-specific artifacts that contain exactly what the user is licensed for—and nothing more.

This project is built around three core tenets:

- **Simplicity** — Move complexity from the browser to the build pipeline. Declarative JSON configurations provide a single, reviewable, and type-safe source of truth for application composition.
- **Reuse** — Treat features as independently versioned contracts. Product teams contribute features through well-defined extension interfaces, allowing multiple versions of the same feature to exist in production simultaneously for different clients.
- **Decoupling** — The shell does not know what it could contain; it only knows what it does contain. This separation enables aggressive tree-shaking and physical security guarantees against code leakage.

## Disclaimer

This repository is a Proof of Concept (POC), not a production-ready framework. It demonstrates architectural patterns such as build-time route generation, generated composition code, and strict dependency governance, but it is intentionally experimental.

## Accompanying Article Series

This repo is paired with a LinkedIn article series. The five-part series will be linked here as each part is published.

1. [NACS Part 1: The Hidden Architectural Tax — Why Build-Time Composition Wins](https://www.linkedin.com/pulse/nacs-part-1-hidden-architectural-tax-why-build-time-composition-kemp-gzuhc/)
2. [NACS Part 2: One Config File. One Client. Zero Leaked Features](https://www.linkedin.com/pulse/nacs-part-2-one-config-file-client-zero-leaked-features-andrew-kemp-qmfec)
3. [NACS Part 3: A Platform Nobody Uses Is Just a Tax](https://www.linkedin.com/pulse/nacs-part-3-platform-nobody-uses-just-tax-andrew-kemp-w4sjc/)
4. [NACS Part 4: The Shell That Doesn't Know What It Contains](https://www.linkedin.com/pulse/nacs-part-4-shell-doesnt-know-what-contains-andrew-kemp-g7g3c/)
5. NACS Part 5: You Aren't Building a Tool. You're Building a Platform

## How It Works

NACS transforms your monorepo from a collection of libraries into a governed, scalable platform. The process "pushes decisions left" through the following steps:

1. A **client config JSON** (`configs/*.json`) declares which feature libraries to include and optionally pins each to a specific published version.
2. A **pre-build script** reads the config, installs any versioned packages as npm aliases, then **discovers** each library's routing metadata and slot contributions from the library's own `package.json` (`nacs-contributions` field).
3. The script generates `apps/shell/src/app/app.composition.generated.ts` — a single file containing both the top-level feature routes (`generatedRoutes`) and any extension point arrays (e.g. `extAdmin`).
4. **Angular/esbuild** compiles the shell. Any feature not referenced in the generated routes file is fully tree-shaken from the output bundle. The result is a custom-tailored, client-specific production bundle.

---

## First-Time Setup

After cloning, run:

```sh
npm install
npm run setup
```

`npm run setup` does two things:

1. **Registers the git hooks** (`git config core.hooksPath .githooks`) so that `post-merge` and `post-checkout` keep generated files in sync automatically.
2. **Runs `nx sync`** to generate any files that are not committed to the repo (see [Generated Files](#generated-files) below).

> These steps are intentionally separate from `npm install` so they are not silently run in CI environments.

---

## Generated Files

Two files are auto-generated and **not committed to the repository**:

| File                                              | Generator                    | When to regenerate                                                                      |
| ------------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------- |
| `apps/shell/src/app/app.composition.generated.ts` | `nx run shell:prepare-build` | After changing `configs/*.json` or a feature's `nacs-contributions`                     |
| `libs/build-tools/nacs-package.schema.json`       | `nx sync`                    | After adding or modifying an `extensionPoints` declaration in any `libs/*/package.json` |

The git hooks installed by `npm run setup` regenerate these files automatically on `git pull` and `git checkout`. CI enforces freshness via `nx sync:check`.

---

## Running the App

### Local Development

Uses `configs/client-dev.json`. No npm installs — imports come directly from local workspace source.

```sh
npx nx run shell:serve:dev
```

### Production Build

Targets a specific client config by name. Versioned features are fetched from the registry and installed as npm aliases before the Angular build runs.

```sh
npx nx run shell:build:production --client=client-prod-v1
```

Replace `client-prod-v1` with any filename (without `.json`) from the `configs/` directory.

### Serving a Production Build

After a production build, serve the output with:

```sh
npx http-server-spa dist/apps/shell/browser
```

---

## Client Configuration Files

Configs live in `configs/` and follow the schema defined in `configs/client-config.schema.json`.

**Example — local dev (`configs/client-dev.json`):**

```json
{
  "$schema": "./client-config.schema.json",
  "clientId": "dev",
  "features": [{ "module": "@nacs/feature-dashboard" }, { "module": "@nacs/feature-a" }, { "module": "@nacs/feature-b" }, { "module": "@nacs/feature-telemetry" }]
}
```

`@nacs/feature-telemetry` is a **headless feature** — it has no primary route, so it never appears in the sidebar. It contributes silently to the dashboard widget slot and lifecycle hook handlers. See [Headless features](#headless-features) below.

**Example — production with pinned versions, a nav override, and a default route:**

```json
{
  "$schema": "./client-config.schema.json",
  "clientId": "client-prod-v1",
  "defaultRoute": "@nacs/feature-a",
  "features": [
    { "module": "@nacs/feature-dashboard", "version": "1.0.0", "overrides": { "title": "Home", "icon": "🏠" } },
    { "module": "@nacs/feature-a", "version": "1.0.0" }
  ]
}
```

Routing metadata (path, export name, nav title, icon) is **not declared in the config**. It is discovered from the feature library's own `package.json` at build time — see [Feature Contributions & Extensions](#feature-contributions--extensions) below.

### Config fields

| Field          | Required | Description                                                                                                       |
| -------------- | -------- | ----------------------------------------------------------------------------------------------------------------- |
| `clientId`     | Yes      | Unique identifier for this client configuration.                                                                  |
| `features`     | Yes      | Ordered list of feature modules to include. The first entry is the default redirect unless `defaultRoute` is set. |
| `defaultRoute` | No       | Module name (must match a `features[].module` value) whose route is the default redirect.                         |

### Feature fields

| Field       | Required | Description                                                                                 |
| ----------- | -------- | ------------------------------------------------------------------------------------------- |
| `module`    | Yes      | npm package name for the feature library.                                                   |
| `version`   | No       | Pins to a specific published version from the registry. Omit to use local workspace source. |
| `overrides` | No       | Optionally override `title` or `icon` discovered from the library for this client only.     |

To add a new client environment, create a new `configs/<client-name>.json` file referencing the schema and run:

```sh
npx nx run shell:build:production --client=<client-name>
```

---

## Feature Contributions & Extensions

Each feature library is **self-describing**. Instead of declaring routing metadata in the client config, the library publishes it in its own `package.json` under the `nacs-contributions` field. The pre-build script reads this field after installing the package (for versioned features) or directly from the workspace source (for local features).

### `nacs-contributions` structure

```json
{
  "nacs-contributions": {
    "primary": {
      "path": "feature-a",
      "exportName": "featureARoutes",
      "title": "Feature A",
      "icon": "📊"
    },
    "extensions": {
      "admin": [
        {
          "path": "feature-a-settings",
          "exportName": "featureAAdminRoutes",
          "title": "Feature A Settings",
          "icon": "⚙️"
        }
      ]
    }
  }
}
```

| Field                | Required | Description                                                                                                                  |
| -------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `primary`            | No       | The top-level route this feature registers in the shell navigation. Omit to create a [headless feature](#headless-features). |
| `primary.path`       | —        | Angular router path segment (lowercase, hyphens only)                                                                        |
| `primary.exportName` | —        | Named export from the library's public API containing the `Routes` array                                                     |
| `primary.title`      | —        | Label shown in the navigation sidebar                                                                                        |
| `primary.icon`       | —        | Emoji or icon identifier for the nav item                                                                                    |
| `extensions`         | No       | Map of extension points this feature contributes to                                                                          |
| `extensions.admin`   | —        | Contributes a child route to the built-in Administration panel                                                               |

> Sub-fields marked `—` are required when their parent field is present.

### Headless features

A **headless feature** (also called a _ghost feature_) is a feature library that omits the `primary` field from its `nacs-contributions`. It has no route, no navigation entry, and no URL of its own. It exists purely to contribute to extension points declared by other libraries.

```json
{
  "nacs-contributions": {
    "extensions": {
      "dashboard-widget": [{ "exportName": "TelemetryWidget", "title": "Platform Telemetry", "icon": "📡" }],
      "lifecycle:user.logout": [{ "exportName": "telemetryLogoutHandler" }],
      "lifecycle:session.expired": [{ "exportName": "telemetrySessionExpiredHandler" }]
    }
  }
}
```

The key properties of headless features:

- **No nav entry** — the sidebar is unchanged whether the feature is present or absent.
- **Silent removal** — dropping the feature from a client config removes all its contributions (widgets, handlers, etc.) with zero code changes.
- **Full governance** — peer dependency checks still apply; headless features are not exempt.

> **Note:** A client config where _all_ features are headless is a build error. At least one feature must declare a primary route to generate valid navigation.

### Extension point types

Extension points are declared by **consumer** libs (e.g. `core-admin`, `feature-dashboard`, `shell-nav`, `shell-lifecycle`) via `nacs-contributions.extensionPoints` in their `package.json`. Each extension point has an `itemType` that controls how `prepare-build` generates code for that slot.

| `itemType`       | Import emitted                                | DI provider pattern                                                      | Status         | Example use cases                                                                                         |
| ---------------- | --------------------------------------------- | ------------------------------------------------------------------------ | -------------- | --------------------------------------------------------------------------------------------------------- |
| `route`          | None — lazy `loadChildren` lambda             | None (consumed directly by router)                                       | ✅ Implemented | Admin panel tabs, user settings sections, onboarding wizard steps                                         |
| `component`      | Static class import                           | `{ provide: TOKEN, useValue: [...] }`                                    | ✅ Implemented | Dashboard widgets, sidebar nav badges, contextual help panels                                             |
| `lazy-component` | Dynamic `import()` factory (no static import) | `{ provide: TOKEN, useValue: [{ load: () => import(...) }] }`            | ✅ Implemented | Heavy chart/editor widgets, map views — split into their own chunk even when the feature is in config     |
| `lifecycle-hook` | Static function import                        | `{ provide: TOKEN, useValue: fn, multi: true }` per contributor          | ✅ Implemented | Logout cleanup, session expiry handling, tenant switch teardown                                           |
| `multi-provider` | Static class import                           | `{ provide: TOKEN, useClass: X, multi: true }` per contributor           | 🔲 Planned     | Global search providers, telemetry adapters, notification handlers                                        |
| `value`          | **None** — data inlined from `package.json`   | `{ provide: TOKEN, useValue: [...] }`                                    | ✅ Implemented | Help topic registrations, permission/capability declarations, i18n namespace registrations, feature flags |
| `initializer`    | Static function import                        | `{ provide: APP_INITIALIZER, useFactory: fn, deps: [...], multi: true }` | ✅ Implemented | Pre-fetch feature config, register service workers, warm caches before app renders                        |

**Key distinction between `component` and `multi-provider`:** `component` contributions are plain objects in an array — the shell renders them but they cannot inject other services themselves. `multi-provider` contributions are DI-resolved class instances, enabling each contributor to declare its own `deps` and participate fully in Angular's dependency injection graph.

**Key distinction between `lifecycle-hook` and `multi-provider`:** `lifecycle-hook` handlers are stateless functions — they cannot inject services themselves. They are called imperatively by a dispatcher at a named moment in application time (e.g. logout, session expiry). Use `lifecycle-hook` for fire-and-forget cleanup; use `multi-provider` (see above) when the handler needs its own dependencies.

### How Extension Point Discovery Works

When the pre-build script runs, it:

1. Resolves each feature's `package.json` (from `node_modules` for versioned installs, from the workspace source for local)
2. Enforces peer dependency governance on every feature, including headless ones
3. Reads `nacs-contributions.primary` (if present) to generate the top-level `generatedRoutes` array — features without `primary` are skipped for route generation
4. Reads `nacs-contributions.extensions.*` from **all** features (including headless ones) to generate extension point arrays (e.g. `extDashboardWidget`) and `multi: true` providers (e.g. lifecycle-hook handlers)

All generated code is written into a single file: `apps/shell/src/app/app.composition.generated.ts`.

The shell's `app.routes.ts` imports route arrays and passes them to factory functions at composition time. The shell's `app.config.ts` spreads `generatedProviders` — which includes component/lazy-component token bindings, lifecycle-hook `multi: true` handler registrations, and `APP_INITIALIZER` factory registrations — into the application providers.

### Adding an Admin Extension to a Feature

**Step 1 — Create an admin component and route export in the feature library:**

```
libs/my-feature/src/lib/my-feature-admin/my-feature-admin.ts   ← standalone component
libs/my-feature/src/lib/my-feature-admin.routes.ts              ← routes export
```

`my-feature-admin.routes.ts`:

```typescript
import { Route } from '@angular/router';
import { MyFeatureAdmin } from './my-feature-admin/my-feature-admin';

export const myFeatureAdminRoutes: Route[] = [{ path: '', component: MyFeatureAdmin }];
```

**Step 2 — Re-export from the library's public API (`src/index.ts`):**

```typescript
export * from './lib/my-feature-admin.routes';
```

**Step 3 — Declare the extension in the library's `package.json`:**

```json
{
  "nacs-contributions": {
    "primary": { ... },
    "extensions": {
      "admin": [
        {
          "path": "my-feature-settings",
          "exportName": "myFeatureAdminRoutes",
          "title": "My Feature Settings",
          "icon": "⚙️"
        }
      ]
    }
  }
}
```

**Step 4 — Run `prepare-build`:**

```sh
npx nx run shell:prepare-build
```

The admin tab will appear automatically in the Administration panel for any client config that includes this feature. Features that declare no `extensions.admin` entry contribute nothing to the admin panel — omission is the opt-out.

### Adding a Value Contribution to a Feature

Value contributions let features publish **static, structured data** declared entirely in `package.json` — no TypeScript code, no imports, and zero coupling between the contributing feature and the consuming library. The build-tools pipeline reads the JSON at build time, inlines it into the generated composition file as a typed array, and binds it to a DI token via `generatedProviders`. The consuming library injects the token to access all contributed data at runtime.

**Step 1 — The consumer library declares the extension point and token:**

`libs/shell-help/package.json`:

```json
{
  "name": "@nacs/shell-help",
  "nacs-contributions": {
    "extensionPoints": {
      "help-topic": {
        "itemType": "value",
        "tokenExportName": "HELP_TOPICS"
      }
    }
  }
}
```

The consumer lib also defines and exports the token and the item interface:

```typescript
// libs/shell-help/src/lib/help-topics.token.ts
export interface HelpTopic {
  id: string;
  title: string;
  summary: string;
  category: string;
  icon?: string;
  docUrl?: string;
}

export const HELP_TOPICS = new InjectionToken<HelpTopic[]>('HELP_TOPICS', {
  factory: () => [],
});
```

**Step 2 — Feature libraries contribute data in their `package.json`:**

No TypeScript changes are required in the contributing feature. Add the data array under `nacs-contributions.extensions.<point-name>`:

`libs/feature-a/package.json`:

```json
{
  "nacs-contributions": {
    "primary": { ... },
    "extensions": {
      "help-topic": [
        {
          "id": "feature-a-overview",
          "title": "Analytics Overview",
          "summary": "Track record processing and sync status across all data pipelines.",
          "category": "Analytics",
          "icon": "📊"
        }
      ]
    }
  }
}
```

**Step 3 — Run `prepare-build`:**

```sh
npx nx run shell:prepare-build
```

The generated file will contain the inlined array bound to the token:

```typescript
import { HELP_TOPICS } from '@nacs/shell-help';

export const extHelpTopic = [
  { id: 'feature-a-overview', title: 'Analytics Overview', ... },
];

export const generatedProviders: Provider[] = [
  // ...
  { provide: HELP_TOPICS, useValue: extHelpTopic },
];
```

When a feature is removed from a client config, its contributed items disappear automatically on the next `prepare-build` — no code changes required anywhere.

### Adding a Lifecycle Hook to a Feature

Lifecycle hooks let features respond to application-level events (e.g. `user.logout`, `session.expired`) without importing anything from `@nacs/shell-lifecycle`. The feature exports a plain stateless function; `prepare-build` wires it into the dispatcher via `multi: true` DI providers at build time. If the feature is absent from a client config, its handler is fully tree-shaken.

See [`libs/shell-lifecycle/README.md`](libs/shell-lifecycle/README.md) for the full how-to, available events, and guidance on when to use a lifecycle hook versus a `multi-provider` contribution.

### Adding an Initializer to a Feature

Initializers let features run asynchronous startup logic before the Angular application fully bootstraps — pre-fetching remote config, registering service workers, warming caches, or seeding local storage. The feature exports a plain async function; `prepare-build` wires it into Angular's `provideAppInitializer()` at build time. Angular awaits all registered initializers before rendering the first view.

Because `provideAppInitializer()` runs its function in an **injection context**, the function can call `inject()` directly inside its body — no `deps` array is needed.

> **Built-in slot** — the `nacs:app-initializer` extension point is automatically registered by `prepare-build` on every build. No consumer library needs to declare it. Any feature that wants to run startup logic simply contributes to this canonical key.

**Step 1 — Export the initializer function from the feature library:**

`libs/my-feature/src/lib/my-feature.initializer.ts`:

```typescript
import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export function myFeatureInitializer(): Promise<void> {
  const http = inject(HttpClient); // inject() works here — runs in injection context
  return firstValueFrom(http.get<void>('/api/my-feature/config'));
}
```

For a zero-dependency initializer, omit `inject()` and return a resolved promise:

```typescript
export function myFeatureInitializer(): Promise<void> {
  return Promise.resolve();
}
```

Re-export from the library's public API (`src/index.ts`):

```typescript
export * from './lib/my-feature.initializer';
```

**Step 2 — Declare the contribution in the feature's `package.json`:**

Contribute to the built-in `nacs:app-initializer` key. Only `exportName` is required — there is no `deps` field.

```json
{
  "nacs-contributions": {
    "primary": { ... },
    "extensions": {
      "nacs:app-initializer": [
        {
          "exportName": "myFeatureInitializer"
        }
      ]
    }
  }
}
```

**Step 3 — Run `prepare-build`:**

```sh
npx nx run shell:prepare-build
```

The generated file will contain a static import of the function and a `provideAppInitializer()` call in `generatedProviders`:

```typescript
import { type Provider, type EnvironmentProviders, provideAppInitializer } from '@angular/core';
import { myFeatureInitializer } from '@nacs/my-feature';

export const generatedProviders: (Provider | EnvironmentProviders)[] = [
  // ...
  provideAppInitializer(myFeatureInitializer),
];
```

When a feature is removed from a client config, its initializer disappears automatically on the next `prepare-build` — no code changes required anywhere.

---

## Platform Governance

To ensure each client build is a hermetically sealed artifact, the pre-build engine enforces strict governance. When a feature is loaded from the registry by version, the script enforces that the feature's `peerDependencies` are satisfied by the shell's installed dependencies.

This prevents "Module Federation version mismatch" errors by catching framework or library version mismatches (e.g. an Angular 18 feature in an Angular 21 shell) before a bad build ever reaches your deployment pipeline.

The enforced peers are: `@angular/core`, `@angular/common`, `@angular/router`, `rxjs`.

If a violation is detected, the build fails immediately with a clear message:

```
❌ STRICT GOVERNANCE FAILURE: Version mismatch in @nacs/feature-a@1.0.0
The shell's core dependencies do not satisfy the feature's peer requirements:
  - @angular/core: Feature requires '>=18 <19', Shell provides '~21.2.0'
Resolution: Update the client config to a newer feature version, or recompile the feature.
```

Local workspace features (no `version` field) are not checked — they share the workspace's `node_modules` directly and are always in sync.

---

## Library Lifecycle & Distribution

This project treats each feature library as an independently versioned contract. This allows client configurations to pin a specific feature package version while the shell and other libraries continue to evolve separately.

### Versioning & Contracts

Feature libraries utilize `nx release` for independent semver versioning. This process updates the library's `package.json` and creates matching git tags, ensuring that every published version is a stable, referenceable artifact.

### Distribution

Once feature packages are published to a private registry (such as Nexus or Artifactory), the shell resolves them based on the client configuration:

- **Development:** Features are resolved directly from local workspace source for instant hot-reloading.
- **Production:** Specific versions are resolved as versioned npm packages via npm aliasing, ensuring that Client A physically cannot download Client B's feature code.
