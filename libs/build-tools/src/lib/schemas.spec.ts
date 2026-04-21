import {
  BuildPreparationError,
  NacsGovernanceError,
  NacsPrimaryContributionSchema,
  ComponentExtensionItemSchema,
  LifecycleHookItemSchema,
  ExtensionPointDescriptorSchema,
  NacsContributionsSchema,
  NacsPackageJsonSchema,
  ClientConfigSchema,
  FeatureConfigSchema,
  TsconfigBaseSchema,
  validateNacsPackageJson,
  validateClientConfig,
  validateTsconfigBase,
} from './schemas';

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------
describe('BuildPreparationError', () => {
  it('sets name and message', () => {
    const err = new BuildPreparationError('boom');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('BuildPreparationError');
    expect(err.message).toBe('boom');
  });
});

describe('NacsGovernanceError', () => {
  it('sets name and message', () => {
    const err = new NacsGovernanceError('gov fail');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('NacsGovernanceError');
    expect(err.message).toBe('gov fail');
  });
});

// ---------------------------------------------------------------------------
// NacsPrimaryContributionSchema
// ---------------------------------------------------------------------------
describe('NacsPrimaryContributionSchema', () => {
  const valid = { path: 'feature-a', exportName: 'ROUTES', icon: 'home' };

  it('accepts valid input with optional title', () => {
    expect(NacsPrimaryContributionSchema.parse(valid)).toEqual(valid);
  });

  it('accepts input with title', () => {
    const withTitle = { ...valid, title: 'Feature A' };
    expect(NacsPrimaryContributionSchema.parse(withTitle)).toEqual(withTitle);
  });

  it('rejects missing path', () => {
    expect(() =>
      NacsPrimaryContributionSchema.parse({ exportName: 'R', icon: 'x' }),
    ).toThrow();
  });

  it('rejects missing exportName', () => {
    expect(() =>
      NacsPrimaryContributionSchema.parse({ path: 'a', icon: 'x' }),
    ).toThrow();
  });

  it('rejects missing icon', () => {
    expect(() =>
      NacsPrimaryContributionSchema.parse({ path: 'a', exportName: 'R' }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// ComponentExtensionItemSchema
// ---------------------------------------------------------------------------
describe('ComponentExtensionItemSchema', () => {
  const valid = {
    exportName: 'MyWidget',
    title: 'Widget',
    icon: 'dashboard',
  };

  it('accepts valid input', () => {
    expect(ComponentExtensionItemSchema.parse(valid)).toEqual(valid);
  });

  it('accepts optional routePath', () => {
    const withRoute = { ...valid, routePath: '/dashboard' };
    expect(ComponentExtensionItemSchema.parse(withRoute)).toEqual(withRoute);
  });

  it('rejects missing title', () => {
    expect(() =>
      ComponentExtensionItemSchema.parse({
        exportName: 'X',
        icon: 'x',
      }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// LifecycleHookItemSchema
// ---------------------------------------------------------------------------
describe('LifecycleHookItemSchema', () => {
  it('accepts valid input with exportName only', () => {
    const input = { exportName: 'myLogoutHandler' };
    expect(LifecycleHookItemSchema.parse(input)).toEqual(input);
  });

  it('rejects missing exportName', () => {
    expect(() => LifecycleHookItemSchema.parse({})).toThrow();
  });

  it('strips unknown fields', () => {
    const input = { exportName: 'handler', title: 'should be stripped' };
    const result = LifecycleHookItemSchema.parse(input);
    expect(result).toEqual({ exportName: 'handler' });
    expect((result as Record<string, unknown>)['title']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// ExtensionPointDescriptorSchema (discriminated union)
// ---------------------------------------------------------------------------
describe('ExtensionPointDescriptorSchema', () => {
  it('accepts component itemType with required fields', () => {
    const input = {
      itemType: 'component',
      tokenExportName: 'TOKEN',
      itemTypeName: 'WidgetItem',
    };
    expect(ExtensionPointDescriptorSchema.parse(input)).toEqual(input);
  });

  it('rejects component itemType missing itemTypeName', () => {
    expect(() =>
      ExtensionPointDescriptorSchema.parse({
        itemType: 'component',
        tokenExportName: 'TOKEN',
      }),
    ).toThrow();
  });

  it('accepts lazy-component with optional itemTypeName', () => {
    const input = {
      itemType: 'lazy-component',
      tokenExportName: 'LAZY_TOKEN',
    };
    expect(ExtensionPointDescriptorSchema.parse(input)).toEqual(input);
  });

  it('accepts route with all optional fields', () => {
    const input = { itemType: 'route' };
    expect(ExtensionPointDescriptorSchema.parse(input)).toEqual(input);
  });

  it('accepts lifecycle-hook with required tokenExportName', () => {
    const input = {
      itemType: 'lifecycle-hook',
      tokenExportName: 'LOGOUT_HANDLERS',
    };
    expect(ExtensionPointDescriptorSchema.parse(input)).toEqual(input);
  });

  it('rejects lifecycle-hook missing tokenExportName', () => {
    expect(() =>
      ExtensionPointDescriptorSchema.parse({ itemType: 'lifecycle-hook' }),
    ).toThrow();
  });

  it('rejects unknown itemType', () => {
    expect(() =>
      ExtensionPointDescriptorSchema.parse({ itemType: 'unknown' }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// NacsContributionsSchema
// ---------------------------------------------------------------------------
describe('NacsContributionsSchema', () => {
  it('accepts empty object', () => {
    expect(NacsContributionsSchema.parse({})).toEqual({});
  });

  it('accepts primary with extension points and extensions', () => {
    const input = {
      primary: {
        path: 'a',
        exportName: 'R',
        icon: 'x',
      },
      extensionPoints: {
        admin: { itemType: 'route' as const },
      },
      extensions: {
        admin: [{ path: '/admin', exportName: 'AdminRoutes', icon: 'admin' }],
      },
    };
    expect(() => NacsContributionsSchema.parse(input)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// NacsPackageJsonSchema
// ---------------------------------------------------------------------------
describe('NacsPackageJsonSchema', () => {
  it('accepts minimal package.json with name only', () => {
    expect(NacsPackageJsonSchema.parse({ name: '@nacs/feature-a' })).toEqual({
      name: '@nacs/feature-a',
    });
  });

  it('rejects missing name', () => {
    expect(() => NacsPackageJsonSchema.parse({})).toThrow();
  });
});

// ---------------------------------------------------------------------------
// ClientConfigSchema
// ---------------------------------------------------------------------------
describe('ClientConfigSchema', () => {
  it('accepts valid config', () => {
    const input = {
      clientId: 'dev',
      features: [{ module: '@nacs/feature-a' }],
    };
    expect(ClientConfigSchema.parse(input)).toEqual(input);
  });

  it('accepts features with version and overrides', () => {
    const input = {
      clientId: 'prod',
      features: [
        {
          module: '@nacs/feature-a',
          version: '1.2.3',
          overrides: { title: 'Custom', icon: 'star' },
        },
      ],
    };
    expect(ClientConfigSchema.parse(input)).toEqual(input);
  });

  it('rejects missing clientId', () => {
    expect(() =>
      ClientConfigSchema.parse({ features: [{ module: 'x' }] }),
    ).toThrow();
  });

  it('rejects missing features array', () => {
    expect(() => ClientConfigSchema.parse({ clientId: 'x' })).toThrow();
  });

  it('rejects feature missing module', () => {
    expect(() =>
      ClientConfigSchema.parse({
        clientId: 'x',
        features: [{ version: '1.0.0' }],
      }),
    ).toThrow();
  });

  it('accepts optional defaultRoute', () => {
    const input = {
      clientId: 'dev',
      features: [{ module: '@nacs/feature-a' }],
      defaultRoute: 'feature-a',
    };
    expect(ClientConfigSchema.parse(input)).toEqual(input);
  });

  it('accepts config without defaultRoute', () => {
    const input = {
      clientId: 'dev',
      features: [{ module: '@nacs/feature-a' }],
    };
    const result = ClientConfigSchema.parse(input);
    expect(result.defaultRoute).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// TsconfigBaseSchema
// ---------------------------------------------------------------------------
describe('TsconfigBaseSchema', () => {
  it('accepts empty object', () => {
    expect(TsconfigBaseSchema.parse({})).toEqual({});
  });

  it('accepts paths mapping', () => {
    const input = {
      compilerOptions: {
        paths: { '@nacs/feature-a': ['libs/feature-a/src/index.ts'] },
      },
    };
    expect(TsconfigBaseSchema.parse(input)).toEqual(input);
  });
});

// ---------------------------------------------------------------------------
// validateNacsPackageJson
// ---------------------------------------------------------------------------
describe('validateNacsPackageJson', () => {
  it('returns parsed data for valid input', () => {
    const raw = {
      name: '@nacs/feature-a',
      'nacs-contributions': {
        primary: { path: 'a', exportName: 'R', icon: 'x', title: 'A' },
      },
    };
    expect(validateNacsPackageJson(raw, 'test.json')).toEqual(raw);
  });

  it('throws BuildPreparationError with source on invalid input', () => {
    expect(() => validateNacsPackageJson({}, 'bad.json')).toThrow(
      BuildPreparationError,
    );
    try {
      validateNacsPackageJson({}, 'bad.json');
    } catch (e) {
      expect((e as Error).message).toContain('bad.json');
    }
  });

  it('includes field path in error message', () => {
    try {
      validateNacsPackageJson({ name: 123 }, 'num-name.json');
    } catch (e) {
      expect((e as Error).message).toContain('num-name.json');
    }
  });
});

// ---------------------------------------------------------------------------
// validateClientConfig
// ---------------------------------------------------------------------------
describe('validateClientConfig', () => {
  it('returns parsed data for valid config', () => {
    const raw = { clientId: 'dev', features: [{ module: '@nacs/feature-a' }] };
    expect(validateClientConfig(raw, 'cfg.json')).toEqual(raw);
  });

  it('throws BuildPreparationError on invalid config', () => {
    expect(() => validateClientConfig({}, 'bad-cfg.json')).toThrow(
      BuildPreparationError,
    );
  });

  it('includes source path in error message', () => {
    try {
      validateClientConfig({}, 'path/to/cfg.json');
    } catch (e) {
      expect((e as Error).message).toContain('path/to/cfg.json');
    }
  });
});

// ---------------------------------------------------------------------------
// validateTsconfigBase
// ---------------------------------------------------------------------------
describe('validateTsconfigBase', () => {
  it('returns parsed data for valid tsconfig', () => {
    const raw = { compilerOptions: { paths: { '@a/b': ['libs/b/index.ts'] } } };
    expect(validateTsconfigBase(raw, 'tsconfig.json')).toEqual(raw);
  });

  it('throws BuildPreparationError on invalid tsconfig', () => {
    // paths expects Record<string, string[]> — passing a number should fail
    expect(() =>
      validateTsconfigBase(
        { compilerOptions: { paths: { '@a/b': 'not-array' } } },
        'bad-ts.json',
      ),
    ).toThrow(BuildPreparationError);
  });
});
