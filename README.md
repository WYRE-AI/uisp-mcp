# UISP MCP Server

MCP server for [Ubiquiti UISP](https://www.ui.com/software/uisp/)'s REST API (`/nms/api/v2.1`) - sites, devices, outages (the alerting surface), the event/audit log, data links, gateways, background tasks, available firmware, and speed tests across a UISP network/ISP-management instance - for AI assistants and the WYRE Conduit gateway.

## Authentication

UISP authenticates with a static **account token**, generated in the UISP console under **Settings -> Users -> API tokens** (tokens can be issued in read-only or read/write mode - issue a read-only token for this connector). UISP has **no shared multi-tenant endpoint**: every deployment, including Ubiquiti's own hosted-cloud tier, runs at its own instance FQDN, so this connector requires **both** a token and a base URL. The token is sent as the `x-auth-token` header to `<base URL>/nms/api/v2.1/...`. In gateway mode both arrive per-request via the `X-UISP-Api-Key` and `X-UISP-Base-URL` headers; in local/stdio mode they're read once from `UISP_API_KEY` and `UISP_BASE_URL`.

### Credential scope

**Vendor-documented, not independently verified against a live instance** (see Verification below): UISP's own console lets a token be issued in "Read Only" or "Read/Write" mode at creation time - a genuine, vendor-supported way to scope a token to reads before it's ever handed to this connector, unlike some vendors in this fleet whose keys always inherit their creating user's full permission set. This connector's own code only ever issues `GET` requests (see Scope below), but the enforcement of "no writes" for a Read/Write-mode token is UISP's, not this connector's - issuing a Read Only token is the customer's guarantee, not something this connector can force from the outside.

A closely-related finding worth stating plainly: UISP is simultaneously a network-management platform and a lightweight ISP CRM (UCRM) - a `Site` in this API can carry a linked `ucrm.client` reference that includes the real customer's name, and `uisp_list_site_clients` returns customer records. Several tools are classified `isAdmin: true` specifically for this reason even though they read like plain infrastructure inventory - see Scope below and this connector's entry in Conduit's `vendor-config.ts` for the full accounting.

### Verification

This connector was built directly against UISP's own generated OpenAPI/Swagger specification (title `UISP API`, `swagger: "2.0"`, `basePath: /nms/api/v2.1`, `securityDefinitions.UserSecurity` = the `x-auth-token` header) - every UISP installation publishes a live Swagger UI at `https://<instance>/nms/api-docs/`, and this connector's tools were verified one-by-one against that spec's 180 documented `GET` operations, not against secondary documentation or a naming convention. What it is **not** is independently verified against a live UISP instance: UISP is deployed per-ISP (self-hosted, or Ubiquiti's hosted-cloud tier requires an active ISP/network-operator account) and no such instance was available in this build environment to exercise a real token end-to-end. This is an environment limitation of the build, not a vendor-side approval gate - the hosted-cloud tier's own signup is genuinely self-serve for an ISP operator.

## Configuration

| Env var | Description |
|---|---|
| `UISP_API_KEY` | Account token issued by the UISP console. |
| `UISP_BASE_URL` | Base URL of the UISP instance, e.g. `https://uisp.example.com`. |
| `MCP_TRANSPORT` | `stdio` (default) or `http`. |
| `AUTH_MODE` | `env` (default, reads the vars above) or `gateway` (credentials arrive per-request via the `X-UISP-Api-Key` / `X-UISP-Base-URL` headers, injected by the Conduit gateway). |
| `CONDUIT_S2S_SECRET` | When set, the HTTP transport requires a valid `X-Gateway-S2S` header (Conduit sidecar auth) on every `/mcp` request. |
| `LOG_LEVEL` | `debug` \| `info` (default) \| `warn` \| `error`. |

## Tools

### Sites
- `uisp_list_sites` - list sites (network locations - sites, endpoints, and clients - each optionally tied to a UCRM client/service record).
- `uisp_get_site` - get a single site's detail.
- `uisp_search_sites` - search sites/endpoints/clients by name, address, MAC address, or IP address.
- `uisp_list_site_clients` - list all client sites belonging to a given (parent) site.
- `uisp_get_site_statistics` - get upload/download traffic between a site and its parent site.
- `uisp_get_site_traffic_summary` - get a site's total upload/download for a given interval up to now.

### Devices
- `uisp_list_devices` - list devices (hostname/IP/MAC, status, parent site).
- `uisp_get_device` - get a single device's status overview.
- `uisp_get_device_detail` - get a device's detail, optionally including interfaces and/or connected stations.
- `uisp_get_device_statistics` - get device telemetry (CPU/RAM/signal/temperature/throughput).
- `uisp_list_device_interfaces` - list a device's network interfaces, including configured IP addresses.
- `uisp_get_device_by_mac` - look up a device by its MAC address.
- `uisp_list_discovered_devices` - list devices discovered on the network but not yet added.

### Outages
- `uisp_list_outages` - list network outages - UISP's alerting surface - filterable by device, type, and in-progress state.

### Logs
- `uisp_list_logs` - list the UISP event/audit log (logins, device state changes, backups, upgrades).

### Data Links
- `uisp_list_data_links` - list data links (the wireless/wired links UISP has mapped between devices and sites).
- `uisp_get_data_link` - get a single data link's detail.
- `uisp_list_site_data_links` - list data links attached to a given site.

### Gateways
- `uisp_list_gateways` - list gateways (routers configured as network gateways) and their NetFlow/QoS/suspend configuration.
- `uisp_get_gateway` - get a single gateway's detail.

### Tasks
- `uisp_list_tasks` - list background tasks (firmware upgrades, backups, mass operations) and their status.
- `uisp_get_tasks_in_progress` - get the number of tasks currently in progress.

### Firmware
- `uisp_list_firmwares` - get the firmware versions available to UISP for its supported device models.

### Speed Test
- `uisp_get_speed_tests` - get detail about running and recent speed tests.

### System
- `uisp_get_version` - get the UISP version, deployment type, and build info. Useful as a credential/connectivity sanity check.
- `uisp_get_network_statistics` - get network-wide statistics (client/site counts, network health, signal/link/ISP scores, outage counts).
- `uisp_get_summary` - get badge-count-like values across the instance (unread logs/outages/firmwares, active client/site counts).

## Scope

**This is a deliberately narrow, read-only v1 surface covering exactly the core NOC/MSP monitoring workflow - site and device inventory, status, telemetry, outages, and the audit log - nothing else.** UISP's own OpenAPI spec documents 325 paths (180 of them `GET`) across a much larger surface: full network/device configuration and provisioning, CRM/billing, user and API-token administration, device credential storage, backups, server administration, and a planning/simulation tool. This connector implements 27 `GET` operations from that spec, verified one-by-one, and excludes everything else by design, not by oversight.

**Hard-excluded (device credential vault) - never implemented:** `GET /vault/credentials`, `/vault/credentials/devices`, `/vault/{deviceId}/credentials` - this is literally a store of device login credentials; excluded outright regardless of verb.

**Hard-excluded (API token / user / access-group administration - identity and credential management, not network data) - never implemented:** `GET /token`, `/token/{tokenId}`, `/users`, `/user`, `/user/totpauth`, `/access-groups/sites`, `/access-groups/sites/{groupId}`, `/nms/keep-alive`, `/nms/account/login/ubiquiti`.

**Hard-excluded (backups, restore, and support-bundle downloads - binary/sensitive, and restore is a write-adjacent maintenance action even where the read that feeds it is `GET`) - never implemented:** `GET /nms/backups`, `/nms/backups/{backupId}`, `/nms/backups/{backupId}/download-token`, `/nms/downloads/{token}`, `/nms/maintenance/backup`, `/nms/maintenance/backup/restore`, `/nms/maintenance/supportinfo`, `/devices/{deviceId}/backups`, `/devices/{deviceId}/backups/{backupId}`, `/devices/{id}/supportfile`.

**Hard-excluded (server administration and settings - can include mail-server/SMTP credentials and server-level config, not network/device data) - never implemented:** `GET /nms/settings`, `/nms/server-config`, `/nms/setup`, `/nms/mailserver`, `/nms/connection` (returns the UISP server's own connection key), `/nms/log-verbosity`, `/nms/update`, `/nms/update/log`, `/nms/traffic/blacklist`, `/nms/traffic/subnets`, `/nms/address`, `/nms/search`, `/nms/news`, `/nms/blog/posts`, `/nms/questionnaires/active`, `/nms/changed`, `/nms/server-time`, `/nms/heartbeat` (unauthenticated liveness only - `uisp_get_version` is this connector's authenticated sanity check instead).

**Hard-excluded (CRM/billing - a separate subsystem with its own customer-billing data model, out of a network-monitoring connector's scope) - never implemented:** `GET /crm/roles`, `/crm/service-plans`.

**Hard-excluded (GDPR/customer data export) - never implemented:** `GET /gdpr/clients/{id}` - a formatted export of one customer's personal data.

**Hard-excluded (raw device pass-through / UDAPI proxy) - never implemented:** `GET /devices/{deviceId}/udapi/{version}/{udapiUrl*}` - a generic reverse-proxy into a device's own local API; UISP's own spec does not constrain this to `GET` semantics on the far side, so it is excluded as a category regardless of the outer verb, the same treatment `unifi-mcp` gives its analogous per-console connector-proxy path.

**Hard-excluded (network discovery control-plane) - never implemented:** `GET /discovery/scan-status`, `/discovery/status/{deviceId}` - status of an active network scan, which is triggered/controlled elsewhere in the API; excluded as part of that same discovery workflow rather than picked apart.

**Hard-excluded (deep per-device configuration: DHCP, firewall, routing, VLANs, NetFlow, wireless/AirCube/AirMax/OLT/ONU config) - never implemented:** every `GET` under `/devices/erouters/*`, `/devices/uisprs/*` (DHCP leases/servers, firewall filters/mangles/NATs/sets/settings, OSPF, routes, NetFlow), `/devices/{id}/router/*`, `/devices/{id}/netflow`, `/devices/{id}/vlans`, `/devices/{id}/services`, `/devices/{id}/system`, `/devices/{id}/system/unms`, `/devices/{deviceId}/mac-table*`, `/devices/{deviceId}/interfaces/{interfaceName}`, `/devices/{deviceId}/interfaces/data-link/available`, `/devices/{deviceId}/location`, and the entire family of per-device-model detail/config/station endpoints (`/devices/aircubes/*`, `/airfibers/*`, `/airmaxes/*`, `/blackboxes/*`, `/epowers/*`, `/eswitches/*`, `/olts/*`, `/onus/*`, `/solarbeams/*`, `/toughswitches/*`, `/uispss/*`, `/waves/*`, plus `/devices/aps/profiles`, `/devices/ssids`, `/devices/models`, `/devices/macs`, `/devices/ips`, `/devices/unknown`, `/devices/import/status`) - this connector's device surface is deliberately limited to identity/status/telemetry/interfaces (`uisp_list_devices`, `uisp_get_device`, `uisp_get_device_detail`, `uisp_get_device_statistics`, `uisp_list_device_interfaces`, `uisp_get_device_by_mac`, `uisp_list_discovered_devices`), not per-vendor-model configuration.

**Hard-excluded (site sub-resources beyond the core six) - never implemented:** `GET /sites/{id}/images`, `/sites/{siteId}/images/{imageId}` (binary), `/sites/{siteId}/qos`, `/sites/{siteId}/slastats` (UISP's own summary describes this as "for ISP and SLA score debugging"), `/sites/{siteId}/traffic`, `/sites/{siteId}/traffic/interval`, `/sites/traffic` (superseded for this connector's purposes by the implemented `uisp_get_site_traffic_summary`).

**Hard-excluded (planning/simulation and field-installation tooling - not live network state) - never implemented:** `GET /simulation`, `/simulation/devices`, `/simulation/links`, `/installations/devices`, `/installations/{id}`, `/installations/{id}/{mac}/configuration`.

**Hard-excluded (misc) - never implemented:** `GET /devices/{id}/router/*` (see above), `/tasks/{batchId}` (per-task item detail beyond the implemented list/in-progress-count), `/airlink/proxy/*` (RF link-planning map/elevation data files, unrelated to live network state), `/nms/version/latest` (checks for a newer UISP release; administrative, not monitoring data).

They can be added as a follow-up if there's demand, after a deliberate scope decision - not by default.

## Development

```bash
npm install
npm run build
npm test
npm run lint   # tsc --noEmit
```

## Docker

```bash
docker build -t uisp-mcp .
docker run -p 8080:8080 -e UISP_API_KEY=... -e UISP_BASE_URL=https://uisp.example.com uisp-mcp
```
