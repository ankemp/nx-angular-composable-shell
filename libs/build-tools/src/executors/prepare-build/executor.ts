import { ExecutorContext, logger } from '@nx/devkit';
import type { PrepareBuildExecutorOptions } from './schema';
import { runPrepareBuild } from '../../lib/prepare-build';
import { NacsGovernanceError, BuildPreparationError } from '../../lib/schemas';

export default async function prepareBuildExecutor(
  options: PrepareBuildExecutorOptions,
  context: ExecutorContext,
): Promise<{ success: boolean }> {
  try {
    runPrepareBuild(options.client, context.root);
    return { success: true };
  } catch (error) {
    if (error instanceof NacsGovernanceError) {
      // Contract violations are fatal but expected; log cleanly.
      logger.fatal(error.message);
    } else if (error instanceof BuildPreparationError) {
      // Structural/schema issues
      logger.error(error.message);
    } else {
      // Catch unexpected Node/FS crashes
      logger.error(
        `An unexpected error occurred during shell composition:\n${error}`,
      );
    }
    // Returning success: false tells Nx the task failed without killing the daemon
    return { success: false };
  }
}
