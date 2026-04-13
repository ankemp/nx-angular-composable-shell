import { logger } from '@nx/devkit';
import type { ExecutorContext } from '@nx/devkit';
import prepareBuildExecutor from './executor';
import { runPrepareBuild } from '../../lib/prepare-build';
import {
  BuildPreparationError,
  NacsGovernanceError,
} from '../../lib/schemas';

jest.mock('@nx/devkit', () => ({
  logger: { fatal: jest.fn(), error: jest.fn() },
}));
jest.mock('@nx/workspace', () => ({ readPackageJson: jest.fn() }));
jest.mock('../../lib/prepare-build');

const mockRunPrepareBuild = jest.mocked(runPrepareBuild);
const mockLogger = jest.mocked(logger);

const context = { root: '/workspace' } as ExecutorContext;

beforeEach(() => jest.clearAllMocks());

describe('prepareBuildExecutor', () => {
  it('returns success when runPrepareBuild succeeds', async () => {
    mockRunPrepareBuild.mockReturnValue(undefined);
    const result = await prepareBuildExecutor({ client: 'dev' }, context);
    expect(result).toEqual({ success: true });
    expect(mockRunPrepareBuild).toHaveBeenCalledWith('dev', '/workspace');
  });

  it('returns failure and logs fatal for NacsGovernanceError', async () => {
    mockRunPrepareBuild.mockImplementation(() => {
      throw new NacsGovernanceError('gov fail');
    });
    const result = await prepareBuildExecutor({ client: 'dev' }, context);
    expect(result).toEqual({ success: false });
    expect(mockLogger.fatal).toHaveBeenCalledWith('gov fail');
  });

  it('returns failure and logs error for BuildPreparationError', async () => {
    mockRunPrepareBuild.mockImplementation(() => {
      throw new BuildPreparationError('build fail');
    });
    const result = await prepareBuildExecutor({ client: 'dev' }, context);
    expect(result).toEqual({ success: false });
    expect(mockLogger.error).toHaveBeenCalledWith('build fail');
  });

  it('returns failure and logs error for unexpected errors', async () => {
    mockRunPrepareBuild.mockImplementation(() => {
      throw new Error('unexpected');
    });
    const result = await prepareBuildExecutor({ client: 'dev' }, context);
    expect(result).toEqual({ success: false });
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('unexpected'),
    );
  });
});
