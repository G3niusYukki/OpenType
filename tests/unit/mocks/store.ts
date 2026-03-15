import { vi } from 'vitest';

type StoreGet = <T = unknown>(key: string) => T | undefined;
type StoreSet = (key: string, value: unknown) => void;

/**
 * Hoisted `electron-store` mock functions shared across tests.
 *
 * @example
 * ```ts
 * import { beforeEach, expect, it } from 'vitest';
 * import { mockStoreGet, mockStoreSet, resetStoreMocks } from './mocks';
 * import { Store } from '../../src/main/store';
 *
 * beforeEach(() => {
 *   resetStoreMocks();
 * });
 *
 * it('reads dictionary data from the mocked store', () => {
 *   mockStoreGet.mockImplementation((key) => key === 'dictionary' ? [] : undefined);
 *
 *   const store = new Store();
 *   expect(store.get('dictionary')).toEqual([]);
 *   expect(mockStoreSet).not.toHaveBeenCalled();
 * });
 * ```
 */
export const mockStoreGet = vi.fn<StoreGet>();
export const mockStoreSet = vi.fn<StoreSet>();

export class MockStore {
  get = mockStoreGet;
  set = mockStoreSet;
}

export const resetStoreMocks = (): void => {
  mockStoreGet.mockReset();
  mockStoreSet.mockReset();
  mockStoreGet.mockReturnValue(undefined);
};

vi.mock('electron-store', () => ({
  default: MockStore,
}));

export default MockStore;
