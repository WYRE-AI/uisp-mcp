import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleLogTool } from '../tools/logs.js';
import { runWithCredentials } from '../client.js';
import { jsonResponse, textOf } from './test-helpers.js';

describe('handleLogTool', () => {
  const fetchMock = vi.fn();
  const creds = { apiKey: 'token-1', baseUrl: 'https://uisp.example.com' };

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uisp_list_logs requires count/page and forwards filters incl. an array deviceId', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [] }));

    const result = await runWithCredentials(creds, () =>
      handleLogTool('uisp_list_logs', { count: 50, page: 1, level: 'error', deviceId: ['d1', 'd2'] })
    );

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/nms/api/v2.1/logs');
    expect(url.searchParams.get('level')).toBe('error');
    expect(url.searchParams.getAll('deviceId')).toEqual(['d1', 'd2']);
    expect(result.isError).toBeUndefined();
  });

  it('returns a credential error without calling fetch when no token/baseUrl is configured', async () => {
    const result = await handleLogTool('uisp_list_logs', { count: 50, page: 1 });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/UISP_API_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
