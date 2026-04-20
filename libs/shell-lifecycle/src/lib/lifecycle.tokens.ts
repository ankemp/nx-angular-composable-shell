import { InjectionToken } from '@angular/core';

export type LifecycleHandler = () => void | Promise<void>;

export const LOGOUT_HANDLERS = new InjectionToken<LifecycleHandler[]>(
  'LOGOUT_HANDLERS',
  { factory: () => [] },
);

export const SESSION_EXPIRED_HANDLERS = new InjectionToken<LifecycleHandler[]>(
  'SESSION_EXPIRED_HANDLERS',
  {
    factory: () => [],
  },
);

// Single source of truth: event name → token.
// LifecycleEvent is derived — never needs to be updated separately.
export const LIFECYCLE_EVENT_TOKENS = {
  'user.logout': LOGOUT_HANDLERS,
  'session.expired': SESSION_EXPIRED_HANDLERS,
} as const;

export type LifecycleEvent = keyof typeof LIFECYCLE_EVENT_TOKENS;
