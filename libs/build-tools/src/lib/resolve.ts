import * as fs from 'fs';
import * as path from 'path';
import { readJsonFile } from '@nx/devkit';
import { readPackageJson } from '@nx/workspace';
import {
  validateNacsPackageJson,
  validateTsconfigBase,
  type NacsPackageJson,
} from './schemas';

export function resolvePackageJson(
  module: string,
  alias: string,
  root: string,
  version?: string,
): NacsPackageJson {
  let pkgDir: string;
  if (version) {
    // Versioned: package was installed as an alias under node_modules
    pkgDir = path.join(root, 'node_modules', alias);
  } else {
    // Local: resolve via tsconfig.base.json compilerOptions.paths
    const tsconfigPath = path.join(root, 'tsconfig.base.json');
    const tsconfig = validateTsconfigBase(readJsonFile(tsconfigPath), tsconfigPath);
    const modulePaths = tsconfig.compilerOptions?.paths?.[module];
    if (!modulePaths || modulePaths.length === 0) {
      console.error(
        `❌ Cannot resolve local path for module: ${module}\n` +
          `   Ensure it is listed in tsconfig.base.json compilerOptions.paths.`,
      );
      process.exit(1);
    }
    // modulePaths[0] is e.g. "libs/feature-a/src/index.ts"
    // dirname twice: src/index.ts → src → libs/feature-a (the package root)
    pkgDir = path.join(root, path.dirname(path.dirname(modulePaths[0])));
  }

  if (!fs.existsSync(pkgDir)) {
    console.error(`❌ Package directory not found: ${pkgDir}`);
    process.exit(1);
  }

  return validateNacsPackageJson(readPackageJson(pkgDir), `${module} (${pkgDir})`);
}
