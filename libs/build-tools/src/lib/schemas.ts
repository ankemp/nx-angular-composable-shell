import { z } from 'zod';

export class BuildPreparationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BuildPreparationError';
  }
}

export class NacsGovernanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NacsGovernanceError';
  }
}

// --- nacs-contributions Zod schemas ---
// These serve as both the runtime type definitions AND the validation layer.
// Any package.json with a malformed nacs-contributions field will cause a hard
// build failure with a descriptive error before any code generation begins.

export const NacsPrimaryContributionSchema = z.object({
  path: z.string(),
  exportName: z.string(),
  title: z.string().optional(),
  icon: z.string(),
});
export type NacsPrimaryContribution = z.infer<
  typeof NacsPrimaryContributionSchema
>;

// After title is validated as present, use this narrowed type
export type ValidatedPrimaryContribution = NacsPrimaryContribution & {
  title: string;
};

// A single item contributed to a component extension point (e.g. a dashboard widget).
export const ComponentExtensionItemSchema = z.object({
  exportName: z.string(),
  title: z.string(),
  icon: z.string(),
  routePath: z.string().optional(),
});
export type ComponentExtensionItem = z.infer<
  typeof ComponentExtensionItemSchema
>;

// A single item contributed to a lifecycle-hook extension point (e.g. a logout handler).
// Only requires the exported function name — no title/icon needed.
export const LifecycleHookItemSchema = z.object({
  exportName: z.string(),
});
export type LifecycleHookItem = z.infer<typeof LifecycleHookItemSchema>;

// A single item contributed to an initializer extension point.
// The function is imported statically and registered via provideAppInitializer().
// It runs in an injection context, so use inject() inside the function body for
// any dependencies — no deps array needed.
export const InitializerItemSchema = z.object({
  exportName: z.string(),
});
export type InitializerItem = z.infer<typeof InitializerItemSchema>;

// A single item contributed to a value extension point. Data is arbitrary per extension point.
export const ValueItemSchema = z.object({}).passthrough();
export type ValueItem = z.infer<typeof ValueItemSchema>;

// Extension item is either a route contribution (has `path`), a component contribution,
// an initializer contribution (has exportName + optional deps), a lifecycle-hook
// contribution (exportName only), or a value contribution (arbitrary data).
// The union is tried left-to-right: items with `path` match the route branch first.
export const ExtensionItemSchema = z.union([
  NacsPrimaryContributionSchema,
  ComponentExtensionItemSchema,
  InitializerItemSchema,
  LifecycleHookItemSchema,
  ValueItemSchema,
]);

// Describes an extension point that a library can RECEIVE contributions into.
// Declared under nacs-contributions.extensionPoints in the consumer library's package.json.
// Uses a discriminated union so missing tokenExportName/itemTypeName on component
// extension points is caught at build time with a clear error.
export const ExtensionPointDescriptorSchema = z.discriminatedUnion('itemType', [
  z.object({
    itemType: z.literal('component'),
    tokenExportName: z.string(),
    itemTypeName: z.string(),
  }),
  z.object({
    itemType: z.literal('lazy-component'),
    tokenExportName: z.string(),
    itemTypeName: z.string().optional(),
  }),
  z.object({
    itemType: z.literal('route'),
    tokenExportName: z.string().optional(),
    itemTypeName: z.string().optional(),
  }),
  z.object({
    itemType: z.literal('lifecycle-hook'),
    tokenExportName: z.string(),
  }),
  z.object({
    itemType: z.literal('value'),
    tokenExportName: z.string(),
    itemTypeName: z.string().optional(),
  }),
  z.object({
    itemType: z.literal('initializer'),
  }),
]);
export type ExtensionPointDescriptor = z.infer<
  typeof ExtensionPointDescriptorSchema
>;

export const NacsContributionsSchema = z.object({
  primary: NacsPrimaryContributionSchema.optional(),
  // Extension points this library can RECEIVE contributions into (consumer side)
  extensionPoints: z
    .record(z.string(), ExtensionPointDescriptorSchema)
    .optional(),
  // Extension points this library contributes TO (provider side).
  // All extension values are arrays. Route extensions use NacsPrimaryContribution items;
  // component extensions use ComponentExtensionItem items.
  extensions: z
    .record(z.string(), z.array(ExtensionItemSchema).optional())
    .optional(),
});

export const NacsPackageJsonSchema = z.object({
  name: z.string(),
  'nacs-contributions': NacsContributionsSchema.optional(),
});
export type NacsPackageJson = z.infer<typeof NacsPackageJsonSchema>;

/** Validate a raw package.json object against the nacs-contributions schema.
 *  Exits with a descriptive error on failure so prepare-build never silently
 *  generates routes from malformed metadata. */
export function validateNacsPackageJson(
  raw: unknown,
  source: string,
): NacsPackageJson {
  const result = NacsPackageJsonSchema.safeParse(raw);
  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new BuildPreparationError(
      `❌ Invalid nacs-contributions in ${source}:\n${errors}`,
    );
  }
  return result.data;
}

// --- Client config Zod schemas ---

export const FeatureOverridesSchema = z.object({
  title: z.string().optional(),
  icon: z.string().optional(),
});
export type FeatureOverrides = z.infer<typeof FeatureOverridesSchema>;

export const FeatureConfigSchema = z.object({
  module: z.string(),
  version: z.string().optional(),
  overrides: FeatureOverridesSchema.optional(),
});
export type FeatureConfig = z.infer<typeof FeatureConfigSchema>;

export const ClientConfigSchema = z.object({
  clientId: z.string(),
  features: z.array(FeatureConfigSchema),
  defaultRoute: z.string().optional(),
});
export type ClientConfig = z.infer<typeof ClientConfigSchema>;

/** Validate a raw client config object. Throws BuildPreparationError on failure. */
export function validateClientConfig(
  raw: unknown,
  source: string,
): ClientConfig {
  const result = ClientConfigSchema.safeParse(raw);
  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new BuildPreparationError(
      `❌ Invalid client config in ${source}:\n${errors}`,
    );
  }
  return result.data;
}

// --- tsconfig.base.json Zod schema ---
// Only the fields prepare-build actually consumes are required; the rest is passthrough.
export const TsconfigBaseSchema = z.object({
  compilerOptions: z
    .object({
      paths: z.record(z.string(), z.array(z.string())).optional(),
    })
    .optional(),
});
export type TsconfigBase = z.infer<typeof TsconfigBaseSchema>;

/** Validate a raw tsconfig.base.json object. Throws BuildPreparationError on failure. */
export function validateTsconfigBase(
  raw: unknown,
  source: string,
): TsconfigBase {
  const result = TsconfigBaseSchema.safeParse(raw);
  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new BuildPreparationError(
      `❌ Invalid tsconfig in ${source}:\n${errors}`,
    );
  }
  return result.data;
}

// --- Collected extension point types ---
// Used to pass data between the collect phase (prepare-build.ts) and the emit phase (emit.ts).

export type RouteExtPoint = {
  kind: 'route';
  name: string;
  varName: string;
  contributions: Array<{ item: NacsPrimaryContribution; importPath: string }>;
};

export type ComponentExtPoint = {
  kind: 'component';
  name: string;
  varName: string;
  descriptor: Extract<ExtensionPointDescriptor, { itemType: 'component' }>;
  consumerImportPath: string;
  contributions: Array<{ item: ComponentExtensionItem; importPath: string }>;
};

export type LazyComponentExtPoint = {
  kind: 'lazy-component';
  name: string;
  varName: string;
  descriptor: Extract<ExtensionPointDescriptor, { itemType: 'lazy-component' }>;
  consumerImportPath: string;
  contributions: Array<{ item: ComponentExtensionItem; importPath: string }>;
};

export type LifecycleHookExtPoint = {
  kind: 'lifecycle-hook';
  name: string;
  varName: string;
  descriptor: Extract<ExtensionPointDescriptor, { itemType: 'lifecycle-hook' }>;
  consumerImportPath: string;
  contributions: Array<{ item: LifecycleHookItem; importPath: string }>;
};

export type ValueExtPoint = {
  kind: 'value';
  name: string;
  varName: string;
  descriptor: Extract<ExtensionPointDescriptor, { itemType: 'value' }>;
  consumerImportPath: string;
  contributions: Array<{ item: ValueItem; importPath: string }>;
};

export type InitializerExtPoint = {
  kind: 'initializer';
  name: string;
  varName: string;
  descriptor: Extract<ExtensionPointDescriptor, { itemType: 'initializer' }>;
  consumerImportPath: string;
  contributions: Array<{ item: InitializerItem; importPath: string }>;
};

export type CollectedExtPoint =
  | RouteExtPoint
  | ComponentExtPoint
  | LazyComponentExtPoint
  | LifecycleHookExtPoint
  | ValueExtPoint
  | InitializerExtPoint;

// Resolved primary feature after title validation
export type ResolvedPrimaryFeature = {
  importPath: string;
  primary: ValidatedPrimaryContribution;
};
