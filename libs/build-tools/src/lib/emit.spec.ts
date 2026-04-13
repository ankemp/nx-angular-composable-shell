import * as fs from 'fs';
import { emitComposition } from './emit';
import type {
  ResolvedPrimaryFeature,
  CollectedExtPoint,
  RouteExtPoint,
  ComponentExtPoint,
  LazyComponentExtPoint,
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
});
