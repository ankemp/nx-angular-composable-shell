import { inject, Injectable, Injector } from '@angular/core';
import {
  LIFECYCLE_EVENT_TOKENS,
  type LifecycleEvent,
  type LifecycleHandler,
} from './lifecycle.tokens';

@Injectable({ providedIn: 'root' })
export class LifecycleDispatcher {
  private injector = inject(Injector);

  async dispatch(event: LifecycleEvent): Promise<void> {
    const token = LIFECYCLE_EVENT_TOKENS[event];
    const handlers = this.injector.get<LifecycleHandler[]>(token, []);
    // Handlers are intentionally called as plain functions — no injection context.
    // If a future handler needs to call inject() for Angular services, wrap each
    // invocation with runInInjectionContext:
    //
    //   import { runInInjectionContext } from '@angular/core';
    //   handlers.map((h) => Promise.resolve(runInInjectionContext(this.injector, h)))
    //
    // Trade-off: this enables DI in handlers but blurs the boundary with the planned
    // multi-provider extension type. Handlers that need injected dependencies are a
    // signal they should be multi-provider contributions instead.
    await Promise.all(handlers.map((h) => Promise.resolve(h())));
  }
}
