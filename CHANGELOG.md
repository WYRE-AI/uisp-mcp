# Changelog

All notable changes to this project will be documented in this file. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/).

Per-version release notes for tagged releases are published on the [GitHub Releases page](https://github.com/WYRE-AI/uisp-mcp/releases) - `semantic-release` generates them from commit history at release time.

## [Unreleased]

### Fixed

- **The HTTP transport no longer exits on a malformed request (WYREAI-741).** The request
  target was parsed against the client-supplied `Host` header, and a value that does not parse
  (or a target such as `//`) threw inside the request listener before authentication. The
  target is now parsed against a fixed base, so `Host` is no longer consulted, and a target
  that still cannot be parsed gets a `400` JSON response while the server keeps running.

### Added

- Initial v1 release: 27 read-only tools covering sites, devices, outages (the alerting surface), the event/audit log, data links, gateways, background tasks, available firmware, and speed tests, against Ubiquiti UISP's REST API (`/nms/api/v2.1`). Static account-token + per-instance base URL authentication (UISP has no shared multi-tenant endpoint; every deployment, including Ubiquiti's own hosted-cloud tier, runs at its own instance FQDN). See README's Scope section for the full list of deliberately excluded write/administration/credential-vault endpoints.
