import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleOutageTool } from '../tools/outages.js';
import { runWithCredentials } from '../client.js';
import { jsonResponse, textOf } from './test-helpers.js';

describe('handleOutageTool', () => {
  const fetchMock = vi.fn();
  const creds = { apiKey: 'token-1', baseUrl: 'https://uisp.example.com' };

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uisp_list_outages requires count/page and forwards filters', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [] }));

    const result = await runWithCredentials(creds, () =>
      handleOutageTool('uisp_list_outages', { count: 50, page: 1, type: 'outage', inProgress: true })
    );

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/nms/api/v2.1/outages');
    expect(url.searchParams.get('count')).toBe('50');
    expect(url.searchParams.get('page')).toBe('1');
    expect(url.searchParams.get('type')).toBe('outage');
    expect(url.searchParams.get('inProgress')).toBe('true');
    expect(result.isError).toBeUndefined();
  });

  it('returns a credential error without calling fetch when no token/baseUrl is configured', async () => {
    const result = await handleOutageTool('uisp_list_outages', { count: 50, page: 1 });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/UISP_API_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
