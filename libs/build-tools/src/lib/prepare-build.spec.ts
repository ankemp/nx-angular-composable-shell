import * as fs from 'fs';
import { execFileSync } from 'child_process';
import { readJsonFile } from '@nx/devkit';
import { readPackageJson } from '@nx/workspace';

jest.mock('fs');
jest.mock('child_process');
jest.mock('@nx/devkit', () => ({ readJsonFile: jest.fn() }));
jest.mock('@nx/workspace', () => ({ readPackageJson: jest.fn() }));
jest.mock('./resolve');
jest.mock('./emit');

const mockFs = jest.mocked(fs);
const mockExecFileSync = jest.mocked(execFileSync);
const mockReadJsonFile = jest.mocked(readJsonFile);
const mockReadPackageJson = jest.mocked(readPackageJson);

import { resolvePackageJson } from './resolve';
import { emitComposition } from './emit';
import { runPrepareBuild } from './prepare-build';
import { BuildPreparationError, NacsGovernanceError } from './schemas';

const mockResolvePackageJson = jest.mocked(resolvePackageJson);
const mockEmitComposition = jest.mocked(emitComposition);

const ROOT = '/workspace';

function makeClientConfig(
  features: Array<{
    module: string;
    version?: string;
    overrides?: { title?: string; icon?: string };
  }>,
) {
  return { clientId: 'test', features };
}

function makeRootPkg(
  deps: Record<string, string> = {},
  devDeps: Record<string, string> = {},
) {
  return {
    name: '@nacs/source',
    dependencies: { '@angular/core': '~21.2.0', ...deps },
    devDependencies: { typescript: '~5.9.2', ...devDeps },
  } as ReturnType<typeof readPackageJson>;
}

function makeFeaturePkg(
  name: string,
  primary?: {
    path: string;
    exportName: string;
    title: string;
    icon: string;
  },
  extra?: Record<string, unknown>,
) {
  return {
    name,
    'nacs-contributions': primary ? { primary, ...extra } : undefined,
    ...extra,
  };
}

beforeEach(() => {
  jest.clearAllMocks();

  // Default: tsconfig with paths
  mockReadJsonFile.mockImplementation((filePath: string) => {
    if (filePath.includes('tsconfig.base.json')) {
      return {
        compilerOptions: {
          paths: {
            '@nacs/feature-a': ['libs/feature-a/src/index.ts'],
            '@nacs/core-admin': ['libs/core-admin/src/index.ts'],
            '@nacs/shell-nav': ['libs/shell-nav/src/index.ts'],
          },
        },
      };
    }
    // Default: return a client config
    return makeClientConfig([{ module: '@nacs/feature-a' }]);
  });

  // Default: root package.json
  mockReadPackageJson.mockReturnValue(makeRootPkg());

  // Default: fs stubs
  mockFs.existsSync.mockReturnValue(true);
  mockFs.readFileSync.mockReturnValue('{}');
  mockFs.writeFileSync.mockImplementation(() => undefined);
});

// ---------------------------------------------------------------------------
// Happy path — local features
// ---------------------------------------------------------------------------
describe('runPrepareBuild — local features', () => {
  it('calls emitComposition with resolved primary features', () => {
    mockResolvePackageJson.mockReturnValue(
      makeFeaturePkg('@nacs/feature-a', {
        path: 'feature-a',
        exportName: 'featureARoutes',
        title: 'Feature A',
        icon: 'home',
      }) as ReturnType<typeof resolvePackageJson>,
    );

    runPrepareBuild('test', ROOT);

    expect(mockEmitComposition).toHaveBeenCalledTimes(1);
    const [primaryFeatures] = mockEmitComposition.mock.calls[0];
    expect(primaryFeatures).toHaveLength(1);
    expect(primaryFeatures[0].primary.title).toBe('Feature A');
    expect(primaryFeatures[0].importPath).toBe('@nacs/feature-a');
  });

  it('does not call npm install for local features', () => {
    mockResolvePackageJson.mockReturnValue(
      makeFeaturePkg('@nacs/feature-a', {
        path: 'feature-a',
        exportName: 'R',
        title: 'A',
        icon: 'x',
      }) as ReturnType<typeof resolvePackageJson>,
    );

    runPrepareBuild('test', ROOT);
    expect(mockExecFileSync).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Versioned packages
// ---------------------------------------------------------------------------
describe('runPrepareBuild — versioned packages', () => {
  beforeEach(() => {
    mockReadJsonFile.mockImplementation((filePath: string) => {
      if (filePath.includes('tsconfig.base.json')) {
        return { compilerOptions: { paths: {} } };
      }
      return makeClientConfig([
        { module: '@nacs/feature-a', version: '1.0.0' },
      ]);
    });
  });

  it('installs versioned package when not cached', () => {
    // not cached
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p).includes('node_modules')) return false;
      return true;
    });
    mockExecFileSync.mockReturnValue('installed' as any);
    mockResolvePackageJson.mockReturnValue(
      makeFeaturePkg('@nacs/feature-a', {
        path: 'feature-a',
        exportName: 'R',
        title: 'A',
        icon: 'x',
      }) as ReturnType<typeof resolvePackageJson>,
    );

    runPrepareBuild('test', ROOT);

    expect(mockExecFileSync).toHaveBeenCalledWith(
      'npm',
      expect.arrayContaining(['install']),
      expect.objectContaining({ cwd: ROOT }),
    );
  });

  it('skips install when versioned package is already cached', () => {
    // cached: existsSync returns true, readFileSync returns matching version
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify({ version: '1.0.0' }));
    mockResolvePackageJson.mockReturnValue(
      makeFeaturePkg('@nacs/feature-a', {
        path: 'feature-a',
        exportName: 'R',
        title: 'A',
        icon: 'x',
      }) as ReturnType<typeof resolvePackageJson>,
    );

    runPrepareBuild('test', ROOT);
    expect(mockExecFileSync).not.toHaveBeenCalled();
  });

  it('throws BuildPreparationError after exhausted install retries', () => {
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p).includes('node_modules')) return false;
      return true;
    });
    mockExecFileSync.mockImplementation(() => {
      throw { stderr: 'network error' };
    });
    mockResolvePackageJson.mockReturnValue(
      makeFeaturePkg('@nacs/feature-a', {
        path: 'feature-a',
        exportName: 'R',
        title: 'A',
        icon: 'x',
      }) as ReturnType<typeof resolvePackageJson>,
    );

    expect(() => runPrepareBuild('test', ROOT)).toThrow(BuildPreparationError);
    // 3 attempts total (1 + 2 retries)
    expect(mockExecFileSync).toHaveBeenCalledTimes(3);
  });
});

// ---------------------------------------------------------------------------
// Client config override merging
// ---------------------------------------------------------------------------
describe('runPrepareBuild — overrides', () => {
  it('merges client overrides over package primary', () => {
    mockReadJsonFile.mockImplementation((filePath: string) => {
      if (filePath.includes('tsconfig.base.json')) {
        return { compilerOptions: { paths: {} } };
      }
      return makeClientConfig([
        {
          module: '@nacs/feature-a',
          overrides: { title: 'Custom Title', icon: 'star' },
        },
      ]);
    });
    mockResolvePackageJson.mockReturnValue(
      makeFeaturePkg('@nacs/feature-a', {
        path: 'feature-a',
        exportName: 'R',
        title: 'Original',
        icon: 'home',
      }) as ReturnType<typeof resolvePackageJson>,
    );

    runPrepareBuild('test', ROOT);

    const [primaryFeatures] = mockEmitComposition.mock.calls[0];
    expect(primaryFeatures[0].primary.title).toBe('Custom Title');
    expect(primaryFeatures[0].primary.icon).toBe('star');
  });
});

// ---------------------------------------------------------------------------
// Peer dependency governance
// ---------------------------------------------------------------------------
describe('runPrepareBuild — governance', () => {
  it('throws NacsGovernanceError on peer version mismatch', () => {
    mockReadJsonFile.mockImplementation((filePath: string) => {
      if (filePath.includes('tsconfig.base.json')) {
        return { compilerOptions: { paths: {} } };
      }
      return makeClientConfig([{ module: '@nacs/feature-a' }]);
    });
    mockReadPackageJson.mockReturnValue(
      makeRootPkg({ '@angular/core': '~21.2.0' }),
    );
    mockResolvePackageJson.mockReturnValue({
      name: '@nacs/feature-a',
      'nacs-contributions': {
        primary: {
          path: 'feature-a',
          exportName: 'R',
          title: 'A',
          icon: 'x',
        },
      },
      peerDependencies: {
        '@angular/core': '>=22.0.0',
      },
    } as any);

    expect(() => runPrepareBuild('test', ROOT)).toThrow(NacsGovernanceError);
  });

  it('throws NacsGovernanceError when peer dep is not provided by shell', () => {
    mockReadJsonFile.mockImplementation((filePath: string) => {
      if (filePath.includes('tsconfig.base.json')) {
        return { compilerOptions: { paths: {} } };
      }
      return makeClientConfig([{ module: '@nacs/feature-a' }]);
    });
    mockResolvePackageJson.mockReturnValue({
      name: '@nacs/feature-a',
      'nacs-contributions': {
        primary: {
          path: 'feature-a',
          exportName: 'R',
          title: 'A',
          icon: 'x',
        },
      },
      peerDependencies: {
        'some-missing-dep': '^1.0.0',
      },
    } as any);

    expect(() => runPrepareBuild('test', ROOT)).toThrow(NacsGovernanceError);
  });
});

// ---------------------------------------------------------------------------
// Validation errors
// ---------------------------------------------------------------------------
describe('runPrepareBuild — validation', () => {
  it('throws BuildPreparationError when all features are headless (no primary)', () => {
    mockReadJsonFile.mockImplementation((filePath: string) => {
      if (filePath.includes('tsconfig.base.json')) {
        return { compilerOptions: { paths: {} } };
      }
      return makeClientConfig([{ module: '@nacs/feature-a' }]);
    });
    mockResolvePackageJson.mockReturnValue({
      name: '@nacs/feature-a',
    } as ReturnType<typeof resolvePackageJson>);

    expect(() => runPrepareBuild('test', ROOT)).toThrow(BuildPreparationError);
  });

  it('throws when primary is missing title', () => {
    mockReadJsonFile.mockImplementation((filePath: string) => {
      if (filePath.includes('tsconfig.base.json')) {
        return { compilerOptions: { paths: {} } };
      }
      return makeClientConfig([{ module: '@nacs/feature-a' }]);
    });
    mockResolvePackageJson.mockReturnValue({
      name: '@nacs/feature-a',
      'nacs-contributions': {
        primary: {
          path: 'feature-a',
          exportName: 'R',
          icon: 'x',
          // title intentionally missing
        },
      },
    } as any);

    expect(() => runPrepareBuild('test', ROOT)).toThrow(BuildPreparationError);
  });
});

// ---------------------------------------------------------------------------
// Headless features (no primary route)
// ---------------------------------------------------------------------------
describe('runPrepareBuild — headless features', () => {
  it('succeeds when a feature has no primary (headless feature alongside a primary feature)', () => {
    mockReadJsonFile.mockImplementation((filePath: string) => {
      if (filePath.includes('tsconfig.base.json')) {
        return { compilerOptions: { paths: {} } };
      }
      return makeClientConfig([
        { module: '@nacs/feature-a' },
        { module: '@nacs/feature-telemetry' },
      ]);
    });

    mockResolvePackageJson.mockImplementation((module: string) => {
      if (module === '@nacs/feature-a') {
        return makeFeaturePkg('@nacs/feature-a', {
          path: 'feature-a',
          exportName: 'R',
          title: 'A',
          icon: 'x',
        }) as ReturnType<typeof resolvePackageJson>;
      }
      // Headless feature — no primary
      return {
        name: '@nacs/feature-telemetry',
        'nacs-contributions': {
          extensions: {
            'dashboard-widget': [{ exportName: 'TelemetryWidget' }],
          },
        },
      } as any;
    });

    expect(() => runPrepareBuild('test', ROOT)).not.toThrow();

    const [primaryFeatures] = mockEmitComposition.mock.calls[0];
    expect(primaryFeatures).toHaveLength(1);
    expect(primaryFeatures[0].primary.title).toBe('A');
    // Headless feature must not appear in generatedRoutes
    expect(
      primaryFeatures.some(
        (f: any) => f.importPath === '@nacs/feature-telemetry',
      ),
    ).toBe(false);
  });

  it('still collects extensions from headless features', () => {
    mockReadJsonFile.mockImplementation((filePath: string) => {
      if (filePath.includes('tsconfig.base.json')) {
        return {
          compilerOptions: {
            paths: {
              '@nacs/feature-a': ['libs/feature-a/src/index.ts'],
              '@nacs/feature-telemetry': [
                'libs/feature-telemetry/src/index.ts',
              ],
              '@nacs/feature-dashboard': [
                'libs/feature-dashboard/src/index.ts',
              ],
            },
          },
        };
      }
      return makeClientConfig([
        { module: '@nacs/feature-dashboard' },
        { module: '@nacs/feature-a' },
        { module: '@nacs/feature-telemetry' },
      ]);
    });

    mockResolvePackageJson.mockImplementation((module: string) => {
      if (module === '@nacs/feature-dashboard') {
        return {
          name: '@nacs/feature-dashboard',
          'nacs-contributions': {
            primary: {
              path: 'dashboard',
              exportName: 'D',
              title: 'Dashboard',
              icon: 'd',
            },
            extensionPoints: {
              'dashboard-widget': {
                itemType: 'lazy-component',
                tokenExportName: 'DASHBOARD_WIDGETS',
              },
            },
          },
        } as any;
      }
      if (module === '@nacs/feature-a') {
        return makeFeaturePkg('@nacs/feature-a', {
          path: 'feature-a',
          exportName: 'R',
          title: 'A',
          icon: 'x',
        }) as ReturnType<typeof resolvePackageJson>;
      }
      // Headless feature
      return {
        name: '@nacs/feature-telemetry',
        'nacs-contributions': {
          extensions: {
            'dashboard-widget': [
              { exportName: 'TelemetryWidget', title: 'Telemetry', icon: '📡' },
            ],
          },
        },
      } as any;
    });

    runPrepareBuild('test', ROOT);

    const [, collectedExtPoints] = mockEmitComposition.mock.calls[0];
    const widgetExt = collectedExtPoints.find(
      (e: any) => e.name === 'dashboard-widget',
    );
    expect(widgetExt).toBeDefined();
    expect(
      widgetExt!.contributions.some(
        (c: any) => c.item.exportName === 'TelemetryWidget',
      ),
    ).toBe(true);
  });

  it('still enforces peer governance on headless features', () => {
    mockReadJsonFile.mockImplementation((filePath: string) => {
      if (filePath.includes('tsconfig.base.json')) {
        return { compilerOptions: { paths: {} } };
      }
      return makeClientConfig([
        { module: '@nacs/feature-a' },
        { module: '@nacs/feature-telemetry' },
      ]);
    });
    mockReadPackageJson.mockReturnValue(
      makeRootPkg({ '@angular/core': '~21.2.0' }),
    );

    mockResolvePackageJson.mockImplementation((module: string) => {
      if (module === '@nacs/feature-a') {
        return makeFeaturePkg('@nacs/feature-a', {
          path: 'feature-a',
          exportName: 'R',
          title: 'A',
          icon: 'x',
        }) as ReturnType<typeof resolvePackageJson>;
      }
      // Headless feature with bad peer deps
      return {
        name: '@nacs/feature-telemetry',
        'nacs-contributions': {
          extensions: {
            'dashboard-widget': [{ exportName: 'TelemetryWidget' }],
          },
        },
        peerDependencies: {
          '@angular/core': '>=22.0.0',
        },
      } as any;
    });

    expect(() => runPrepareBuild('test', ROOT)).toThrow(NacsGovernanceError);
  });
});

// ---------------------------------------------------------------------------
// Default route
// ---------------------------------------------------------------------------
describe('runPrepareBuild — defaultRoute', () => {
  it('resolves defaultRoute module to route path and passes to emitComposition', () => {
    mockReadJsonFile.mockImplementation((filePath: string) => {
      if (filePath.includes('tsconfig.base.json')) {
        return { compilerOptions: { paths: {} } };
      }
      return {
        clientId: 'test',
        features: [
          { module: '@nacs/feature-a' },
          { module: '@nacs/feature-b' },
        ],
        defaultRoute: '@nacs/feature-b',
      };
    });
    mockResolvePackageJson.mockImplementation((module: string) => {
      if (module === '@nacs/feature-a') {
        return makeFeaturePkg('@nacs/feature-a', {
          path: 'feature-a',
          exportName: 'R',
          title: 'A',
          icon: 'x',
        }) as ReturnType<typeof resolvePackageJson>;
      }
      return makeFeaturePkg('@nacs/feature-b', {
        path: 'feature-b',
        exportName: 'S',
        title: 'B',
        icon: 'y',
      }) as ReturnType<typeof resolvePackageJson>;
    });

    runPrepareBuild('test', ROOT);

    // Should resolve @nacs/feature-b module → 'feature-b' route path
    expect(mockEmitComposition).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Array),
      expect.any(String),
      'feature-b',
    );
  });

  it('passes undefined when defaultRoute is not specified', () => {
    mockResolvePackageJson.mockReturnValue(
      makeFeaturePkg('@nacs/feature-a', {
        path: 'feature-a',
        exportName: 'R',
        title: 'A',
        icon: 'x',
      }) as ReturnType<typeof resolvePackageJson>,
    );

    runPrepareBuild('test', ROOT);

    expect(mockEmitComposition).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Array),
      expect.any(String),
      undefined,
    );
  });

  it('throws BuildPreparationError when defaultRoute does not match any feature module', () => {
    mockReadJsonFile.mockImplementation((filePath: string) => {
      if (filePath.includes('tsconfig.base.json')) {
        return { compilerOptions: { paths: {} } };
      }
      return {
        clientId: 'test',
        features: [{ module: '@nacs/feature-a' }],
        defaultRoute: '@nacs/nonexistent',
      };
    });
    mockResolvePackageJson.mockReturnValue(
      makeFeaturePkg('@nacs/feature-a', {
        path: 'feature-a',
        exportName: 'R',
        title: 'A',
        icon: 'x',
      }) as ReturnType<typeof resolvePackageJson>,
    );

    expect(() => runPrepareBuild('test', ROOT)).toThrow(BuildPreparationError);
  });
});

// ---------------------------------------------------------------------------
// Extension point discovery
// ---------------------------------------------------------------------------
describe('runPrepareBuild — extension points', () => {
  it('passes collected extension points to emitComposition', () => {
    mockReadJsonFile.mockImplementation((filePath: string) => {
      if (filePath.includes('tsconfig.base.json')) {
        return {
          compilerOptions: {
            paths: {
              '@nacs/feature-a': ['libs/feature-a/src/index.ts'],
              '@nacs/core-admin': ['libs/core-admin/src/index.ts'],
            },
          },
        };
      }
      return makeClientConfig([{ module: '@nacs/feature-a' }]);
    });

    // Feature with primary + extension point consumer
    mockResolvePackageJson.mockReturnValue({
      name: '@nacs/feature-a',
      'nacs-contributions': {
        primary: {
          path: 'feature-a',
          exportName: 'R',
          title: 'A',
          icon: 'x',
        },
        extensionPoints: {
          admin: { itemType: 'route' },
        },
      },
    } as any);

    // core-admin: always-active lib with extension point
    mockReadPackageJson.mockImplementation((pkgDir?: string) => {
      if (String(pkgDir).includes('core-admin')) {
        return {
          name: '@nacs/core-admin',
          'nacs-contributions': {
            extensionPoints: {
              'core-admin-nav': { itemType: 'route' },
            },
          },
        } as any;
      }
      return makeRootPkg();
    });

    // core-admin dir exists
    mockFs.existsSync.mockReturnValue(true);

    runPrepareBuild('test', ROOT);

    expect(mockEmitComposition).toHaveBeenCalledTimes(1);
    const [, collectedExtPoints] = mockEmitComposition.mock.calls[0];
    // Should have discovered at least the config-driven "admin" ext point
    expect(collectedExtPoints.some((e: any) => e.name === 'admin')).toBe(true);
  });

  it('generates correct varName from extension point name', () => {
    mockReadJsonFile.mockImplementation((filePath: string) => {
      if (filePath.includes('tsconfig.base.json')) {
        return { compilerOptions: { paths: {} } };
      }
      return makeClientConfig([{ module: '@nacs/feature-a' }]);
    });
    mockResolvePackageJson.mockReturnValue({
      name: '@nacs/feature-a',
      'nacs-contributions': {
        primary: {
          path: 'feature-a',
          exportName: 'R',
          title: 'A',
          icon: 'x',
        },
        extensionPoints: {
          'dashboard-widget': {
            itemType: 'component',
            tokenExportName: 'WIDGETS',
            itemTypeName: 'Widget',
          },
        },
      },
    } as any);

    runPrepareBuild('test', ROOT);

    const [, collectedExtPoints] = mockEmitComposition.mock.calls[0];
    const dashExt = collectedExtPoints.find(
      (e: any) => e.name === 'dashboard-widget',
    );
    expect(dashExt).toBeDefined();
    expect(dashExt!.varName).toBe('extDashboardWidget');
  });

  it('collects route contributions from features that contribute to a route ext point', () => {
    mockReadJsonFile.mockImplementation((filePath: string) => {
      if (filePath.includes('tsconfig.base.json')) {
        return { compilerOptions: { paths: {} } };
      }
      return makeClientConfig([
        { module: '@nacs/feature-a' },
        { module: '@nacs/feature-b' },
      ]);
    });

    // feature-a declares the extension point; feature-b contributes to it
    mockResolvePackageJson.mockImplementation((module: string) => {
      if (module === '@nacs/feature-a') {
        return {
          name: '@nacs/feature-a',
          'nacs-contributions': {
            primary: {
              path: 'feature-a',
              exportName: 'R',
              title: 'A',
              icon: 'x',
            },
            extensionPoints: { admin: { itemType: 'route' } },
          },
        } as any;
      }
      return {
        name: '@nacs/feature-b',
        'nacs-contributions': {
          primary: {
            path: 'feature-b',
            exportName: 'S',
            title: 'B',
            icon: 'y',
          },
          extensions: {
            admin: [
              {
                path: '/admin/b',
                exportName: 'BAdminRoutes',
                icon: 'settings',
              },
            ],
          },
        },
      } as any;
    });

    runPrepareBuild('test', ROOT);

    const [, collectedExtPoints] = mockEmitComposition.mock.calls[0];
    const adminExt = collectedExtPoints.find((e: any) => e.name === 'admin');
    expect(adminExt).toBeDefined();
    expect(adminExt!.kind).toBe('route');
    expect(adminExt!.contributions).toHaveLength(1);
    expect(adminExt!.contributions[0].item.exportName).toBe('BAdminRoutes');
    expect(adminExt!.contributions[0].importPath).toBe('@nacs/feature-b');
  });

  it('collects component contributions from features that contribute to a component ext point', () => {
    mockReadJsonFile.mockImplementation((filePath: string) => {
      if (filePath.includes('tsconfig.base.json')) {
        return { compilerOptions: { paths: {} } };
      }
      return makeClientConfig([
        { module: '@nacs/feature-dashboard' },
        { module: '@nacs/feature-a' },
      ]);
    });

    mockResolvePackageJson.mockImplementation((module: string) => {
      if (module === '@nacs/feature-dashboard') {
        return {
          name: '@nacs/feature-dashboard',
          'nacs-contributions': {
            primary: {
              path: 'dashboard',
              exportName: 'D',
              title: 'Dashboard',
              icon: 'd',
            },
            extensionPoints: {
              'dashboard-widget': {
                itemType: 'component',
                tokenExportName: 'DASHBOARD_WIDGETS',
                itemTypeName: 'DashboardWidget',
              },
            },
          },
        } as any;
      }
      return {
        name: '@nacs/feature-a',
        'nacs-contributions': {
          primary: {
            path: 'feature-a',
            exportName: 'R',
            title: 'A',
            icon: 'x',
          },
          extensions: {
            'dashboard-widget': [
              {
                exportName: 'FeatureAWidget',
                title: 'Feature A Widget',
                icon: 'chart',
              },
            ],
          },
        },
      } as any;
    });

    runPrepareBuild('test', ROOT);

    const [, collectedExtPoints] = mockEmitComposition.mock.calls[0];
    const widgetExt = collectedExtPoints.find(
      (e: any) => e.name === 'dashboard-widget',
    );
    expect(widgetExt).toBeDefined();
    expect(widgetExt!.kind).toBe('component');
    expect(widgetExt!.contributions).toHaveLength(1);
    expect(widgetExt!.contributions[0].item.exportName).toBe('FeatureAWidget');
  });

  it('collects lifecycle-hook contributions from features that contribute to a lifecycle ext point', () => {
    mockReadJsonFile.mockImplementation((filePath: string) => {
      if (filePath.includes('tsconfig.base.json')) {
        return {
          compilerOptions: {
            paths: {
              '@nacs/feature-a': ['libs/feature-a/src/index.ts'],
              '@nacs/shell-lifecycle': ['libs/shell-lifecycle/src/index.ts'],
            },
          },
        };
      }
      return makeClientConfig([{ module: '@nacs/feature-a' }]);
    });

    mockResolvePackageJson.mockReturnValue(
      makeFeaturePkg(
        '@nacs/feature-a',
        {
          path: 'feature-a',
          exportName: 'R',
          title: 'A',
          icon: 'x',
        },
        {
          'nacs-contributions': {
            primary: {
              path: 'feature-a',
              exportName: 'R',
              title: 'A',
              icon: 'x',
            },
            extensions: {
              'lifecycle:user.logout': [
                { exportName: 'featureALogoutHandler' },
              ],
            },
          },
        },
      ) as ReturnType<typeof resolvePackageJson>,
    );

    // shell-lifecycle: always-active lib with lifecycle-hook extension points
    mockReadPackageJson.mockImplementation((pkgDir?: string) => {
      if (String(pkgDir).includes('shell-lifecycle')) {
        return {
          name: '@nacs/shell-lifecycle',
          'nacs-contributions': {
            extensionPoints: {
              'lifecycle:user.logout': {
                itemType: 'lifecycle-hook',
                tokenExportName: 'LOGOUT_HANDLERS',
              },
            },
          },
        } as any;
      }
      return makeRootPkg();
    });

    mockFs.existsSync.mockReturnValue(true);

    runPrepareBuild('test', ROOT);

    const [, collectedExtPoints] = mockEmitComposition.mock.calls[0];
    const logoutExt = collectedExtPoints.find(
      (e: any) => e.name === 'lifecycle:user.logout',
    );
    expect(logoutExt).toBeDefined();
    expect(logoutExt!.kind).toBe('lifecycle-hook');
    expect(logoutExt!.contributions).toHaveLength(1);
    expect(logoutExt!.contributions[0].item.exportName).toBe(
      'featureALogoutHandler',
    );
    expect(logoutExt!.contributions[0].importPath).toBe('@nacs/feature-a');
  });

  it('generates correct varName for colon/dot-separated extension point names', () => {
    mockReadJsonFile.mockImplementation((filePath: string) => {
      if (filePath.includes('tsconfig.base.json')) {
        return {
          compilerOptions: {
            paths: {
              '@nacs/feature-a': ['libs/feature-a/src/index.ts'],
              '@nacs/shell-lifecycle': ['libs/shell-lifecycle/src/index.ts'],
            },
          },
        };
      }
      return makeClientConfig([{ module: '@nacs/feature-a' }]);
    });

    mockResolvePackageJson.mockReturnValue(
      makeFeaturePkg('@nacs/feature-a', {
        path: 'feature-a',
        exportName: 'R',
        title: 'A',
        icon: 'x',
      }) as ReturnType<typeof resolvePackageJson>,
    );

    mockReadPackageJson.mockImplementation((pkgDir?: string) => {
      if (String(pkgDir).includes('shell-lifecycle')) {
        return {
          name: '@nacs/shell-lifecycle',
          'nacs-contributions': {
            extensionPoints: {
              'lifecycle:user.logout': {
                itemType: 'lifecycle-hook',
                tokenExportName: 'LOGOUT_HANDLERS',
              },
            },
          },
        } as any;
      }
      return makeRootPkg();
    });

    mockFs.existsSync.mockReturnValue(true);

    runPrepareBuild('test', ROOT);

    const [, collectedExtPoints] = mockEmitComposition.mock.calls[0];
    const logoutExt = collectedExtPoints.find(
      (e: any) => e.name === 'lifecycle:user.logout',
    );
    expect(logoutExt).toBeDefined();
    expect(logoutExt!.varName).toBe('extLifecycleUserLogout');
  });

  it('collects lazy-component contributions from features that contribute to a lazy ext point', () => {
    mockReadJsonFile.mockImplementation((filePath: string) => {
      if (filePath.includes('tsconfig.base.json')) {
        return { compilerOptions: { paths: {} } };
      }
      return makeClientConfig([
        { module: '@nacs/shell-nav' },
        { module: '@nacs/feature-a' },
      ]);
    });

    mockResolvePackageJson.mockImplementation((module: string) => {
      if (module === '@nacs/shell-nav') {
        return {
          name: '@nacs/shell-nav',
          'nacs-contributions': {
            primary: {
              path: 'nav',
              exportName: 'N',
              title: 'Nav',
              icon: 'nav',
            },
            extensionPoints: {
              'nav-badge': {
                itemType: 'lazy-component',
                tokenExportName: 'NAV_BADGES',
              },
            },
          },
        } as any;
      }
      return {
        name: '@nacs/feature-a',
        'nacs-contributions': {
          primary: {
            path: 'feature-a',
            exportName: 'R',
            title: 'A',
            icon: 'x',
          },
          extensions: {
            'nav-badge': [
              {
                exportName: 'FeatureABadge',
                title: 'Feature A Badge',
                icon: 'badge',
              },
            ],
          },
        },
      } as any;
    });

    runPrepareBuild('test', ROOT);

    const [, collectedExtPoints] = mockEmitComposition.mock.calls[0];
    const badgeExt = collectedExtPoints.find(
      (e: any) => e.name === 'nav-badge',
    );
    expect(badgeExt).toBeDefined();
    expect(badgeExt!.kind).toBe('lazy-component');
    expect(badgeExt!.contributions).toHaveLength(1);
    expect(badgeExt!.contributions[0].item.exportName).toBe('FeatureABadge');
  });
});

// ---------------------------------------------------------------------------
// isAlreadyInstalled — corrupted cached package.json
// ---------------------------------------------------------------------------
describe('runPrepareBuild — cache read errors', () => {
  beforeEach(() => {
    mockReadJsonFile.mockImplementation((filePath: string) => {
      if (filePath.includes('tsconfig.base.json')) {
        return { compilerOptions: { paths: {} } };
      }
      return makeClientConfig([
        { module: '@nacs/feature-a', version: '1.0.0' },
      ]);
    });
  });

  it('treats corrupted cached package.json as not installed and proceeds with install', () => {
    mockFs.existsSync.mockReturnValue(true);
    // readFileSync returns invalid JSON for the cached package, valid JSON for others
    mockFs.readFileSync.mockImplementation((p) => {
      if (String(p).includes('node_modules')) return 'not valid json {{';
      return '{}';
    });
    mockExecFileSync.mockReturnValue('installed' as any);
    mockResolvePackageJson.mockReturnValue(
      makeFeaturePkg('@nacs/feature-a', {
        path: 'feature-a',
        exportName: 'R',
        title: 'A',
        icon: 'x',
      }) as ReturnType<typeof resolvePackageJson>,
    );

    runPrepareBuild('test', ROOT);

    // Should have attempted install because cache read failed → treated as not installed
    expect(mockExecFileSync).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// installVersionedPackages — stderr fallback when thrown error has no stderr
// ---------------------------------------------------------------------------
describe('runPrepareBuild — install error without stderr property', () => {
  beforeEach(() => {
    mockReadJsonFile.mockImplementation((filePath: string) => {
      if (filePath.includes('tsconfig.base.json')) {
        return { compilerOptions: { paths: {} } };
      }
      return makeClientConfig([
        { module: '@nacs/feature-a', version: '1.0.0' },
      ]);
    });
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p).includes('node_modules')) return false;
      return true;
    });
  });

  it('throws BuildPreparationError when thrown error has no stderr property', () => {
    // Throw a plain Error (no `.stderr`) — exercises the `?? ''` fallback
    mockExecFileSync.mockImplementation(() => {
      throw new Error('plain error, no stderr');
    });
    mockResolvePackageJson.mockReturnValue(
      makeFeaturePkg('@nacs/feature-a', {
        path: 'feature-a',
        exportName: 'R',
        title: 'A',
        icon: 'x',
      }) as ReturnType<typeof resolvePackageJson>,
    );

    expect(() => runPrepareBuild('test', ROOT)).toThrow(BuildPreparationError);
  });
});

// ---------------------------------------------------------------------------
// Governance — versioned feature in error message + non-coercible version
// ---------------------------------------------------------------------------
describe('runPrepareBuild — governance edge cases', () => {
  it('includes @version in governance error message for versioned features', () => {
    mockReadJsonFile.mockImplementation((filePath: string) => {
      if (filePath.includes('tsconfig.base.json')) {
        return { compilerOptions: { paths: {} } };
      }
      return makeClientConfig([
        { module: '@nacs/feature-a', version: '2.0.0' },
      ]);
    });
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify({ version: '2.0.0' }));
    mockReadPackageJson.mockReturnValue(
      makeRootPkg({ '@angular/core': '~21.2.0' }),
    );
    mockResolvePackageJson.mockReturnValue({
      name: '@nacs/feature-a',
      'nacs-contributions': {
        primary: { path: 'feature-a', exportName: 'R', title: 'A', icon: 'x' },
      },
      peerDependencies: { '@angular/core': '>=22.0.0' },
    } as any);

    try {
      runPrepareBuild('test', ROOT);
      fail('expected NacsGovernanceError');
    } catch (e) {
      expect(e).toBeInstanceOf(NacsGovernanceError);
      // The ternary `feature.version ? \`@${feature.version}\`` branch
      expect((e as Error).message).toContain('@2.0.0');
    }
  });

  it('skips semver satisfies check when coerce returns null', () => {
    // A version string that semver.coerce cannot parse → cleanProvided is null
    // → the `if (cleanProvided && ...)` branch is false → no violation for that dep
    mockReadJsonFile.mockImplementation((filePath: string) => {
      if (filePath.includes('tsconfig.base.json')) {
        return { compilerOptions: { paths: {} } };
      }
      return makeClientConfig([{ module: '@nacs/feature-a' }]);
    });
    mockReadPackageJson.mockReturnValue(
      makeRootPkg({ '@angular/core': 'not-a-semver-string' }),
    );
    mockResolvePackageJson.mockReturnValue({
      name: '@nacs/feature-a',
      'nacs-contributions': {
        primary: { path: 'feature-a', exportName: 'R', title: 'A', icon: 'x' },
      },
      peerDependencies: { '@angular/core': '>=21.0.0' },
    } as any);

    // Should NOT throw governance error — uncoercible provided version is skipped
    expect(() => runPrepareBuild('test', ROOT)).not.toThrow(
      NacsGovernanceError,
    );
  });
});

// ---------------------------------------------------------------------------
// Extension point deduplication + tsconfig with no paths
// ---------------------------------------------------------------------------
describe('runPrepareBuild — extension point edge cases', () => {
  it('deduplicates ext points when two config features declare the same name', () => {
    mockReadJsonFile.mockImplementation((filePath: string) => {
      if (filePath.includes('tsconfig.base.json')) {
        return { compilerOptions: { paths: {} } };
      }
      return makeClientConfig([
        { module: '@nacs/feature-a' },
        { module: '@nacs/feature-b' },
      ]);
    });
    // Both features declare the same "admin" ext point — second should be ignored
    mockResolvePackageJson.mockImplementation(
      (module: string) =>
        ({
          name: module,
          'nacs-contributions': {
            primary: {
              path: module,
              exportName: 'R',
              title: module,
              icon: 'x',
            },
            extensionPoints: { admin: { itemType: 'route' } },
          },
        }) as any,
    );

    runPrepareBuild('test', ROOT);

    const [, collectedExtPoints] = mockEmitComposition.mock.calls[0];
    const adminExts = collectedExtPoints.filter((e: any) => e.name === 'admin');
    // Should only appear once despite two features declaring it
    expect(adminExts).toHaveLength(1);
    // First declarer wins
    expect(adminExts[0].contributions[0]).toBeUndefined();
  });

  it('handles tsconfig with no compilerOptions.paths (uses empty object fallback)', () => {
    mockReadJsonFile.mockImplementation((filePath: string) => {
      if (filePath.includes('tsconfig.base.json')) {
        // No paths at all — exercises the `?? {}` branch
        return { compilerOptions: {} };
      }
      return makeClientConfig([{ module: '@nacs/feature-a' }]);
    });
    mockResolvePackageJson.mockReturnValue(
      makeFeaturePkg('@nacs/feature-a', {
        path: 'feature-a',
        exportName: 'R',
        title: 'A',
        icon: 'x',
      }) as ReturnType<typeof resolvePackageJson>,
    );

    // Should complete without error — no always-active libs to discover
    expect(() => runPrepareBuild('test', ROOT)).not.toThrow();
    expect(mockEmitComposition).toHaveBeenCalledTimes(1);
  });

  it('skips always-active lib when its package.json does not exist on disk', () => {
    mockReadJsonFile.mockImplementation((filePath: string) => {
      if (filePath.includes('tsconfig.base.json')) {
        return {
          compilerOptions: {
            paths: {
              '@nacs/feature-a': ['libs/feature-a/src/index.ts'],
              '@nacs/ghost-lib': ['libs/ghost-lib/src/index.ts'],
            },
          },
        };
      }
      return makeClientConfig([{ module: '@nacs/feature-a' }]);
    });
    mockResolvePackageJson.mockReturnValue(
      makeFeaturePkg('@nacs/feature-a', {
        path: 'feature-a',
        exportName: 'R',
        title: 'A',
        icon: 'x',
      }) as ReturnType<typeof resolvePackageJson>,
    );
    // ghost-lib has no package.json on disk — exercises the `continue` branch
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p).includes('ghost-lib')) return false;
      return true;
    });

    expect(() => runPrepareBuild('test', ROOT)).not.toThrow();
    expect(mockEmitComposition).toHaveBeenCalledTimes(1);
  });

  it('collects value extension contributions from features', () => {
    mockReadJsonFile.mockImplementation((filePath: string) => {
      if (filePath.includes('tsconfig.base.json')) {
        return {
          compilerOptions: {
            paths: {
              '@nacs/feature-a': ['libs/feature-a/src/index.ts'],
              '@nacs/feature-b': ['libs/feature-b/src/index.ts'],
              '@nacs/shell-help': ['libs/shell-help/src/index.ts'],
            },
          },
        };
      }
      return makeClientConfig([
        { module: '@nacs/feature-a' },
        { module: '@nacs/feature-b' },
      ]);
    });

    mockResolvePackageJson.mockImplementation((module: string) => {
      if (module === '@nacs/feature-a') {
        return {
          name: '@nacs/feature-a',
          'nacs-contributions': {
            primary: {
              path: 'feature-a',
              exportName: 'R',
              title: 'A',
              icon: 'x',
            },
            extensions: {
              'help-topic': [
                {
                  id: 'feature-a-overview',
                  title: 'Analytics',
                  category: 'Analytics',
                },
              ],
            },
          },
        } as any;
      }
      return {
        name: '@nacs/feature-b',
        'nacs-contributions': {
          primary: {
            path: 'feature-b',
            exportName: 'S',
            title: 'B',
            icon: 'y',
          },
          extensions: {
            'help-topic': [
              {
                id: 'feature-b-overview',
                title: 'Messaging',
                category: 'Communication',
              },
            ],
          },
        },
      } as any;
    });

    // shell-help: always-active lib with value extension point
    mockReadPackageJson.mockImplementation((pkgDir?: string) => {
      if (String(pkgDir).includes('shell-help')) {
        return {
          name: '@nacs/shell-help',
          'nacs-contributions': {
            extensionPoints: {
              'help-topic': {
                itemType: 'value',
                tokenExportName: 'HELP_TOPICS',
              },
            },
          },
        } as any;
      }
      return makeRootPkg();
    });

    mockFs.existsSync.mockReturnValue(true);

    runPrepareBuild('test', ROOT);

    const [, collectedExtPoints] = mockEmitComposition.mock.calls[0];
    const helpExt = collectedExtPoints.find(
      (e: any) => e.name === 'help-topic',
    );
    expect(helpExt).toBeDefined();
    expect(helpExt!.kind).toBe('value');
    expect(helpExt!.contributions).toHaveLength(2);
    expect(helpExt!.contributions[0].item).toMatchObject({
      id: 'feature-a-overview',
    });
    expect(helpExt!.contributions[1].item).toMatchObject({
      id: 'feature-b-overview',
    });
    expect((helpExt as any).consumerImportPath).toBe('@nacs/shell-help');
  });

  it('skips always-active lib that has a primary contribution (config-driven feature)', () => {
    mockReadJsonFile.mockImplementation((filePath: string) => {
      if (filePath.includes('tsconfig.base.json')) {
        return {
          compilerOptions: {
            paths: {
              '@nacs/feature-a': ['libs/feature-a/src/index.ts'],
              '@nacs/feature-b': ['libs/feature-b/src/index.ts'],
            },
          },
        };
      }
      // Only feature-a is in the client config; feature-b is workspace-only
      return makeClientConfig([{ module: '@nacs/feature-a' }]);
    });
    mockResolvePackageJson.mockReturnValue(
      makeFeaturePkg('@nacs/feature-a', {
        path: 'feature-a',
        exportName: 'R',
        title: 'A',
        icon: 'x',
      }) as ReturnType<typeof resolvePackageJson>,
    );
    // feature-b has a primary — it's a feature lib, should be skipped in always-active discovery
    mockReadPackageJson.mockImplementation((pkgDir?: string) => {
      if (String(pkgDir).includes('feature-b')) {
        return {
          name: '@nacs/feature-b',
          'nacs-contributions': {
            primary: {
              path: 'feature-b',
              exportName: 'S',
              title: 'B',
              icon: 'y',
            },
          },
        } as any;
      }
      return makeRootPkg();
    });
    mockFs.existsSync.mockReturnValue(true);

    runPrepareBuild('test', ROOT);

    // feature-b should have been skipped — its ext points (none here) should not be added.
    // The only ext point present is the always-registered built-in nacs:app-initializer.
    const [, collectedExtPoints] = mockEmitComposition.mock.calls[0];
    expect(collectedExtPoints).toHaveLength(1);
    expect(collectedExtPoints[0].name).toBe('nacs:app-initializer');
  });

  it('collects nacs:app-initializer contributions as a built-in (no consumer lib required)', () => {
    // No consumer lib declares 'nacs:app-initializer' — it is always registered by prepare-build.
    // Features contribute to it using the canonical key 'nacs:app-initializer'.
    mockReadJsonFile.mockImplementation((filePath: string) => {
      if (filePath.includes('tsconfig.base.json')) {
        return {
          compilerOptions: {
            paths: {
              '@nacs/feature-a': ['libs/feature-a/src/index.ts'],
              '@nacs/feature-b': ['libs/feature-b/src/index.ts'],
            },
          },
        };
      }
      return makeClientConfig([
        { module: '@nacs/feature-a' },
        { module: '@nacs/feature-b' },
      ]);
    });

    mockResolvePackageJson.mockImplementation((module: string) => {
      if (module === '@nacs/feature-a') {
        return {
          name: '@nacs/feature-a',
          'nacs-contributions': {
            primary: {
              path: 'feature-a',
              exportName: 'R',
              title: 'A',
              icon: 'x',
            },
            extensions: {
              'nacs:app-initializer': [{ exportName: 'featureAInitializer' }],
            },
          },
        } as any;
      }
      return {
        name: '@nacs/feature-b',
        'nacs-contributions': {
          primary: {
            path: 'feature-b',
            exportName: 'S',
            title: 'B',
            icon: 'y',
          },
          extensions: {
            'nacs:app-initializer': [{ exportName: 'featureBInitializer' }],
          },
        },
      } as any;
    });

    runPrepareBuild('test', ROOT);

    const [, collectedExtPoints] = mockEmitComposition.mock.calls[0];
    const initExt = collectedExtPoints.find(
      (e: any) => e.name === 'nacs:app-initializer',
    );
    expect(initExt).toBeDefined();
    expect(initExt!.kind).toBe('initializer');
    expect(initExt!.contributions).toHaveLength(2);
    expect(initExt!.contributions[0].item.exportName).toBe(
      'featureAInitializer',
    );
    expect(initExt!.contributions[1].item.exportName).toBe(
      'featureBInitializer',
    );
    expect(initExt!.contributions[0].importPath).toBe('@nacs/feature-a');
    expect(initExt!.contributions[1].importPath).toBe('@nacs/feature-b');
  });

  it('always registers nacs:app-initializer built-in even when no feature contributes to it', () => {
    mockResolvePackageJson.mockReturnValue(
      makeFeaturePkg('@nacs/feature-a', {
        path: 'feature-a',
        exportName: 'R',
        title: 'A',
        icon: 'x',
      }) as ReturnType<typeof resolvePackageJson>,
    );

    runPrepareBuild('test', ROOT);

    const [, collectedExtPoints] = mockEmitComposition.mock.calls[0];
    const initExt = collectedExtPoints.find(
      (e: any) => e.name === 'nacs:app-initializer',
    );
    expect(initExt).toBeDefined();
    expect(initExt!.kind).toBe('initializer');
    expect(initExt!.contributions).toHaveLength(0);
  });
});
