import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleTaskTool } from '../tools/tasks.js';
import { runWithCredentials } from '../client.js';
import { jsonResponse, textOf } from './test-helpers.js';

describe('handleTaskTool', () => {
  const fetchMock = vi.fn();
  const creds = { apiKey: 'token-1', baseUrl: 'https://uisp.example.com' };

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uisp_list_tasks requires count/page and forwards status', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [] }));

    const result = await runWithCredentials(creds, () =>
      handleTaskTool('uisp_list_tasks', { count: 25, page: 1, status: 'in-progress' })
    );

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/nms/api/v2.1/tasks');
    expect(url.searchParams.get('status')).toBe('in-progress');
    expect(result.isError).toBeUndefined();
  });

  it('uisp_get_tasks_in_progress hits the in-progress path with no params', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ count: 2 }));

    await runWithCredentials(creds, () => handleTaskTool('uisp_get_tasks_in_progress', {}));

    expect(new URL(fetchMock.mock.calls[0][0] as string).pathname).toBe('/nms/api/v2.1/tasks/in-progress');
  });

  it('returns a credential error without calling fetch when no token/baseUrl is configured', async () => {
    const result = await handleTaskTool('uisp_list_tasks', { count: 25, page: 1 });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/UISP_API_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
