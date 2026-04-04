import { InjectionToken, Type } from '@angular/core';

export interface NavBadge {
  loadComponent: () => Promise<Type<unknown>>;
  routePath: string;
}

export const NAV_BADGES = new InjectionToken<NavBadge[]>('NAV_BADGES', {
  factory: () => [],
});
