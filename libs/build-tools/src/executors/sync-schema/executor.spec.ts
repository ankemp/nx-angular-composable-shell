import type { ExecutorContext } from '@nx/devkit';
import syncSchemaExecutor from './executor';
import { runSyncSchema } from '../../lib/sync-schema';
import { BuildPreparationError } from '../../lib/schemas';

jest.mock('../../lib/sync-schema');

const mockRunSyncSchema = jest.mocked(runSyncSchema);

const context = { root: '/workspace' } as ExecutorContext;

beforeEach(() => jest.clearAllMocks());

describe('syncSchemaExecutor', () => {
  it('returns success when runSyncSchema succeeds', async () => {
    mockRunSyncSchema.mockReturnValue(undefined);
    const result = await syncSchemaExecutor({}, context);
    expect(result).toEqual({ success: true });
    expect(mockRunSyncSchema).toHaveBeenCalledWith('/workspace');
  });

  it('returns failure for BuildPreparationError', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation();
    mockRunSyncSchema.mockImplementation(() => {
      throw new BuildPreparationError('schema fail');
    });
    const result = await syncSchemaExecutor({}, context);
    expect(result).toEqual({ success: false });
    expect(spy).toHaveBeenCalledWith('schema fail');
    spy.mockRestore();
  });

  it('returns failure for unexpected errors', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation();
    mockRunSyncSchema.mockImplementation(() => {
      throw new Error('boom');
    });
    const result = await syncSchemaExecutor({}, context);
    expect(result).toEqual({ success: false });
    expect(spy).toHaveBeenCalledWith(
      'An unexpected error occurred:',
      expect.any(Error),
    );
    spy.mockRestore();
  });
});
