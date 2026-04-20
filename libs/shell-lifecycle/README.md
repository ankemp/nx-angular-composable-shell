# @nacs/shell-lifecycle

Provides the typed event-dispatch infrastructure for application-level lifecycle events (e.g. user logout, session expiry). Feature libraries contribute stateless handler functions that the build pipeline wires in via `multi: true` DI providers — no direct dependency on this library required from the feature side.

## Why lifecycle hooks?

Features sometimes need to react to application-level events like user logout or session expiry — clearing caches, resetting state, cancelling in-flight requests. The naive approach couples every feature directly to the shell, creating a web of imports that defeats tree-shaking and makes the shell aware of everything it contains.

Lifecycle hooks break that coupling. A feature exports a plain function. The build pipeline (`prepare-build`) reads the feature's `nacs-contributions` and generates the DI wiring at build time. The shell dispatches the event; the right handlers run. If the feature isn't in the client config, its handler is never imported and is fully tree-shaken.

## API

### `LifecycleDispatcher`

An `Injectable({ providedIn: 'root' })` service. Inject it wherever the shell needs to signal a lifecycle event.

```typescript
import { LifecycleDispatcher } from '@nacs/shell-lifecycle';

// Inside a shell service or guard:
await this.lifecycleDispatcher.dispatch('user.logout');
```

`dispatch(event: LifecycleEvent)` is fully typed — `LifecycleEvent` is derived from the `LIFECYCLE_EVENT_TOKENS` map, so passing an invalid event name is a compile-time error.

### Available events

| Event name        | Token exported             | Triggered when                  |
| ----------------- | -------------------------- | ------------------------------- |
| `user.logout`     | `LOGOUT_HANDLERS`          | User explicitly logs out        |
| `session.expired` | `SESSION_EXPIRED_HANDLERS` | Auth token expires / is revoked |

To add a new event, add an entry to `LIFECYCLE_EVENT_TOKENS` in `lifecycle.tokens.ts` and export the new token from `src/index.ts`.

## Adding a lifecycle hook to a feature

Feature handlers are **stateless functions** — they do not import or inject anything from `@nacs/shell-lifecycle`. The build pipeline handles the wiring.

**Step 1 — Create a handler function in the feature library:**

```
libs/my-feature/src/lib/lifecycle/my-feature-logout.handler.ts
```

```typescript
export async function myFeatureLogoutHandler(): Promise<void> {
  sessionStorage.removeItem('my-feature-cache');
}
```

No imports from `@nacs/shell-lifecycle` — the function is a standalone export.

**Step 2 — Re-export from the library's public API (`src/index.ts`):**

```typescript
export * from './lib/lifecycle/my-feature-logout.handler';
```

**Step 3 — Declare the extension in the library's `package.json`:**

```json
{
  "nacs-contributions": {
    "primary": { "...": "..." },
    "extensions": {
      "lifecycle:user.logout": [{ "exportName": "myFeatureLogoutHandler" }]
    }
  }
}
```

Lifecycle-hook items only require `exportName` — no `title`, `icon`, or `path` needed.

**Step 4 — Run `prepare-build`:**

```sh
npx nx run shell:prepare-build
```

The generated composition file will include:

```typescript
import { LOGOUT_HANDLERS } from '@nacs/shell-lifecycle';
import { myFeatureLogoutHandler } from '@nacs/my-feature';

export const generatedProviders: Provider[] = [{ provide: LOGOUT_HANDLERS, useValue: myFeatureLogoutHandler, multi: true }];
```

If the feature is absent from a client config, its handler is never imported and is fully tree-shaken from the bundle.

## Lifecycle hook vs. multi-provider

Use a lifecycle hook when the handler is **stateless** — fire-and-forget cleanup that needs no injected services. Use a `multi-provider` contribution (planned) when the handler needs its own Angular dependencies. Handlers that call `inject()` are a signal they've outgrown the lifecycle-hook pattern.
