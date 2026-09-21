import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleGatewayTool } from '../tools/gateways.js';
import { runWithCredentials } from '../client.js';
import { jsonResponse, textOf } from './test-helpers.js';

describe('handleGatewayTool', () => {
  const fetchMock = vi.fn();
  const creds = { apiKey: 'token-1', baseUrl: 'https://uisp.example.com' };

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uisp_list_gateways requests the gateway list with no params', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));

    const result = await runWithCredentials(creds, () => handleGatewayTool('uisp_list_gateways', {}));

    expect(new URL(fetchMock.mock.calls[0][0] as string).pathname).toBe('/nms/api/v2.1/gateways');
    expect(result.isError).toBeUndefined();
  });

  it('uisp_get_gateway scopes the request to the gateway ID', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}));

    await runWithCredentials(creds, () => handleGatewayTool('uisp_get_gateway', { id: 'gw1' }));

    expect(new URL(fetchMock.mock.calls[0][0] as string).pathname).toBe('/nms/api/v2.1/gateways/gw1');
  });

  it('returns a credential error without calling fetch when no token/baseUrl is configured', async () => {
    const result = await handleGatewayTool('uisp_list_gateways', {});

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/UISP_API_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
