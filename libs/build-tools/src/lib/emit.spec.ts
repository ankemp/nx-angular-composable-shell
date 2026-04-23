import * as fs from 'fs';
import { emitComposition } from './emit';
import type {
  ResolvedPrimaryFeature,
  CollectedExtPoint,
  RouteExtPoint,
  ComponentExtPoint,
  LazyComponentExtPoint,
  LifecycleHookExtPoint,
  ValueExtPoint,
} from './schemas';

jest.mock('fs');
const mockFs = jest.mocked(fs);

let writtenContent = '';

beforeEach(() => {
  jest.clearAllMocks();
  writtenContent = '';
  mockFs.writeFileSync.mockImplementation((_path, data) => {
    writtenContent = data as string;
  });
});

const basePrimaryFeatures: ResolvedPrimaryFeature[] = [
  {
    importPath: '@nacs/feature-a',
    primary: {
      path: 'feature-a',
      exportName: 'featureARoutes',
      title: 'Feature A',
      icon: 'home',
    },
  },
  {
    importPath: '@nacs/feature-b',
    primary: {
      path: 'feature-b',
      exportName: 'featureBRoutes',
      title: 'Feature B',
      icon: 'star',
    },
  },
];

describe('emitComposition', () => {
  describe('banner and framework imports', () => {
    it('writes auto-generated banner comment', () => {
      emitComposition(basePrimaryFeatures, [], '/out/comp.ts');
      expect(writtenContent).toMatch(/^\/\/ AUTO-GENERATED FILE/);
    });

    it('imports Routes from @angular/router', () => {
      emitComposition(basePrimaryFeatures, [], '/out/comp.ts');
      expect(writtenContent).toContain('import { Routes }');
      expect(writtenContent).toContain('@angular/router');
    });

    it('imports Provider type from @angular/core', () => {
      emitComposition(basePrimaryFeatures, [], '/out/comp.ts');
      expect(writtenContent).toContain('Provider');
      expect(writtenContent).toContain('@angular/core');
    });
  });

  describe('generatedRoutes', () => {
    it('exports generatedRoutes with Routes type', () => {
      emitComposition(basePrimaryFeatures, [], '/out/comp.ts');
      expect(writtenContent).toContain('export const generatedRoutes: Routes');
    });

    it('generates loadChildren for each primary feature', () => {
      emitComposition(basePrimaryFeatures, [], '/out/comp.ts');
      expect(writtenContent).toContain("import('@nacs/feature-a')");
      expect(writtenContent).toContain('m.featureARoutes');
      expect(writtenContent).toContain("import('@nacs/feature-b')");
      expect(writtenContent).toContain('m.featureBRoutes');
    });

    it('generates wildcard redirect to first feature', () => {
      emitComposition(basePrimaryFeatures, [], '/out/comp.ts');
      expect(writtenContent).toContain('path: "**"');
      expect(writtenContent).toContain('redirectTo: "feature-a"');
      expect(writtenContent).toContain('pathMatch: "full"');
    });

    it('generates wildcard redirect to defaultRoute when provided', () => {
      emitComposition(basePrimaryFeatures, [], '/out/comp.ts', 'feature-b');
      expect(writtenContent).toContain('path: "**"');
      expect(writtenContent).toContain('redirectTo: "feature-b"');
      expect(writtenContent).toContain('pathMatch: "full"');
    });

    it('falls back to first feature when defaultRoute is undefined', () => {
      emitComposition(basePrimaryFeatures, [], '/out/comp.ts', undefined);
      expect(writtenContent).toContain('redirectTo: "feature-a"');
    });

    it('includes title and icon data for routes', () => {
      emitComposition(basePrimaryFeatures, [], '/out/comp.ts');
      expect(writtenContent).toContain('"Feature A"');
      expect(writtenContent).toContain('"home"');
    });
  });

  describe('route extension points', () => {
    const routeExt: RouteExtPoint = {
      kind: 'route',
      name: 'admin',
      varName: 'extAdmin',
      contributions: [
        {
          item: {
            path: '/admin/feature-a',
            exportName: 'FeatureAAdminRoutes',
            icon: 'settings',
            title: 'Feature A Admin',
          },
          importPath: '@nacs/feature-a',
        },
      ],
    };

    it('generates named route extension variable', () => {
      emitComposition(basePrimaryFeatures, [routeExt], '/out/comp.ts');
      expect(writtenContent).toContain('export const extAdmin: Routes');
    });

    it('includes contribution routes with loadChildren', () => {
      emitComposition(basePrimaryFeatures, [routeExt], '/out/comp.ts');
      expect(writtenContent).toContain('FeatureAAdminRoutes');
    });

    it('generates empty array for route ext with no contributions', () => {
      const emptyRouteExt: RouteExtPoint = {
        ...routeExt,
        contributions: [],
      };
      emitComposition(basePrimaryFeatures, [emptyRouteExt], '/out/comp.ts');
      expect(writtenContent).toMatch(/extAdmin:\s*Routes\s*=\s*\[\]/);
    });
  });

  describe('component extension points', () => {
    const componentExt: ComponentExtPoint = {
      kind: 'component',
      name: 'dashboard-widget',
      varName: 'extDashboardWidget',
      descriptor: {
        itemType: 'component',
        tokenExportName: 'DASHBOARD_WIDGETS',
        itemTypeName: 'DashboardWidget',
      },
      consumerImportPath: '@nacs/feature-dashboard',
      contributions: [
        {
          item: {
            exportName: 'FeatureAWidget',
            title: 'Feature A Widget',
            icon: 'chart',
            routePath: '/feature-a',
          },
          importPath: '@nacs/feature-a',
        },
      ],
    };

    it('imports type and token from consumer', () => {
      emitComposition(basePrimaryFeatures, [componentExt], '/out/comp.ts');
      expect(writtenContent).toContain('DashboardWidget');
      expect(writtenContent).toContain('DASHBOARD_WIDGETS');
      expect(writtenContent).toContain('@nacs/feature-dashboard');
    });

    it('imports contributed components', () => {
      emitComposition(basePrimaryFeatures, [componentExt], '/out/comp.ts');
      expect(writtenContent).toContain('FeatureAWidget');
      expect(writtenContent).toContain('@nacs/feature-a');
    });

    it('generates typed array with contributions', () => {
      emitComposition(basePrimaryFeatures, [componentExt], '/out/comp.ts');
      expect(writtenContent).toContain('extDashboardWidget: DashboardWidget[]');
      expect(writtenContent).toContain('component: FeatureAWidget');
    });

    it('includes routePath when present', () => {
      emitComposition(basePrimaryFeatures, [componentExt], '/out/comp.ts');
      expect(writtenContent).toContain('routePath: "/feature-a"');
    });

    it('generates empty typed array when no contributions', () => {
      const emptyComp: ComponentExtPoint = {
        ...componentExt,
        contributions: [],
      };
      emitComposition(basePrimaryFeatures, [emptyComp], '/out/comp.ts');
      expect(writtenContent).toMatch(
        /extDashboardWidget:\s*DashboardWidget\[\]\s*=\s*\[\]/,
      );
    });
  });

  describe('lazy-component extension points', () => {
    const lazyExt: LazyComponentExtPoint = {
      kind: 'lazy-component',
      name: 'nav-badge',
      varName: 'extNavBadge',
      descriptor: {
        itemType: 'lazy-component',
        tokenExportName: 'NAV_BADGES',
      },
      consumerImportPath: '@nacs/shell-nav',
      contributions: [
        {
          item: {
            exportName: 'FeatureABadge',
            title: 'Feature A Badge',
            icon: 'badge',
          },
          importPath: '@nacs/feature-a',
        },
      ],
    };

    it('imports only the token (no static component imports)', () => {
      emitComposition(basePrimaryFeatures, [lazyExt], '/out/comp.ts');
      expect(writtenContent).toContain('NAV_BADGES');
      expect(writtenContent).toContain('@nacs/shell-nav');
      // Should NOT have a static import of FeatureABadge (only dynamic import())
      expect(writtenContent).not.toMatch(/import\s*{[^}]*FeatureABadge[^}]*}/);
    });

    it('generates loadComponent with dynamic import', () => {
      emitComposition(basePrimaryFeatures, [lazyExt], '/out/comp.ts');
      expect(writtenContent).toContain('loadComponent:');
      expect(writtenContent).toContain(
        "import('@nacs/feature-a').then(m => m.FeatureABadge)",
      );
    });

    it('includes routePath in lazy contribution when present', () => {
      const lazyWithRoute: LazyComponentExtPoint = {
        ...lazyExt,
        contributions: [
          {
            item: {
              exportName: 'FeatureABadge',
              title: 'Feature A Badge',
              icon: 'badge',
              routePath: '/feature-a',
            },
            importPath: '@nacs/feature-a',
          },
        ],
      };
      emitComposition(basePrimaryFeatures, [lazyWithRoute], '/out/comp.ts');
      expect(writtenContent).toContain('routePath: "/feature-a"');
    });

    it('generates empty array when no contributions', () => {
      const emptyLazy: LazyComponentExtPoint = {
        ...lazyExt,
        contributions: [],
      };
      emitComposition(basePrimaryFeatures, [emptyLazy], '/out/comp.ts');
      expect(writtenContent).toMatch(/extNavBadge\s*=\s*\[\]/);
    });
  });

  describe('lifecycle-hook extension points', () => {
    const lifecycleExt: LifecycleHookExtPoint = {
      kind: 'lifecycle-hook',
      name: 'lifecycle:user.logout',
      varName: 'extLifecycleUserLogout',
      descriptor: {
        itemType: 'lifecycle-hook',
        tokenExportName: 'LOGOUT_HANDLERS',
      },
      consumerImportPath: '@nacs/shell-lifecycle',
      contributions: [
        {
          item: { exportName: 'featureALogoutHandler' },
          importPath: '@nacs/feature-a',
        },
      ],
    };

    it('imports the token from the consumer library', () => {
      emitComposition(basePrimaryFeatures, [lifecycleExt], '/out/comp.ts');
      expect(writtenContent).toContain('LOGOUT_HANDLERS');
      expect(writtenContent).toContain('@nacs/shell-lifecycle');
    });

    it('imports each contributed handler function', () => {
      emitComposition(basePrimaryFeatures, [lifecycleExt], '/out/comp.ts');
      expect(writtenContent).toContain('featureALogoutHandler');
      expect(writtenContent).toContain('@nacs/feature-a');
    });

    it('does NOT emit a separate const variable for lifecycle hooks', () => {
      emitComposition(basePrimaryFeatures, [lifecycleExt], '/out/comp.ts');
      expect(writtenContent).not.toContain(
        'export const extLifecycleUserLogout',
      );
    });

    it('generates multi: true provider entries in generatedProviders', () => {
      emitComposition(basePrimaryFeatures, [lifecycleExt], '/out/comp.ts');
      expect(writtenContent).toContain('provide: LOGOUT_HANDLERS');
      expect(writtenContent).toContain('useValue: featureALogoutHandler');
      expect(writtenContent).toContain('multi: true');
    });

    it('generates multiple handler providers from multiple contributions', () => {
      const multiExt: LifecycleHookExtPoint = {
        ...lifecycleExt,
        contributions: [
          {
            item: { exportName: 'featureALogoutHandler' },
            importPath: '@nacs/feature-a',
          },
          {
            item: { exportName: 'featureBLogoutHandler' },
            importPath: '@nacs/feature-b',
          },
        ],
      };
      emitComposition(basePrimaryFeatures, [multiExt], '/out/comp.ts');
      expect(writtenContent).toContain('featureALogoutHandler');
      expect(writtenContent).toContain('featureBLogoutHandler');
      // Both should have multi: true
      const multiMatches = writtenContent.match(/multi: true/g);
      expect(multiMatches).toHaveLength(2);
    });

    it('generates no provider entries when no contributions', () => {
      const emptyLifecycle: LifecycleHookExtPoint = {
        ...lifecycleExt,
        contributions: [],
      };
      emitComposition(basePrimaryFeatures, [emptyLifecycle], '/out/comp.ts');
      expect(writtenContent).not.toContain('provide: LOGOUT_HANDLERS');
      expect(writtenContent).not.toContain('multi: true');
    });
  });

  describe('generatedProviders', () => {
    it('always exports generatedProviders array', () => {
      emitComposition(basePrimaryFeatures, [], '/out/comp.ts');
      expect(writtenContent).toContain(
        'export const generatedProviders: Provider[]',
      );
    });

    it('includes provide/useValue for component ext points', () => {
      const componentExt: ComponentExtPoint = {
        kind: 'component',
        name: 'dashboard-widget',
        varName: 'extDashboardWidget',
        descriptor: {
          itemType: 'component',
          tokenExportName: 'DASHBOARD_WIDGETS',
          itemTypeName: 'DashboardWidget',
        },
        consumerImportPath: '@nacs/feature-dashboard',
        contributions: [],
      };
      emitComposition(basePrimaryFeatures, [componentExt], '/out/comp.ts');
      expect(writtenContent).toContain('provide: DASHBOARD_WIDGETS');
      expect(writtenContent).toContain('useValue: extDashboardWidget');
    });

    it('includes provide/useValue for lazy-component ext points', () => {
      const lazyExt: LazyComponentExtPoint = {
        kind: 'lazy-component',
        name: 'nav-badge',
        varName: 'extNavBadge',
        descriptor: {
          itemType: 'lazy-component',
          tokenExportName: 'NAV_BADGES',
        },
        consumerImportPath: '@nacs/shell-nav',
        contributions: [],
      };
      emitComposition(basePrimaryFeatures, [lazyExt], '/out/comp.ts');
      expect(writtenContent).toContain('provide: NAV_BADGES');
      expect(writtenContent).toContain('useValue: extNavBadge');
    });

    it('does NOT include route ext points in providers', () => {
      const routeExt: RouteExtPoint = {
        kind: 'route',
        name: 'admin',
        varName: 'extAdmin',
        contributions: [],
      };
      emitComposition(basePrimaryFeatures, [routeExt], '/out/comp.ts');
      expect(writtenContent).not.toContain('provide: extAdmin');
    });

    it('includes lifecycle-hook multi providers alongside component providers', () => {
      const componentExt: ComponentExtPoint = {
        kind: 'component',
        name: 'dashboard-widget',
        varName: 'extDashboardWidget',
        descriptor: {
          itemType: 'component',
          tokenExportName: 'DASHBOARD_WIDGETS',
          itemTypeName: 'DashboardWidget',
        },
        consumerImportPath: '@nacs/feature-dashboard',
        contributions: [],
      };
      const lifecycleExt: LifecycleHookExtPoint = {
        kind: 'lifecycle-hook',
        name: 'lifecycle:user.logout',
        varName: 'extLifecycleUserLogout',
        descriptor: {
          itemType: 'lifecycle-hook',
          tokenExportName: 'LOGOUT_HANDLERS',
        },
        consumerImportPath: '@nacs/shell-lifecycle',
        contributions: [
          {
            item: { exportName: 'featureALogoutHandler' },
            importPath: '@nacs/feature-a',
          },
        ],
      };
      emitComposition(
        basePrimaryFeatures,
        [componentExt, lifecycleExt],
        '/out/comp.ts',
      );
      // Both types of providers should be present
      expect(writtenContent).toContain('provide: DASHBOARD_WIDGETS');
      expect(writtenContent).toContain('provide: LOGOUT_HANDLERS');
      expect(writtenContent).toContain('multi: true');
    });
  });

  describe('file output', () => {
    it('writes to the specified output path', () => {
      emitComposition(basePrimaryFeatures, [], '/my/output.ts');
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        '/my/output.ts',
        expect.any(String),
      );
    });
  });

  describe('value extension points', () => {
    const valueExt: ValueExtPoint = {
      kind: 'value',
      name: 'help-topic',
      varName: 'extHelpTopic',
      descriptor: {
        itemType: 'value',
        tokenExportName: 'HELP_TOPICS',
      },
      consumerImportPath: '@nacs/shell-help',
      contributions: [
        {
          item: {
            id: 'feature-a-overview',
            title: 'Analytics Overview',
            summary: 'Track record processing.',
            category: 'Analytics',
            icon: '📊',
          },
          importPath: '@nacs/feature-a',
        },
        {
          item: {
            id: 'feature-b-overview',
            title: 'Messaging Basics',
            summary: 'Send and receive messages.',
            category: 'Communication',
          },
          importPath: '@nacs/feature-b',
        },
      ],
    };

    it('imports only the token from consumer (no feature imports)', () => {
      emitComposition(basePrimaryFeatures, [valueExt], '/out/comp.ts');
      expect(writtenContent).toContain('HELP_TOPICS');
      expect(writtenContent).toContain('@nacs/shell-help');
      // Should NOT have static imports from feature paths for value items
      expect(writtenContent).not.toMatch(
        /import\s*{[^}]*feature-a-overview[^}]*}/,
      );
    });

    it('generates inline JSON data array', () => {
      emitComposition(basePrimaryFeatures, [valueExt], '/out/comp.ts');
      expect(writtenContent).toContain('feature-a-overview');
      expect(writtenContent).toContain('Analytics Overview');
      expect(writtenContent).toContain('feature-b-overview');
      expect(writtenContent).toContain('Messaging Basics');
    });

    it('generates empty array when no contributions', () => {
      const emptyValueExt: ValueExtPoint = {
        ...valueExt,
        contributions: [],
      };
      emitComposition(basePrimaryFeatures, [emptyValueExt], '/out/comp.ts');
      expect(writtenContent).toMatch(/extHelpTopic\s*=\s*\[\]/);
    });

    it('includes value ext point in generatedProviders', () => {
      emitComposition(basePrimaryFeatures, [valueExt], '/out/comp.ts');
      expect(writtenContent).toContain('provide: HELP_TOPICS');
      expect(writtenContent).toContain('useValue: extHelpTopic');
    });

    it('does not include multi: true for value providers', () => {
      emitComposition(basePrimaryFeatures, [valueExt], '/out/comp.ts');
      expect(writtenContent).not.toContain('multi: true');
    });
  });
});
