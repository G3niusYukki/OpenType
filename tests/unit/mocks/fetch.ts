import { vi } from 'vitest';

type MockFn<T extends (...args: any[]) => any> = ReturnType<typeof vi.fn<T>>;

export interface MockFetchResponse<T = unknown> {
  ok: boolean;
  status: number;
  json: () => Promise<T>;
  text: () => Promise<string>;
}

export interface FetchMockHelpers {
  mockFetch: MockFn<(input: unknown, init?: unknown) => Promise<MockFetchResponse>>;
  createMockResponse: <T>(data: T, init?: { ok?: boolean; status?: number; text?: string }) => MockFetchResponse<T>;
  resetFetchMock: () => void;
}

/**
 * Creates reusable fetch mocks for provider and network tests.
 *
 * @example
 * ```ts
 * import { beforeEach, expect, it, vi } from 'vitest';
 * import { createFetchMock } from './mocks';
 *
 * const { mockFetch, createMockResponse, resetFetchMock } = createFetchMock();
 *
 * vi.mock('node-fetch', () => ({ default: mockFetch }));
 *
 * beforeEach(() => {
 *   resetFetchMock();
 * });
 *
 * it('returns a successful JSON response', async () => {
 *   mockFetch.mockResolvedValue(createMockResponse({ ok: true }));
 *   await expect(mockFetch('https://example.com')).resolves.toMatchObject({ ok: true });
 * });
 * ```
 */
export const createFetchMock = (): FetchMockHelpers => {
  const createMockResponse = <T>(
    data: T,
    init: { ok?: boolean; status?: number; text?: string } = {},
  ): MockFetchResponse<T> => ({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => data,
    text: async () => init.text ?? JSON.stringify(data),
  });

  const mockFetch = vi.fn<(input: unknown, init?: unknown) => Promise<MockFetchResponse>>();

  const resetFetchMock = (): void => {
    mockFetch.mockReset();
  };

  return {
    mockFetch,
    createMockResponse,
    resetFetchMock,
  };
};
