import * as fs from 'fs';
import { readJsonFile } from '@nx/devkit';
import { readPackageJson } from '@nx/workspace';
import { resolvePackageJson } from './resolve';
import { BuildPreparationError } from './schemas';

jest.mock('fs');
jest.mock('@nx/devkit', () => ({ readJsonFile: jest.fn() }));
jest.mock('@nx/workspace', () => ({ readPackageJson: jest.fn() }));

const mockFs = jest.mocked(fs);
const mockReadJsonFile = jest.mocked(readJsonFile);
const mockReadPackageJson = jest.mocked(readPackageJson);

const ROOT = '/workspace';

beforeEach(() => jest.clearAllMocks());

describe('resolvePackageJson', () => {
  describe('versioned packages (version provided)', () => {
    it('resolves from node_modules alias directory', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockReadPackageJson.mockReturnValue({
        name: '@nacs/feature-a-1.0.0',
      } as ReturnType<typeof readPackageJson>);

      const result = resolvePackageJson(
        '@nacs/feature-a',
        '@nacs/feature-a-1.0.0',
        ROOT,
        '1.0.0',
      );
      expect(result).toEqual({ name: '@nacs/feature-a-1.0.0' });
      expect(mockReadPackageJson).toHaveBeenCalledWith(
        '/workspace/node_modules/@nacs/feature-a-1.0.0',
      );
    });

    it('throws when alias directory does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);
      expect(() =>
        resolvePackageJson('@nacs/feature-a', 'alias', ROOT, '1.0.0'),
      ).toThrow(BuildPreparationError);
    });
  });

  describe('local packages (no version)', () => {
    it('resolves via tsconfig.base.json paths', () => {
      mockReadJsonFile.mockReturnValue({
        compilerOptions: {
          paths: {
            '@nacs/feature-a': ['libs/feature-a/src/index.ts'],
          },
        },
      });
      mockFs.existsSync.mockReturnValue(true);
      mockReadPackageJson.mockReturnValue({
        name: '@nacs/feature-a',
      } as ReturnType<typeof readPackageJson>);

      const result = resolvePackageJson(
        '@nacs/feature-a',
        '@nacs/feature-a',
        ROOT,
      );
      expect(result).toEqual({ name: '@nacs/feature-a' });
      expect(mockReadPackageJson).toHaveBeenCalledWith(
        '/workspace/libs/feature-a',
      );
    });

    it('throws when module not in tsconfig paths', () => {
      mockReadJsonFile.mockReturnValue({
        compilerOptions: { paths: {} },
      });
      expect(() =>
        resolvePackageJson('@nacs/unknown', '@nacs/unknown', ROOT),
      ).toThrow(BuildPreparationError);
    });

    it('throws when tsconfig paths array is empty', () => {
      mockReadJsonFile.mockReturnValue({
        compilerOptions: { paths: { '@nacs/feature-a': [] } },
      });
      expect(() =>
        resolvePackageJson('@nacs/feature-a', '@nacs/feature-a', ROOT),
      ).toThrow(BuildPreparationError);
    });

    it('throws when resolved package directory does not exist', () => {
      mockReadJsonFile.mockReturnValue({
        compilerOptions: {
          paths: { '@nacs/feature-a': ['libs/feature-a/src/index.ts'] },
        },
      });
      mockFs.existsSync.mockReturnValue(false);

      expect(() =>
        resolvePackageJson('@nacs/feature-a', '@nacs/feature-a', ROOT),
      ).toThrow(BuildPreparationError);
    });
  });

  describe('package.json validation', () => {
    it('throws when package.json fails nacs schema validation', () => {
      mockReadJsonFile.mockReturnValue({
        compilerOptions: {
          paths: { '@nacs/bad': ['libs/bad/src/index.ts'] },
        },
      });
      mockFs.existsSync.mockReturnValue(true);
      // name is required — returning an empty object causes validation failure
      mockReadPackageJson.mockReturnValue(
        {} as ReturnType<typeof readPackageJson>,
      );

      expect(() =>
        resolvePackageJson('@nacs/bad', '@nacs/bad', ROOT),
      ).toThrow(BuildPreparationError);
    });
  });
});
