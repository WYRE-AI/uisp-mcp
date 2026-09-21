import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleFirmwareTool } from '../tools/firmware.js';
import { runWithCredentials } from '../client.js';
import { jsonResponse, textOf } from './test-helpers.js';

describe('handleFirmwareTool', () => {
  const fetchMock = vi.fn();
  const creds = { apiKey: 'token-1', baseUrl: 'https://uisp.example.com' };

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uisp_list_firmwares requests the firmwares list with no params', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));

    const result = await runWithCredentials(creds, () => handleFirmwareTool('uisp_list_firmwares', {}));

    expect(new URL(fetchMock.mock.calls[0][0] as string).pathname).toBe('/nms/api/v2.1/firmwares');
    expect(result.isError).toBeUndefined();
  });

  it('returns a credential error without calling fetch when no token/baseUrl is configured', async () => {
    const result = await handleFirmwareTool('uisp_list_firmwares', {});

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/UISP_API_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
