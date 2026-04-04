import * as fs from 'fs';
import * as path from 'path';
import { globSync } from 'glob';
import { z } from 'zod';
import {
  ExtensionPointDescriptorSchema,
  ExtensionItemSchema,
  NacsPrimaryContributionSchema,
} from './schemas';

export const NACS_SCHEMA_OUTPUT_PATH =
  'libs/build-tools/nacs-package.schema.json';

/** Pure computation — scans workspace package.json files and returns the
 *  generated JSON schema string. No file system side effects. */
export function buildNacsSchemaJson(root: string): string {
  const pkgFiles = globSync('libs/**/package.json', { cwd: root });

  const discoveredExtensionPoints: Record<string, string> = {};

  pkgFiles.forEach((file) => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, file), 'utf-8'),
    ) as {
      name?: string;
      'nacs-contributions'?: { extensionPoints?: Record<string, unknown> };
    };
    const extPoints = pkg['nacs-contributions']?.extensionPoints;
    if (extPoints) {
      Object.keys(extPoints).forEach((key) => {
        discoveredExtensionPoints[key] =
          `Extension point provided by ${pkg.name}`;
      });
    }
  });

  // Build the dynamic extensions schema — keys are discovered at runtime,
  // but item shapes are enforced via the canonical ExtensionItemSchema.
  const DynamicExtensionsSchema = z
    .object(
      Object.keys(discoveredExtensionPoints).reduce(
        (acc, key) => {
          acc[key] = z
            .array(ExtensionItemSchema)
            .describe(discoveredExtensionPoints[key])
            .optional();
          return acc;
        },
        {} as Record<string, z.ZodTypeAny>,
      ),
    )
    .catchall(z.array(ExtensionItemSchema).optional());

  const CompleteNacsSchema = z.object({
    'nacs-contributions': z.object({
      primary: NacsPrimaryContributionSchema.optional(),
      extensions: DynamicExtensionsSchema.optional(),
      extensionPoints: z
        .record(z.string(), ExtensionPointDescriptorSchema)
        .optional(),
    }),
  });

  const jsonSchema = z.toJSONSchema(CompleteNacsSchema);
  const finalSchema = {
    $ref: 'http://json.schemastore.org/package',
    ...jsonSchema,
  };

  return JSON.stringify(finalSchema, null, 2);
}

/** Executor entry point — writes the schema to disk using the real file system. */
export function runSyncSchema(root: string): void {
  console.log('🔍 Scanning workspace for Extension Points...');
  const content = buildNacsSchemaJson(root);
  const outputPath = path.join(root, NACS_SCHEMA_OUTPUT_PATH);
  fs.writeFileSync(outputPath, content);
  console.log(`💾 Schema written to ${outputPath}`);
}
