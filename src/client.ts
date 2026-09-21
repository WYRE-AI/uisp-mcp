import { AsyncLocalStorage } from 'node:async_hooks';
import { logger } from './utils/logger.js';
import { UispApiError, UispAuthError, UispRateLimitError } from './types.js';
import type {
  GetDeviceDetailParams,
  GetDeviceStatisticsParams,
  GetNetworkStatisticsParams,
  GetSiteParams,
  GetSummaryParams,
  ListDataLinksParams,
  ListDevicesParams,
  ListLogsParams,
  ListOutagesParams,
  ListSitesParams,
  ListTasksParams,
  SearchSitesParams,
  SiteIntervalParams,
  UispCredentials,
  UispResponse,
} from './types.js';

// Request-scoped credential store. In gateway mode the HTTP layer runs each
// request inside runWithCredentials({apiKey, baseUrl}); getCredentials()
// reads from it. Falls back to process.env for stdio/single-tenant mode.
const credStore = new AsyncLocalStorage<UispCredentials>();

export function runWithCredentials<T>(creds: UispCredentials, fn: () => T): T {
  return credStore.run(creds, fn);
}

export function getCredentials(): UispCredentials | null {
  const scoped = credStore.getStore();
  if (scoped?.apiKey && scoped?.baseUrl) return scoped;
  const apiKey = process.env.UISP_API_KEY;
  const baseUrl = process.env.UISP_BASE_URL;
  if (!apiKey || !baseUrl) {
    logger.warn('Missing credentials', { hasApiKey: !!apiKey, hasBaseUrl: !!baseUrl });
    return null;
  }
  return { apiKey, baseUrl };
}

function buildQuery(params: Record<string, unknown> = {}): URLSearchParams {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const v of value) qs.append(key, String(v));
      continue;
    }
    qs.append(key, String(value));
  }
  return qs;
}

async function doGet(
  creds: UispCredentials,
  path: string,
  query?: Record<string, unknown>
): Promise<UispResponse> {
  const base = creds.baseUrl.replace(/\/+$/, '');
  const qs = query ? buildQuery(query).toString() : '';
  const url = `${base}/nms/api/v2.1${path}${qs ? `?${qs}` : ''}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'x-auth-token': creds.apiKey, Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });

  // 401 (invalid/revoked token) and 429 (rate-limited) are distinct failure
  // modes with distinct remediations - grouping them under one generic auth-
  // error class hides a transient rate limit behind a message that reads
  // like a bad/expired token. UISP's own console distinguishes an invalid
  // token from a token whose role can't read the requested resource; both
  // surface as UispAuthError since both mean "this token can't do that", not
  // "try again".
  if (res.status === 401 || res.status === 403) {
    throw new UispAuthError(`UISP rejected the request (HTTP ${res.status}): ${path}`);
  }
  if (res.status === 429) {
    throw new UispRateLimitError(`UISP rate-limited the request (HTTP 429): ${path}`);
  }
  if (!res.ok) {
    throw new UispApiError(`UISP ${path} failed: HTTP ${res.status}`, res.status);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ---------------------------------------------------------------------
// System
// ---------------------------------------------------------------------

/** GET /nms/version - UISP version, deployment type and build. Cheapest authenticated read; useful as a credential sanity check. */
export async function getVersion(creds: UispCredentials): Promise<UispResponse> {
  return doGet(creds, '/nms/version');
}

/** GET /nms/statistics - network-wide statistics (client/site counts, network health, signal/link scores, outages). */
export async function getNetworkStatistics(creds: UispCredentials, params: GetNetworkStatisticsParams): Promise<UispResponse> {
  return doGet(creds, '/nms/statistics', { ...params });
}

/** GET /nms/summary - badge-count-like values across the instance (unread logs/outages/firmwares, active client/site counts). */
export async function getSummary(creds: UispCredentials, params: GetSummaryParams): Promise<UispResponse> {
  return doGet(creds, '/nms/summary', { ...params });
}

// ---------------------------------------------------------------------
// Sites
// ---------------------------------------------------------------------

/** GET /sites - list sites (network locations, each optionally tied to a UCRM client/service record). */
export async function listSites(creds: UispCredentials, params: ListSitesParams = {}): Promise<UispResponse> {
  return doGet(creds, '/sites', { ...params });
}

/** GET /sites/{id} - a single site's detail, including its identification and (if linked) UCRM client/service reference. */
export async function getSite(creds: UispCredentials, { id, ucrmDetails }: GetSiteParams): Promise<UispResponse> {
  return doGet(creds, `/sites/${encodeURIComponent(id)}`, { ucrmDetails });
}

/** GET /sites/search - search sites/endpoints/clients by name, address, MAC address or IP address. */
export async function searchSites(creds: UispCredentials, params: SearchSitesParams): Promise<UispResponse> {
  return doGet(creds, '/sites/search', { ...params });
}

/** GET /sites/{id}/clients - list of all client sites belonging to a given (parent) site. */
export async function listSiteClients(creds: UispCredentials, id: string): Promise<UispResponse> {
  return doGet(creds, `/sites/${encodeURIComponent(id)}/clients`);
}

/** GET /sites/{siteId}/statistics - upload/download traffic between a site and its parent site, bucketed by interval. */
export async function getSiteStatistics(creds: UispCredentials, { siteId, interval }: SiteIntervalParams): Promise<UispResponse> {
  return doGet(creds, `/sites/${encodeURIComponent(siteId)}/statistics`, { interval });
}

/** GET /sites/{siteId}/traffic/summary - a site's total upload/download for the given interval up to now. */
export async function getSiteTrafficSummary(creds: UispCredentials, { siteId, interval }: SiteIntervalParams): Promise<UispResponse> {
  return doGet(creds, `/sites/${encodeURIComponent(siteId)}/traffic/summary`, { interval });
}

// ---------------------------------------------------------------------
// Devices
// ---------------------------------------------------------------------

/** GET /devices - list devices (hostname/IP/MAC, status, parent site), optionally filtered by site/type/role/authorization. */
export async function listDevices(creds: UispCredentials, params: ListDevicesParams = {}): Promise<UispResponse> {
  return doGet(creds, '/devices', { ...params });
}

/** GET /devices/{id} - a single device's status overview. */
export async function getDevice(creds: UispCredentials, id: string): Promise<UispResponse> {
  return doGet(creds, `/devices/${encodeURIComponent(id)}`);
}

/** GET /devices/{id}/detail - a single device's detail, optionally including its interfaces and/or connected stations. */
export async function getDeviceDetail(creds: UispCredentials, { id, withStations }: GetDeviceDetailParams): Promise<UispResponse> {
  return doGet(creds, `/devices/${encodeURIComponent(id)}/detail`, { withStations });
}

/** GET /devices/{id}/statistics - device telemetry (CPU/RAM/signal/temperature/throughput) bucketed by interval. */
export async function getDeviceStatistics(creds: UispCredentials, { id, interval }: GetDeviceStatisticsParams): Promise<UispResponse> {
  return doGet(creds, `/devices/${encodeURIComponent(id)}/statistics`, { interval });
}

/** GET /devices/{deviceId}/interfaces - a device's network interfaces, including their configured IP addresses. */
export async function listDeviceInterfaces(creds: UispCredentials, deviceId: string): Promise<UispResponse> {
  return doGet(creds, `/devices/${encodeURIComponent(deviceId)}/interfaces`);
}

/** GET /devices/mac/{mac} - look up a device by its MAC address. */
export async function getDeviceByMac(creds: UispCredentials, mac: string): Promise<UispResponse> {
  return doGet(creds, `/devices/mac/${encodeURIComponent(mac)}`);
}

/** GET /devices/discovered - devices UISP has discovered on the network but not yet added. */
export async function listDiscoveredDevices(creds: UispCredentials): Promise<UispResponse> {
  return doGet(creds, '/devices/discovered');
}

// ---------------------------------------------------------------------
// Outages
// ---------------------------------------------------------------------

/** GET /outages - list network outages (UISP's alerting surface), optionally filtered by device/type/in-progress state. */
export async function listOutages(creds: UispCredentials, params: ListOutagesParams): Promise<UispResponse> {
  return doGet(creds, '/outages', { ...params });
}

// ---------------------------------------------------------------------
// Logs
// ---------------------------------------------------------------------

/** GET /logs - the UISP event/audit log, optionally filtered by site/device/level/tag. */
export async function listLogs(creds: UispCredentials, params: ListLogsParams): Promise<UispResponse> {
  return doGet(creds, '/logs', { ...params });
}

// ---------------------------------------------------------------------
// Data Links
// ---------------------------------------------------------------------

/** GET /data-links - list data links (the wireless/wired links UISP has mapped between devices and sites). */
export async function listDataLinks(creds: UispCredentials, params: ListDataLinksParams = {}): Promise<UispResponse> {
  return doGet(creds, '/data-links', { ...params });
}

/** GET /data-links/{id} - a single data link's detail. */
export async function getDataLink(creds: UispCredentials, id: string): Promise<UispResponse> {
  return doGet(creds, `/data-links/${encodeURIComponent(id)}`);
}

/** GET /data-links/sites/{siteId} - data links attached to a given site. */
export async function listSiteDataLinks(creds: UispCredentials, siteId: string): Promise<UispResponse> {
  return doGet(creds, `/data-links/sites/${encodeURIComponent(siteId)}`);
}

// ---------------------------------------------------------------------
// Gateways
// ---------------------------------------------------------------------

/** GET /gateways - list gateways (routers configured as network gateways) and their NetFlow/QoS/suspend configuration. */
export async function listGateways(creds: UispCredentials): Promise<UispResponse> {
  return doGet(creds, '/gateways');
}

/** GET /gateways/{id} - a single gateway's detail. */
export async function getGateway(creds: UispCredentials, id: string): Promise<UispResponse> {
  return doGet(creds, `/gateways/${encodeURIComponent(id)}`);
}

// ---------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------

/** GET /tasks - list background tasks (e.g. firmware upgrades, backups) and their status. */
export async function listTasks(creds: UispCredentials, params: ListTasksParams): Promise<UispResponse> {
  return doGet(creds, '/tasks', { ...params });
}

/** GET /tasks/in-progress - the number of tasks currently in progress. */
export async function getTasksInProgress(creds: UispCredentials): Promise<UispResponse> {
  return doGet(creds, '/tasks/in-progress');
}

// ---------------------------------------------------------------------
// Firmware
// ---------------------------------------------------------------------

/** GET /firmwares - firmware versions available to UISP for its supported device models. */
export async function listFirmwares(creds: UispCredentials): Promise<UispResponse> {
  return doGet(creds, '/firmwares');
}

// ---------------------------------------------------------------------
// Speed Test
// ---------------------------------------------------------------------

/** GET /speed-tests - detail on running/recent speed tests. */
export async function getSpeedTests(creds: UispCredentials): Promise<UispResponse> {
  return doGet(creds, '/speed-tests');
}
