import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleSpeedTestTool } from '../tools/speedtest.js';
import { runWithCredentials } from '../client.js';
import { jsonResponse, textOf } from './test-helpers.js';

describe('handleSpeedTestTool', () => {
  const fetchMock = vi.fn();
  const creds = { apiKey: 'token-1', baseUrl: 'https://uisp.example.com' };

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uisp_get_speed_tests requests the speed-tests list with no params', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));

    const result = await runWithCredentials(creds, () => handleSpeedTestTool('uisp_get_speed_tests', {}));

    expect(new URL(fetchMock.mock.calls[0][0] as string).pathname).toBe('/nms/api/v2.1/speed-tests');
    expect(result.isError).toBeUndefined();
  });

  it('returns a credential error without calling fetch when no token/baseUrl is configured', async () => {
    const result = await handleSpeedTestTool('uisp_get_speed_tests', {});

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/UISP_API_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
