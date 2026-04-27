import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import * as semver from 'semver';
import { readJsonFile } from '@nx/devkit';
import { readPackageJson } from '@nx/workspace';
import {
  BuildPreparationError,
  NacsGovernanceError,
  validateClientConfig,
  validateTsconfigBase,
  validateNacsPackageJson,
  NacsPrimaryContributionSchema,
  ComponentExtensionItemSchema,
  LifecycleHookItemSchema,
  ValueItemSchema,
  InitializerItemSchema,
  type NacsPrimaryContribution,
  type ComponentExtensionItem,
  type LifecycleHookItem,
  type ValueItem,
  type InitializerItem,
  type ValidatedPrimaryContribution,
  type ExtensionPointDescriptor,
  type CollectedExtPoint,
  type ResolvedPrimaryFeature,
} from './schemas';
import { resolvePackageJson } from './resolve';
import { emitComposition } from './emit';

function isAlreadyInstalled(
  alias: string,
  expectedVersion: string,
  root: string,
): boolean {
  const pkgJsonPath = path.join(root, 'node_modules', alias, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) return false;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
    return pkg.version === expectedVersion;
  } catch {
    return false;
  }
}

function installVersionedPackages(
  packages: string[],
  root: string,
  retries = 2,
): void {
  const args = ['install', ...packages, '--no-save'];
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const output = execFileSync('npm', args, {
        cwd: root,
        encoding: 'utf-8',
        timeout: 120_000,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      console.log(output);
      return;
    } catch (err: unknown) {
      const stderr = (err as { stderr?: string }).stderr ?? '';
      if (attempt <= retries) {
        console.warn(
          `⚠️  npm install attempt ${attempt} failed, retrying...\n${stderr}`,
        );
      } else {
        throw new BuildPreparationError(
          `❌ Failed to install versioned packages after ${retries + 1} attempts:\n${stderr}`,
        );
      }
    }
  }
}

export function runPrepareBuild(client: string, root: string): void {
  const configPath = path.join(root, 'configs', `${client}.json`);
  const config = validateClientConfig(readJsonFile(configPath), configPath);

  // Read the Shell's root package.json to establish the platform state
  const rootPkg = readPackageJson(root);
  const shellDependencies = {
    ...rootPkg.dependencies,
    ...rootPkg.devDependencies,
  };

  console.log(`\n⚙️  Preparing build for: ${client}`);

  // Collect all versioned installs so they can be run in a single npm install
  // call. Running npm install --no-save once per package causes each invocation
  // to reconcile node_modules against package.json, removing packages installed
  // by previous --no-save calls. A single combined install avoids this.
  const versionedInstalls: {
    spec: string;
    alias: string;
    version: string;
    label: string;
  }[] = [];

  const importPaths = config.features.map((feature) => {
    if (feature.version) {
      const alias = `${feature.module}-${feature.version}`;
      versionedInstalls.push({
        spec: `${alias}@npm:${feature.module}@${feature.version}`,
        alias,
        version: feature.version,
        label: `${feature.module}@${feature.version}`,
      });
      return alias;
    }
    return feature.module;
  });

  if (versionedInstalls.length > 0) {
    console.log(`📦 Versioned packages:`);
    const toInstall = versionedInstalls.filter(({ alias, version, label }) => {
      const cached = isAlreadyInstalled(alias, version, root);
      console.log(
        cached
          ? `  ✅ ${label} — already installed`
          : `  📥 ${label} — installing from registry`,
      );
      return !cached;
    });

    if (toInstall.length > 0) {
      installVersionedPackages(
        toInstall.map((e) => e.spec),
        root,
      );
    }
  }

  // Discover contributions from each feature's package.json (post-install for versioned packages)
  const resolvedFeatures = importPaths.map((importPath, i) => {
    const feature = config.features[i];
    return {
      feature,
      importPath,
      pkg: resolvePackageJson(
        feature.module,
        importPath,
        root,
        feature.version,
      ),
    };
  });

  const resolvedPrimaryFeatures: ResolvedPrimaryFeature[] = [];

  for (const { feature, importPath, pkg } of resolvedFeatures) {
    // --- STRICT PEER DEPENDENCY GOVERNANCE ---
    const peers =
      (
        pkg as Record<string, unknown> & {
          peerDependencies?: Record<string, string>;
        }
      ).peerDependencies || {};
    const violations: string[] = [];

    for (const [dep, requiredRange] of Object.entries(peers)) {
      const providedVersion = shellDependencies[dep];

      if (!providedVersion) {
        violations.push(
          `  - ${dep}: Feature requires '${requiredRange}', but Shell does not provide it.`,
        );
        continue;
      }

      const cleanProvided = semver.coerce(providedVersion)?.version;
      if (cleanProvided && !semver.satisfies(cleanProvided, requiredRange)) {
        violations.push(
          `  - ${dep}: Feature requires '${requiredRange}', Shell provides '${providedVersion}'`,
        );
      }
    }

    if (violations.length > 0) {
      throw new NacsGovernanceError(
        `\n❌ NACS GOVERNANCE FAILURE: Version mismatch in ${feature.module}${feature.version ? `@${feature.version}` : ' (Local)'}\n` +
          `The shell's dependencies do not satisfy the feature's peer requirements:\n` +
          violations.join('\n') +
          `\nResolution: Update the client config to a newer feature version, or align the feature's dependencies.\n`,
      );
    }
    // --- END GOVERNANCE ---

    const contributions = pkg['nacs-contributions'];

    // Headless features contribute only extensions — no primary route
    if (!contributions?.primary) {
      console.log(`🔗 Headless feature (no primary route): ${feature.module}`);
      continue;
    }

    // Merge client-level overrides over the discovered primary values
    const primary: NacsPrimaryContribution = {
      ...contributions.primary,
      ...feature.overrides,
    };

    if (!primary.title) {
      throw new BuildPreparationError(
        `❌ Missing "title" in nacs-contributions.primary for: ${feature.module}\n` +
          `   Ensure the library declares a "title" field in its nacs-contributions.`,
      );
    }

    if (feature.version) {
      // Version defined: installed above as an alias.
      // The .npmrc routes @nacs/* to Verdaccio/Nexus automatically.
      console.log(
        `🔗 Using registry v${feature.version} for: ${feature.module} (as ${importPath})`,
      );
    } else {
      // No version defined: use local workspace path
      console.log(`🔗 Using local workspace source for: ${feature.module}`);
    }

    resolvedPrimaryFeatures.push({
      importPath,
      primary: primary as ValidatedPrimaryContribution,
    });
  }

  if (resolvedPrimaryFeatures.length === 0) {
    throw new BuildPreparationError(
      `❌ At least one feature must declare a primary route.\n` +
        `   All features in the client config are headless (no "nacs-contributions.primary").\n` +
        `   Add at least one feature with a primary route to generate valid navigation.`,
    );
  }

  // --- Extension point discovery ---

  // 1a. Discover config-driven consumers (features in the client config that declare `extensionPoints`)
  const activeExtensionPoints = new Map<
    string,
    { descriptor: ExtensionPointDescriptor; consumerImportPath: string }
  >();

  resolvedFeatures.forEach(({ importPath, pkg }) => {
    const extensionPoints = pkg['nacs-contributions']?.extensionPoints;
    if (!extensionPoints) return;
    for (const [extensionPointName, descriptor] of Object.entries(
      extensionPoints,
    )) {
      if (!activeExtensionPoints.has(extensionPointName)) {
        activeExtensionPoints.set(extensionPointName, {
          descriptor,
          consumerImportPath: importPath,
        });
      }
    }
  });

  // 1b. Discover always-active extension point consumers from workspace-internal libs.
  // These are libs listed in tsconfig.base.json paths that are NOT in the client config
  // (i.e. shell-infrastructure libs like core-admin that are always present).
  const configModuleNames = new Set(config.features.map((f) => f.module));
  const tsconfigDiscoveryPath = path.join(root, 'tsconfig.base.json');
  const tsconfigForDiscovery = validateTsconfigBase(
    readJsonFile(tsconfigDiscoveryPath),
    tsconfigDiscoveryPath,
  );

  for (const [moduleName, pathArr] of Object.entries(
    tsconfigForDiscovery.compilerOptions?.paths ?? {},
  )) {
    if (configModuleNames.has(moduleName)) continue; // config-driven feature, already handled
    const pkgDir = path.join(root, path.dirname(path.dirname(pathArr[0])));
    if (!fs.existsSync(path.join(pkgDir, 'package.json'))) continue;
    const pkg = validateNacsPackageJson(
      readPackageJson(pkgDir),
      `${moduleName} (${pkgDir})`,
    );
    const contributions = pkg['nacs-contributions'];
    // Skip feature libs (those with a `primary` contribution) — they are config-driven (1a.)
    if (contributions?.primary) continue;
    const extensionPoints = contributions?.extensionPoints;
    if (!extensionPoints) continue;
    for (const [extensionPointName, descriptor] of Object.entries(
      extensionPoints,
    )) {
      if (!activeExtensionPoints.has(extensionPointName)) {
        activeExtensionPoints.set(extensionPointName, {
          descriptor,
          consumerImportPath: moduleName,
        });
      }
    }
  }

  // 1c. Built-in: app initializers are always collected under the canonical key
  // 'nacs:app-initializer'. No consumer lib declaration is required — the consumer
  // is Angular's own bootstrap mechanism (app.config.ts providers array).
  const BUILTIN_APP_INIT = 'nacs:app-initializer';
  if (!activeExtensionPoints.has(BUILTIN_APP_INIT)) {
    activeExtensionPoints.set(BUILTIN_APP_INIT, {
      descriptor: { itemType: 'initializer' },
      consumerImportPath: '', // built-in — no consumer lib import
    });
  }

  // --- Collect all extension point data before emitting ---
  const collectedExtPoints: CollectedExtPoint[] = [];

  for (const [
    extensionPointName,
    { descriptor, consumerImportPath },
  ] of activeExtensionPoints) {
    const varName = `ext${extensionPointName
      .split(/[-_:.]/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('')}`;

    if (descriptor.itemType === 'route') {
      const contributions: Array<{
        item: NacsPrimaryContribution;
        importPath: string;
      }> = [];
      resolvedFeatures.forEach(({ importPath, pkg }) => {
        const slotValue =
          pkg['nacs-contributions']?.extensions?.[extensionPointName];
        if (!slotValue) return;
        (slotValue ?? []).forEach((item) =>
          contributions.push({
            item: NacsPrimaryContributionSchema.parse(item),
            importPath,
          }),
        );
      });
      collectedExtPoints.push({
        kind: 'route',
        name: extensionPointName,
        varName,
        contributions,
      });
    } else if (descriptor.itemType === 'component') {
      const contributions: Array<{
        item: ComponentExtensionItem;
        importPath: string;
      }> = [];
      resolvedFeatures.forEach(({ importPath, pkg }) => {
        const slotValue =
          pkg['nacs-contributions']?.extensions?.[extensionPointName];
        if (!slotValue) return;
        (slotValue ?? []).forEach((item) =>
          contributions.push({
            item: ComponentExtensionItemSchema.parse(item),
            importPath,
          }),
        );
      });
      collectedExtPoints.push({
        kind: 'component',
        name: extensionPointName,
        varName,
        descriptor,
        consumerImportPath,
        contributions,
      });
    } else if (descriptor.itemType === 'lazy-component') {
      const contributions: Array<{
        item: ComponentExtensionItem;
        importPath: string;
      }> = [];
      resolvedFeatures.forEach(({ importPath, pkg }) => {
        const slotValue =
          pkg['nacs-contributions']?.extensions?.[extensionPointName];
        if (!slotValue) return;
        (slotValue ?? []).forEach((item) =>
          contributions.push({
            item: ComponentExtensionItemSchema.parse(item),
            importPath,
          }),
        );
      });
      collectedExtPoints.push({
        kind: 'lazy-component',
        name: extensionPointName,
        varName,
        descriptor,
        consumerImportPath,
        contributions,
      });
    } else if (descriptor.itemType === 'lifecycle-hook') {
      const contributions: Array<{
        item: LifecycleHookItem;
        importPath: string;
      }> = [];
      resolvedFeatures.forEach(({ importPath, pkg }) => {
        const slotValue =
          pkg['nacs-contributions']?.extensions?.[extensionPointName];
        if (!slotValue) return;
        (slotValue ?? []).forEach((item) =>
          contributions.push({
            item: LifecycleHookItemSchema.parse(item),
            importPath,
          }),
        );
      });
      collectedExtPoints.push({
        kind: 'lifecycle-hook',
        name: extensionPointName,
        varName,
        descriptor,
        consumerImportPath,
        contributions,
      });
    } else if (descriptor.itemType === 'value') {
      const contributions: Array<{
        item: ValueItem;
        importPath: string;
      }> = [];
      resolvedFeatures.forEach(({ importPath, pkg }) => {
        const slotValue =
          pkg['nacs-contributions']?.extensions?.[extensionPointName];
        if (!slotValue) return;
        (slotValue ?? []).forEach((item) =>
          contributions.push({
            item: ValueItemSchema.parse(item),
            importPath,
          }),
        );
      });
      collectedExtPoints.push({
        kind: 'value',
        name: extensionPointName,
        varName,
        descriptor,
        consumerImportPath,
        contributions,
      });
    } else if (descriptor.itemType === 'initializer') {
      const contributions: Array<{
        item: InitializerItem;
        importPath: string;
      }> = [];
      resolvedFeatures.forEach(({ importPath, pkg }) => {
        const slotValue =
          pkg['nacs-contributions']?.extensions?.[extensionPointName];
        if (!slotValue) return;
        (slotValue ?? []).forEach((item) =>
          contributions.push({
            item: InitializerItemSchema.parse(item),
            importPath,
          }),
        );
      });
      collectedExtPoints.push({
        kind: 'initializer',
        name: extensionPointName,
        varName,
        descriptor,
        consumerImportPath,
        contributions,
      });
    }
  }

  // --- Default route resolution ---
  let resolvedDefaultRoute: string | undefined;
  if (config.defaultRoute) {
    const knownModules = config.features.map((f) => f.module);
    if (!knownModules.includes(config.defaultRoute)) {
      throw new BuildPreparationError(
        `❌ Invalid "defaultRoute": "${config.defaultRoute}" in client config for: ${client}\n` +
          `   Must match one of the declared feature modules: ${knownModules.join(', ')}`,
      );
    }
    const targetImportPath = resolvedFeatures.find(
      ({ feature }) => feature.module === config.defaultRoute,
    )?.importPath;
    const primaryFeature = resolvedPrimaryFeatures.find(
      ({ importPath }) => importPath === targetImportPath,
    );
    if (!primaryFeature) {
      throw new BuildPreparationError(
        `❌ "defaultRoute" "${config.defaultRoute}" is a headless feature with no primary route.\n` +
          `   Only features with a primary route can be used as the default route.`,
      );
    }
    resolvedDefaultRoute = primaryFeature.primary.path;
  }

  // --- Emit ---
  const outputPath = path.join(
    root,
    'apps/shell/src/app/app.composition.generated.ts',
  );
  emitComposition(
    resolvedPrimaryFeatures,
    collectedExtPoints,
    outputPath,
    resolvedDefaultRoute,
  );
}
