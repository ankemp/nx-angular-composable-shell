import { InjectionToken, Type } from '@angular/core';

export interface DashboardWidget {
  loadComponent: () => Promise<Type<unknown>>;
}

export const DASHBOARD_WIDGETS = new InjectionToken<DashboardWidget[]>(
  'DASHBOARD_WIDGETS',
  { factory: () => [] },
);
