import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleSystemTool } from '../tools/system.js';
import { runWithCredentials } from '../client.js';
import { jsonResponse, textOf } from './test-helpers.js';

describe('handleSystemTool', () => {
  const fetchMock = vi.fn();
  const creds = { apiKey: 'token-1', baseUrl: 'https://uisp.example.com' };

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uisp_get_version hits the version path with no params', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ version: '2.5.1' }));

    const result = await runWithCredentials(creds, () => handleSystemTool('uisp_get_version', {}));

    expect(new URL(fetchMock.mock.calls[0][0] as string).pathname).toBe('/nms/api/v2.1/nms/version');
    expect(result.isError).toBeUndefined();
    expect(JSON.parse(textOf(result)).version).toBe('2.5.1');
  });

  it('uisp_get_network_statistics requires an interval', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}));

    await runWithCredentials(creds, () => handleSystemTool('uisp_get_network_statistics', { interval: 'day' }));

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/nms/api/v2.1/nms/statistics');
    expect(url.searchParams.get('interval')).toBe('day');
  });

  it('uisp_get_summary requires logsLevel as a repeated query param', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}));

    await runWithCredentials(creds, () => handleSystemTool('uisp_get_summary', { logsLevel: ['info', 'warning'] }));

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/nms/api/v2.1/nms/summary');
    expect(url.searchParams.getAll('logsLevel')).toEqual(['info', 'warning']);
  });

  it('returns a credential error without calling fetch when no token/baseUrl is configured', async () => {
    const result = await handleSystemTool('uisp_get_version', {});

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/UISP_API_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
