import { Route } from '@angular/router';

import { generatedRoutes, extAdmin } from './app.composition.generated';

const coreRoutes: Route[] = [
  {
    path: 'admin',
    loadChildren: () =>
      import('@nacs/core-admin').then((m) => m.coreAdminRoutes(extAdmin)),
    data: { title: 'Admin', excludeFromMenu: true },
  },
];

export const appRoutes: Route[] = [...coreRoutes, ...generatedRoutes];
