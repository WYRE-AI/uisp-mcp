import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleDataLinkTool } from '../tools/datalinks.js';
import { runWithCredentials } from '../client.js';
import { jsonResponse, textOf } from './test-helpers.js';

describe('handleDataLinkTool', () => {
  const fetchMock = vi.fn();
  const creds = { apiKey: 'token-1', baseUrl: 'https://uisp.example.com' };

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uisp_list_data_links forwards siteLinksOnly', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));

    const result = await runWithCredentials(creds, () => handleDataLinkTool('uisp_list_data_links', { siteLinksOnly: true }));

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/nms/api/v2.1/data-links');
    expect(url.searchParams.get('siteLinksOnly')).toBe('true');
    expect(result.isError).toBeUndefined();
  });

  it('uisp_get_data_link scopes the request to the link ID', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}));

    await runWithCredentials(creds, () => handleDataLinkTool('uisp_get_data_link', { id: 'dl1' }));

    expect(new URL(fetchMock.mock.calls[0][0] as string).pathname).toBe('/nms/api/v2.1/data-links/dl1');
  });

  it('uisp_list_site_data_links scopes to the site ID', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));

    await runWithCredentials(creds, () => handleDataLinkTool('uisp_list_site_data_links', { siteId: 's1' }));

    expect(new URL(fetchMock.mock.calls[0][0] as string).pathname).toBe('/nms/api/v2.1/data-links/sites/s1');
  });

  it('returns a credential error without calling fetch when no token/baseUrl is configured', async () => {
    const result = await handleDataLinkTool('uisp_list_data_links', {});

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/UISP_API_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
