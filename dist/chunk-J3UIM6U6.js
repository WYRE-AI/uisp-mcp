#!/usr/bin/env node

// src/utils/logger.ts
var LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
function getConfiguredLevel() {
  const env = (process.env.LOG_LEVEL || "info").toLowerCase();
  return env in LEVELS ? env : "info";
}
function log(level, message, context) {
  if (LEVELS[level] < LEVELS[getConfiguredLevel()]) return;
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const prefix = `${timestamp} [${level.toUpperCase()}]`;
  if (context !== void 0) {
    let contextStr;
    try {
      contextStr = JSON.stringify(context);
    } catch {
      contextStr = String(context);
    }
    console.error(`${prefix} ${message} ${contextStr}`);
  } else {
    console.error(`${prefix} ${message}`);
  }
}
var logger = {
  debug: (msg, ctx) => log("debug", msg, ctx),
  info: (msg, ctx) => log("info", msg, ctx),
  warn: (msg, ctx) => log("warn", msg, ctx),
  error: (msg, ctx) => log("error", msg, ctx)
};

// src/client.ts
import { AsyncLocalStorage } from "async_hooks";

// src/types.ts
var UispAuthError = class extends Error {
};
var UispRateLimitError = class extends Error {
};
var UispApiError = class extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
  status;
};

// src/client.ts
var credStore = new AsyncLocalStorage();
function runWithCredentials(creds, fn) {
  return credStore.run(creds, fn);
}
function getCredentials() {
  const scoped = credStore.getStore();
  if (scoped?.apiKey && scoped?.baseUrl) return scoped;
  const apiKey = process.env.UISP_API_KEY;
  const baseUrl = process.env.UISP_BASE_URL;
  if (!apiKey || !baseUrl) {
    logger.warn("Missing credentials", { hasApiKey: !!apiKey, hasBaseUrl: !!baseUrl });
    return null;
  }
  return { apiKey, baseUrl };
}
function buildQuery(params = {}) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === void 0 || value === null) continue;
    if (Array.isArray(value)) {
      for (const v of value) qs.append(key, String(v));
      continue;
    }
    qs.append(key, String(value));
  }
  return qs;
}
async function doGet(creds, path, query) {
  const base = creds.baseUrl.replace(/\/+$/, "");
  const qs = query ? buildQuery(query).toString() : "";
  const url = `${base}/nms/api/v2.1${path}${qs ? `?${qs}` : ""}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { "x-auth-token": creds.apiKey, Accept: "application/json" },
    signal: AbortSignal.timeout(15e3)
  });
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
async function getVersion(creds) {
  return doGet(creds, "/nms/version");
}
async function getNetworkStatistics(creds, params) {
  return doGet(creds, "/nms/statistics", { ...params });
}
async function getSummary(creds, params) {
  return doGet(creds, "/nms/summary", { ...params });
}
async function listSites(creds, params = {}) {
  return doGet(creds, "/sites", { ...params });
}
async function getSite(creds, { id, ucrmDetails }) {
  return doGet(creds, `/sites/${encodeURIComponent(id)}`, { ucrmDetails });
}
async function searchSites(creds, params) {
  return doGet(creds, "/sites/search", { ...params });
}
async function listSiteClients(creds, id) {
  return doGet(creds, `/sites/${encodeURIComponent(id)}/clients`);
}
async function getSiteStatistics(creds, { siteId, interval }) {
  return doGet(creds, `/sites/${encodeURIComponent(siteId)}/statistics`, { interval });
}
async function getSiteTrafficSummary(creds, { siteId, interval }) {
  return doGet(creds, `/sites/${encodeURIComponent(siteId)}/traffic/summary`, { interval });
}
async function listDevices(creds, params = {}) {
  return doGet(creds, "/devices", { ...params });
}
async function getDevice(creds, id) {
  return doGet(creds, `/devices/${encodeURIComponent(id)}`);
}
async function getDeviceDetail(creds, { id, withStations }) {
  return doGet(creds, `/devices/${encodeURIComponent(id)}/detail`, { withStations });
}
async function getDeviceStatistics(creds, { id, interval }) {
  return doGet(creds, `/devices/${encodeURIComponent(id)}/statistics`, { interval });
}
async function listDeviceInterfaces(creds, deviceId) {
  return doGet(creds, `/devices/${encodeURIComponent(deviceId)}/interfaces`);
}
async function getDeviceByMac(creds, mac) {
  return doGet(creds, `/devices/mac/${encodeURIComponent(mac)}`);
}
async function listDiscoveredDevices(creds) {
  return doGet(creds, "/devices/discovered");
}
async function listOutages(creds, params) {
  return doGet(creds, "/outages", { ...params });
}
async function listLogs(creds, params) {
  return doGet(creds, "/logs", { ...params });
}
async function listDataLinks(creds, params = {}) {
  return doGet(creds, "/data-links", { ...params });
}
async function getDataLink(creds, id) {
  return doGet(creds, `/data-links/${encodeURIComponent(id)}`);
}
async function listSiteDataLinks(creds, siteId) {
  return doGet(creds, `/data-links/sites/${encodeURIComponent(siteId)}`);
}
async function listGateways(creds) {
  return doGet(creds, "/gateways");
}
async function getGateway(creds, id) {
  return doGet(creds, `/gateways/${encodeURIComponent(id)}`);
}
async function listTasks(creds, params) {
  return doGet(creds, "/tasks", { ...params });
}
async function getTasksInProgress(creds) {
  return doGet(creds, "/tasks/in-progress");
}
async function listFirmwares(creds) {
  return doGet(creds, "/firmwares");
}
async function getSpeedTests(creds) {
  return doGet(creds, "/speed-tests");
}

// src/server.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";

// src/tools/shared.ts
function textResult(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return { content: [{ type: "text", text }] };
}
function errorResult(message) {
  return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
}
function requireCredentials(creds) {
  if (!creds) {
    return errorResult("No UISP credentials configured. Set UISP_API_KEY and UISP_BASE_URL.");
  }
  return null;
}
var PAGE_PARAMS_PROPERTIES = {
  count: { type: "number", description: "Number of results per page." },
  page: { type: "number", description: "Page number (1-indexed)." }
};

// src/tools/datalinks.ts
var DATA_LINK_TOOLS = [
  {
    name: "uisp_list_data_links",
    description: "List data links - the wireless/wired links UISP has mapped between devices and sites, with signal/frequency/distance detail.",
    inputSchema: {
      type: "object",
      properties: {
        siteLinksOnly: { type: "boolean", description: "Only return data links between sites (excludes device-to-device links)." }
      }
    }
  },
  {
    name: "uisp_get_data_link",
    description: "Get a single data link's detail by ID.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "Data link ID (from uisp_list_data_links)." } },
      required: ["id"]
    }
  },
  {
    name: "uisp_list_site_data_links",
    description: "List data links attached to a given site.",
    inputSchema: {
      type: "object",
      properties: { siteId: { type: "string", description: "Site ID (from uisp_list_sites)." } },
      required: ["siteId"]
    }
  }
];
var TOOL_NAMES = new Set(DATA_LINK_TOOLS.map((t) => t.name));
function isDataLinkTool(name) {
  return TOOL_NAMES.has(name);
}
async function handleDataLinkTool(name, args) {
  const creds = getCredentials();
  const missing = requireCredentials(creds);
  if (missing) return missing;
  try {
    if (name === "uisp_list_data_links") {
      return textResult(await listDataLinks(creds, { siteLinksOnly: args.siteLinksOnly }));
    }
    if (name === "uisp_get_data_link") {
      return textResult(await getDataLink(creds, args.id));
    }
    if (name === "uisp_list_site_data_links") {
      return textResult(await listSiteDataLinks(creds, args.siteId));
    }
    return errorResult(`Unknown tool: ${name}`);
  } catch (err) {
    return errorResult(err.message);
  }
}

// src/tools/devices.ts
var DEVICE_TYPES = [
  "onu",
  "olt",
  "uispp",
  "uispr",
  "uisps",
  "uispLte",
  "erouter",
  "eswitch",
  "epower",
  "airCube",
  "airMax",
  "airFiber",
  "toughSwitch",
  "solarBeam",
  "wave",
  "blackBox"
];
var DEVICE_ROLES = ["router", "switch", "gpon", "ap", "station", "other", "ups", "server", "wireless", "convertor", "gateway"];
var DEVICE_TOOLS = [
  {
    name: "uisp_list_devices",
    description: "List devices (hostname/IP/MAC, status, parent site), optionally filtered by site/type/role/authorization. Each device's `id` chains into uisp_get_device, uisp_get_device_detail, uisp_get_device_statistics, and uisp_list_device_interfaces.",
    inputSchema: {
      type: "object",
      properties: {
        siteId: { type: "string", description: "Filter to devices at this site (from uisp_list_sites)." },
        withInterfaces: { type: "boolean", description: "Include each device's interfaces in the response." },
        authorized: { type: "boolean", description: "Filter to authorized (true) or pending-authorization (false) devices." },
        type: { type: "array", items: { type: "string", enum: DEVICE_TYPES }, description: "Filter by device type." },
        role: { type: "array", items: { type: "string", enum: DEVICE_ROLES }, description: "Filter by device role." }
      }
    }
  },
  {
    name: "uisp_get_device",
    description: "Get a single device's status overview by ID.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "Device ID (from uisp_list_devices)." } },
      required: ["id"]
    }
  },
  {
    name: "uisp_get_device_detail",
    description: "Get a single device's detail, optionally including its interfaces and/or connected stations.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Device ID (from uisp_list_devices)." },
        withStations: { type: "boolean", description: "Include the device's connected wireless stations." }
      },
      required: ["id"]
    }
  },
  {
    name: "uisp_get_device_statistics",
    description: "Get device telemetry (CPU/RAM/signal/temperature/throughput) bucketed by interval.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Device ID (from uisp_list_devices)." },
        interval: {
          type: "string",
          enum: ["hour", "day", "month", "quarter", "year"],
          description: "Time bucket for the statistics."
        }
      },
      required: ["id", "interval"]
    }
  },
  {
    name: "uisp_list_device_interfaces",
    description: "List a device's network interfaces, including their configured IP addresses and status.",
    inputSchema: {
      type: "object",
      properties: { deviceId: { type: "string", description: "Device ID (from uisp_list_devices)." } },
      required: ["deviceId"]
    }
  },
  {
    name: "uisp_get_device_by_mac",
    description: "Look up a device by its MAC address.",
    inputSchema: {
      type: "object",
      properties: { mac: { type: "string", description: "Device MAC address, e.g. 78:8a:20:5f:2a:ff." } },
      required: ["mac"]
    }
  },
  {
    name: "uisp_list_discovered_devices",
    description: "List devices UISP has discovered on the network but which have not yet been added.",
    inputSchema: { type: "object", properties: {} }
  }
];
var TOOL_NAMES2 = new Set(DEVICE_TOOLS.map((t) => t.name));
function isDeviceTool(name) {
  return TOOL_NAMES2.has(name);
}
async function handleDeviceTool(name, args) {
  const creds = getCredentials();
  const missing = requireCredentials(creds);
  if (missing) return missing;
  try {
    if (name === "uisp_list_devices") {
      return textResult(
        await listDevices(creds, {
          siteId: args.siteId,
          withInterfaces: args.withInterfaces,
          authorized: args.authorized,
          type: args.type,
          role: args.role
        })
      );
    }
    if (name === "uisp_get_device") {
      return textResult(await getDevice(creds, args.id));
    }
    if (name === "uisp_get_device_detail") {
      return textResult(await getDeviceDetail(creds, { id: args.id, withStations: args.withStations }));
    }
    if (name === "uisp_get_device_statistics") {
      return textResult(
        await getDeviceStatistics(creds, {
          id: args.id,
          interval: args.interval
        })
      );
    }
    if (name === "uisp_list_device_interfaces") {
      return textResult(await listDeviceInterfaces(creds, args.deviceId));
    }
    if (name === "uisp_get_device_by_mac") {
      return textResult(await getDeviceByMac(creds, args.mac));
    }
    if (name === "uisp_list_discovered_devices") {
      return textResult(await listDiscoveredDevices(creds));
    }
    return errorResult(`Unknown tool: ${name}`);
  } catch (err) {
    return errorResult(err.message);
  }
}

// src/tools/firmware.ts
var FIRMWARE_TOOLS = [
  {
    name: "uisp_list_firmwares",
    description: "Get the firmware versions available to UISP for its supported device models.",
    inputSchema: { type: "object", properties: {} }
  }
];
var TOOL_NAMES3 = new Set(FIRMWARE_TOOLS.map((t) => t.name));
function isFirmwareTool(name) {
  return TOOL_NAMES3.has(name);
}
async function handleFirmwareTool(name, _args) {
  const creds = getCredentials();
  const missing = requireCredentials(creds);
  if (missing) return missing;
  try {
    if (name === "uisp_list_firmwares") {
      return textResult(await listFirmwares(creds));
    }
    return errorResult(`Unknown tool: ${name}`);
  } catch (err) {
    return errorResult(err.message);
  }
}

// src/tools/gateways.ts
var GATEWAY_TOOLS = [
  {
    name: "uisp_list_gateways",
    description: "List gateways - routers configured as network gateways - and their NetFlow/QoS/suspend configuration.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "uisp_get_gateway",
    description: "Get a single gateway's detail by ID.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "Gateway ID (from uisp_list_gateways)." } },
      required: ["id"]
    }
  }
];
var TOOL_NAMES4 = new Set(GATEWAY_TOOLS.map((t) => t.name));
function isGatewayTool(name) {
  return TOOL_NAMES4.has(name);
}
async function handleGatewayTool(name, args) {
  const creds = getCredentials();
  const missing = requireCredentials(creds);
  if (missing) return missing;
  try {
    if (name === "uisp_list_gateways") {
      return textResult(await listGateways(creds));
    }
    if (name === "uisp_get_gateway") {
      return textResult(await getGateway(creds, args.id));
    }
    return errorResult(`Unknown tool: ${name}`);
  } catch (err) {
    return errorResult(err.message);
  }
}

// src/tools/logs.ts
var LOG_TAGS = [
  "login",
  "device",
  "email-dispatch",
  "nms-backup",
  "nms-update",
  "nms-error",
  "device-state",
  "device-backup",
  "device-upgrade",
  "device-interface",
  "site"
];
var LOG_TOOLS = [
  {
    name: "uisp_list_logs",
    description: "List the UISP event/audit log (e.g. logins, device state changes, backups, upgrades). Log messages can embed device MAC/IP addresses. Filter by site, device, severity level, event tag, or a text query.",
    inputSchema: {
      type: "object",
      properties: {
        siteId: { type: "string", description: "Filter to log items for this site." },
        deviceId: { type: "array", items: { type: "string" }, description: "Filter to log items for these device IDs." },
        level: { type: "string", enum: ["info", "warning", "error"], description: "Filter by severity level." },
        tag: { type: "string", enum: LOG_TAGS, description: "Filter by event tag/category." },
        period: { type: "number", description: "Restrict to log items within the last N days." },
        query: { type: "string", description: "Text search across log messages." },
        ...PAGE_PARAMS_PROPERTIES
      },
      required: ["count", "page"]
    }
  }
];
var TOOL_NAMES5 = new Set(LOG_TOOLS.map((t) => t.name));
function isLogTool(name) {
  return TOOL_NAMES5.has(name);
}
async function handleLogTool(name, args) {
  const creds = getCredentials();
  const missing = requireCredentials(creds);
  if (missing) return missing;
  try {
    if (name === "uisp_list_logs") {
      return textResult(
        await listLogs(creds, {
          count: args.count,
          page: args.page,
          siteId: args.siteId,
          deviceId: args.deviceId,
          level: args.level,
          tag: args.tag,
          period: args.period,
          query: args.query
        })
      );
    }
    return errorResult(`Unknown tool: ${name}`);
  } catch (err) {
    return errorResult(err.message);
  }
}

// src/tools/outages.ts
var OUTAGE_TOOLS = [
  {
    name: "uisp_list_outages",
    description: "List network outages - UISP's alerting surface - each tied to a site and device. Filter by device, type (outage/unreachable), a text query, or in-progress state.",
    inputSchema: {
      type: "object",
      properties: {
        deviceId: { type: "string", description: "Filter to outages for this device ID." },
        period: { type: "number", description: "Restrict to outages within the last N days." },
        query: { type: "string", description: "Text search across outage records." },
        type: { type: "string", enum: ["outage", "unreachable"], description: "Filter by outage type." },
        inProgress: { type: "boolean", description: "Filter to outages that are still ongoing." },
        ...PAGE_PARAMS_PROPERTIES
      },
      required: ["count", "page"]
    }
  }
];
var TOOL_NAMES6 = new Set(OUTAGE_TOOLS.map((t) => t.name));
function isOutageTool(name) {
  return TOOL_NAMES6.has(name);
}
async function handleOutageTool(name, args) {
  const creds = getCredentials();
  const missing = requireCredentials(creds);
  if (missing) return missing;
  try {
    if (name === "uisp_list_outages") {
      return textResult(
        await listOutages(creds, {
          count: args.count,
          page: args.page,
          deviceId: args.deviceId,
          period: args.period,
          query: args.query,
          type: args.type,
          inProgress: args.inProgress
        })
      );
    }
    return errorResult(`Unknown tool: ${name}`);
  } catch (err) {
    return errorResult(err.message);
  }
}

// src/tools/sites.ts
var SITE_INTERVAL_PROPERTY = {
  type: "string",
  enum: ["hour", "day", "month"],
  description: "Time bucket for the traffic figures."
};
var SITE_TOOLS = [
  {
    name: "uisp_list_sites",
    description: "List sites (network locations - sites, endpoints, and clients - each optionally tied to a UCRM client/service record). Each site's `id` chains into uisp_get_site, uisp_list_site_clients, uisp_list_devices (siteId filter), and uisp_get_site_statistics.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "array", items: { type: "string" }, description: "Filter to specific site IDs." },
        ip: { type: "string", description: "Filter to the site whose endpoint has this IP address." },
        deviceId: { type: "string", description: "Filter to the site containing this device ID." },
        type: { type: "string", enum: ["site", "endpoint", "client"], description: "Filter by site type." },
        ucrm: { type: "boolean", description: "Only return sites linked to a UCRM client/service record." },
        ucrmDetails: { type: "boolean", description: "Include the linked UCRM client/service detail." }
      }
    }
  },
  {
    name: "uisp_get_site",
    description: "Get a single site's detail, including its status and (if linked) UCRM client/service reference.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Site ID (from uisp_list_sites)." },
        ucrmDetails: { type: "boolean", description: "Include the linked UCRM client/service detail." }
      },
      required: ["id"]
    }
  },
  {
    name: "uisp_search_sites",
    description: "Search sites, endpoints, and clients by name, address, MAC address, or IP address.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search text." },
        type: { type: "string", enum: ["site", "endpoint", "client"], description: "Restrict results to this site type." },
        ucrm: { type: "boolean", description: "Only return results linked to a UCRM client/service record." },
        latitude: { type: "number", description: "Latitude to bias/scope the search geographically." },
        longitude: { type: "number", description: "Longitude to bias/scope the search geographically." },
        ...PAGE_PARAMS_PROPERTIES
      },
      required: ["count", "page"]
    }
  },
  {
    name: "uisp_list_site_clients",
    description: "List all client sites belonging to a given (parent) site.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Parent site ID (from uisp_list_sites)." }
      },
      required: ["id"]
    }
  },
  {
    name: "uisp_get_site_statistics",
    description: "Get upload/download traffic between a site and its parent site, bucketed by interval.",
    inputSchema: {
      type: "object",
      properties: {
        siteId: { type: "string", description: "Site ID (from uisp_list_sites)." },
        interval: SITE_INTERVAL_PROPERTY
      },
      required: ["siteId", "interval"]
    }
  },
  {
    name: "uisp_get_site_traffic_summary",
    description: "Get a site's total upload/download for the given interval up to now.",
    inputSchema: {
      type: "object",
      properties: {
        siteId: { type: "string", description: "Site ID (from uisp_list_sites)." },
        interval: SITE_INTERVAL_PROPERTY
      },
      required: ["siteId", "interval"]
    }
  }
];
var TOOL_NAMES7 = new Set(SITE_TOOLS.map((t) => t.name));
function isSiteTool(name) {
  return TOOL_NAMES7.has(name);
}
async function handleSiteTool(name, args) {
  const creds = getCredentials();
  const missing = requireCredentials(creds);
  if (missing) return missing;
  try {
    if (name === "uisp_list_sites") {
      return textResult(
        await listSites(creds, {
          id: args.id,
          ip: args.ip,
          deviceId: args.deviceId,
          type: args.type,
          ucrm: args.ucrm,
          ucrmDetails: args.ucrmDetails
        })
      );
    }
    if (name === "uisp_get_site") {
      return textResult(await getSite(creds, { id: args.id, ucrmDetails: args.ucrmDetails }));
    }
    if (name === "uisp_search_sites") {
      return textResult(
        await searchSites(creds, {
          query: args.query,
          type: args.type,
          ucrm: args.ucrm,
          latitude: args.latitude,
          longitude: args.longitude,
          count: args.count,
          page: args.page
        })
      );
    }
    if (name === "uisp_list_site_clients") {
      return textResult(await listSiteClients(creds, args.id));
    }
    if (name === "uisp_get_site_statistics") {
      return textResult(
        await getSiteStatistics(creds, { siteId: args.siteId, interval: args.interval })
      );
    }
    if (name === "uisp_get_site_traffic_summary") {
      return textResult(
        await getSiteTrafficSummary(creds, { siteId: args.siteId, interval: args.interval })
      );
    }
    return errorResult(`Unknown tool: ${name}`);
  } catch (err) {
    return errorResult(err.message);
  }
}

// src/tools/speedtest.ts
var SPEED_TEST_TOOLS = [
  {
    name: "uisp_get_speed_tests",
    description: "Get detail about running and recent speed tests.",
    inputSchema: { type: "object", properties: {} }
  }
];
var TOOL_NAMES8 = new Set(SPEED_TEST_TOOLS.map((t) => t.name));
function isSpeedTestTool(name) {
  return TOOL_NAMES8.has(name);
}
async function handleSpeedTestTool(name, _args) {
  const creds = getCredentials();
  const missing = requireCredentials(creds);
  if (missing) return missing;
  try {
    if (name === "uisp_get_speed_tests") {
      return textResult(await getSpeedTests(creds));
    }
    return errorResult(`Unknown tool: ${name}`);
  } catch (err) {
    return errorResult(err.message);
  }
}

// src/tools/system.ts
var SYSTEM_TOOLS = [
  {
    name: "uisp_get_version",
    description: "Get the UISP version, deployment type and build info. Useful as a credential/connectivity sanity check.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "uisp_get_network_statistics",
    description: "Get network-wide statistics: client/site counts, network health, signal/link/ISP scores, data-link and uplink/downlink utilization, and outage counts.",
    inputSchema: {
      type: "object",
      properties: {
        interval: {
          type: "string",
          enum: ["hour", "day", "month", "quarter", "year"],
          description: "Time bucket for the statistics."
        },
        siri: { type: "boolean", description: "Include the SIRI (Signal Interference Ratio Index) score. Defaults to false." }
      },
      required: ["interval"]
    }
  },
  {
    name: "uisp_get_summary",
    description: "Get badge-count-like values across the instance: unread logs/outages/firmwares, active/all client and site counts, devices needing authorization, firmware up-to-dateness. Each *Timestamp param scopes that count to items newer than the given epoch-ms timestamp \u2014 pass 0 for the instance's current totals.",
    inputSchema: {
      type: "object",
      properties: {
        logsLevel: {
          type: "array",
          items: { type: "string", enum: ["info", "warning", "error"] },
          description: "Which log severities to count toward logsUnreadCount."
        },
        outagesTimestamp: { type: "number", description: "Epoch-ms timestamp; only outages newer than this count toward outagesUnreadCount." },
        logsTimestamp: { type: "number", description: "Epoch-ms timestamp; only logs newer than this count toward logsUnreadCount." },
        firmwaresTimestamp: { type: "number", description: "Epoch-ms timestamp; only firmwares newer than this count toward firmwaresUnreadCount." }
      },
      required: ["logsLevel"]
    }
  }
];
var TOOL_NAMES9 = new Set(SYSTEM_TOOLS.map((t) => t.name));
function isSystemTool(name) {
  return TOOL_NAMES9.has(name);
}
async function handleSystemTool(name, args) {
  const creds = getCredentials();
  const missing = requireCredentials(creds);
  if (missing) return missing;
  try {
    if (name === "uisp_get_version") {
      return textResult(await getVersion(creds));
    }
    if (name === "uisp_get_network_statistics") {
      return textResult(
        await getNetworkStatistics(creds, {
          interval: args.interval,
          siri: args.siri
        })
      );
    }
    if (name === "uisp_get_summary") {
      return textResult(
        await getSummary(creds, {
          logsLevel: args.logsLevel,
          outagesTimestamp: args.outagesTimestamp,
          logsTimestamp: args.logsTimestamp,
          firmwaresTimestamp: args.firmwaresTimestamp
        })
      );
    }
    return errorResult(`Unknown tool: ${name}`);
  } catch (err) {
    return errorResult(err.message);
  }
}

// src/tools/tasks.ts
var TASK_TOOLS = [
  {
    name: "uisp_list_tasks",
    description: "List background tasks (e.g. firmware upgrades, backups, mass operations) and their status.",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["success", "failed", "in-progress", "canceled", "queued"],
          description: "Filter by task status."
        },
        period: { type: "number", description: "Restrict to tasks within the last N days." },
        ...PAGE_PARAMS_PROPERTIES
      },
      required: ["count", "page"]
    }
  },
  {
    name: "uisp_get_tasks_in_progress",
    description: "Get the number of tasks currently in progress.",
    inputSchema: { type: "object", properties: {} }
  }
];
var TOOL_NAMES10 = new Set(TASK_TOOLS.map((t) => t.name));
function isTaskTool(name) {
  return TOOL_NAMES10.has(name);
}
async function handleTaskTool(name, args) {
  const creds = getCredentials();
  const missing = requireCredentials(creds);
  if (missing) return missing;
  try {
    if (name === "uisp_list_tasks") {
      return textResult(
        await listTasks(creds, {
          count: args.count,
          page: args.page,
          status: args.status,
          period: args.period
        })
      );
    }
    if (name === "uisp_get_tasks_in_progress") {
      return textResult(await getTasksInProgress(creds));
    }
    return errorResult(`Unknown tool: ${name}`);
  } catch (err) {
    return errorResult(err.message);
  }
}

// src/tools/index.ts
var ALL_TOOLS = [
  ...SITE_TOOLS,
  ...DEVICE_TOOLS,
  ...OUTAGE_TOOLS,
  ...LOG_TOOLS,
  ...DATA_LINK_TOOLS,
  ...GATEWAY_TOOLS,
  ...TASK_TOOLS,
  ...FIRMWARE_TOOLS,
  ...SPEED_TEST_TOOLS,
  ...SYSTEM_TOOLS
];
async function dispatchToolCall(name, args) {
  if (isSiteTool(name)) return handleSiteTool(name, args);
  if (isDeviceTool(name)) return handleDeviceTool(name, args);
  if (isOutageTool(name)) return handleOutageTool(name, args);
  if (isLogTool(name)) return handleLogTool(name, args);
  if (isDataLinkTool(name)) return handleDataLinkTool(name, args);
  if (isGatewayTool(name)) return handleGatewayTool(name, args);
  if (isTaskTool(name)) return handleTaskTool(name, args);
  if (isFirmwareTool(name)) return handleFirmwareTool(name, args);
  if (isSpeedTestTool(name)) return handleSpeedTestTool(name, args);
  if (isSystemTool(name)) return handleSystemTool(name, args);
  return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
}

// src/server.ts
function createServer() {
  const server = new Server(
    { name: "uisp-mcp", version: "0.1.0" },
    { capabilities: { tools: {}, logging: {} } }
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: ALL_TOOLS }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      return await dispatchToolCall(name, args || {});
    } catch (error) {
      logger.error("Tool call failed", { tool: name, error: error.message });
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true
      };
    }
  });
  return server;
}

export {
  logger,
  runWithCredentials,
  getCredentials,
  createServer
};
//# sourceMappingURL=chunk-J3UIM6U6.js.map