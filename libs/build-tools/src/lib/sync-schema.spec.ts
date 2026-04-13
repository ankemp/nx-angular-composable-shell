import * as fs from 'fs';
import { globSync } from 'glob';
import { buildNacsSchemaJson, runSyncSchema, NACS_SCHEMA_OUTPUT_PATH } from './sync-schema';

jest.mock('fs');
jest.mock('glob');

const mockFs = jest.mocked(fs);
const mockGlobSync = jest.mocked(globSync);

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// buildNacsSchemaJson (pure computation)
// ---------------------------------------------------------------------------
describe('buildNacsSchemaJson', () => {
  it('returns valid JSON', () => {
    mockGlobSync.mockReturnValue([] as unknown as ReturnType<typeof globSync>);
    const result = buildNacsSchemaJson('/root');
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it('includes schemastore $ref', () => {
    mockGlobSync.mockReturnValue([] as unknown as ReturnType<typeof globSync>);
    const schema = JSON.parse(buildNacsSchemaJson('/root'));
    expect(schema.$ref).toBe('http://json.schemastore.org/package');
  });

  it('discovers extension points from package.json files', () => {
    mockGlobSync.mockReturnValue([
      'libs/core-admin/package.json',
    ] as unknown as ReturnType<typeof globSync>);
    mockFs.readFileSync.mockReturnValue(
      JSON.stringify({
        name: '@nacs/core-admin',
        'nacs-contributions': {
          extensionPoints: {
            admin: {
              itemType: 'route',
            },
          },
        },
      }),
    );

    const schema = JSON.parse(buildNacsSchemaJson('/root'));
    // The generated schema should reference the "admin" extension point
    const schemaStr = JSON.stringify(schema);
    expect(schemaStr).toContain('admin');
    expect(schemaStr).toContain('@nacs/core-admin');
  });

  it('handles packages without nacs-contributions', () => {
    mockGlobSync.mockReturnValue([
      'libs/some-lib/package.json',
    ] as unknown as ReturnType<typeof globSync>);
    mockFs.readFileSync.mockReturnValue(
      JSON.stringify({ name: '@nacs/some-lib' }),
    );

    expect(() => buildNacsSchemaJson('/root')).not.toThrow();
  });

  it('handles multiple extension points from different packages', () => {
    mockGlobSync.mockReturnValue([
      'libs/core-admin/package.json',
      'libs/shell-nav/package.json',
    ] as unknown as ReturnType<typeof globSync>);
    mockFs.readFileSync.mockImplementation((filePath) => {
      if (String(filePath).includes('core-admin')) {
        return JSON.stringify({
          name: '@nacs/core-admin',
          'nacs-contributions': {
            extensionPoints: { admin: { itemType: 'route' } },
          },
        });
      }
      return JSON.stringify({
        name: '@nacs/shell-nav',
        'nacs-contributions': {
          extensionPoints: {
            'nav-badge': {
              itemType: 'lazy-component',
              tokenExportName: 'NAV_BADGES',
            },
          },
        },
      });
    });

    const schemaStr = buildNacsSchemaJson('/root');
    expect(schemaStr).toContain('admin');
    expect(schemaStr).toContain('nav-badge');
  });
});

// ---------------------------------------------------------------------------
// runSyncSchema (integration — writes to disk)
// ---------------------------------------------------------------------------
describe('runSyncSchema', () => {
  it('writes schema file to expected path', () => {
    mockGlobSync.mockReturnValue([] as unknown as ReturnType<typeof globSync>);
    mockFs.writeFileSync.mockImplementation(() => undefined);

    runSyncSchema('/root');

    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      `/root/${NACS_SCHEMA_OUTPUT_PATH}`,
      expect.any(String),
    );
  });

  it('exports NACS_SCHEMA_OUTPUT_PATH constant', () => {
    expect(NACS_SCHEMA_OUTPUT_PATH).toBe(
      'libs/build-tools/nacs-package.schema.json',
    );
  });
});
