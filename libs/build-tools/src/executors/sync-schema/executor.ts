import type { ExecutorContext } from '@nx/devkit';
import type { SyncSchemaExecutorOptions } from './schema';
import { BuildPreparationError } from '../../lib/schemas';
import { runSyncSchema } from '../../lib/sync-schema';

export default async function syncSchemaExecutor(
  _options: SyncSchemaExecutorOptions,
  context: ExecutorContext,
): Promise<{ success: boolean }> {
  try {
    runSyncSchema(context.root);
    return { success: true };
  } catch (error) {
    if (error instanceof BuildPreparationError) {
      console.error(error.message);
    } else {
      console.error('An unexpected error occurred:', error);
    }
    return { success: false };
  }
}
