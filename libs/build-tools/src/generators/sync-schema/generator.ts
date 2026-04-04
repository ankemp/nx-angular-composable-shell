import type { Tree } from '@nx/devkit';
import type { SyncGeneratorResult } from 'nx/src/utils/sync-generators';
import {
  buildNacsSchemaJson,
  NACS_SCHEMA_OUTPUT_PATH,
} from '../../lib/sync-schema';

export async function syncSchemaGenerator(
  tree: Tree,
): Promise<SyncGeneratorResult> {
  const newContent = buildNacsSchemaJson(tree.root);
  const existing = tree.read(NACS_SCHEMA_OUTPUT_PATH)?.toString();

  // Only write if content has changed — avoids spurious "out of sync" detections
  if (existing !== newContent) {
    tree.write(NACS_SCHEMA_OUTPUT_PATH, newContent);
  }

  return {
    outOfSyncMessage:
      'The nacs-package.schema.json is out of date. Run `nx sync` to regenerate it from the current workspace extension points.',
  };
}

export default syncSchemaGenerator;
