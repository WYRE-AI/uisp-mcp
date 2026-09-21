#!/usr/bin/env node
import {
  createServer,
  getCredentials,
  logger,
  runWithCredentials
} from "./chunk-J3UIM6U6.js";

// src/http.ts
import { createServer as createHttpServer } from "http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

// src/s2s-verify.ts
import { createHmac, timingSafeEqual } from "crypto";
var S2S_HEADER = "x-gateway-s2s";
var HEADER_VALUE_RE = /^t=(\d{1,15}),v1=([0-9a-f]{64})$/;
function verifyS2sHeader(headerValue, secret, maxSkewSeconds = 300) {
  if (!secret || !headerValue) return false;
  const match = HEADER_VALUE_RE.exec(headerValue);
  if (!match) return false;
  const t = Number(match[1]);
  if (!Number.isSafeInteger(t)) return false;
  if (Math.abs(Math.floor(Date.now() / 1e3) - t) > maxSkewSeconds) return false;
  const expected = createHmac("sha256", secret).update(`t=${t}`).digest();
  const provided = Buffer.from(match[2], "hex");
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

// src/http.ts
var S2S_SECRET = process.env.CONDUIT_S2S_SECRET || "";
function startHttpServer() {
  const port = parseInt(process.env.MCP_HTTP_PORT || "8080", 10);
  const host = process.env.MCP_HTTP_HOST || "0.0.0.0";
  const isGatewayMode = process.env.AUTH_MODE === "gateway";
  const httpServer = createHttpServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (url.pathname === "/health") {
      const creds = getCredentials();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          transport: "http",
          mode: isGatewayMode ? "gateway" : "standalone",
          credentials: { configured: !!creds },
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        })
      );
      return;
    }
    if (url.pathname !== "/mcp") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found", endpoints: ["/mcp", "/health"] }));
      return;
    }
    if (S2S_SECRET && !verifyS2sHeader(req.headers[S2S_HEADER], S2S_SECRET)) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Missing or invalid X-Gateway-S2S header: this endpoint only accepts requests signed by the gateway."
        })
      );
      return;
    }
    const apiKey = isGatewayMode ? req.headers["x-uisp-api-key"] : void 0;
    const baseUrl = isGatewayMode ? req.headers["x-uisp-base-url"] : void 0;
    const handle = async () => {
      const server = createServer();
      const transport2 = new StreamableHTTPServerTransport({
        sessionIdGenerator: void 0,
        enableJsonResponse: true
      });
      res.on("close", () => {
        transport2.close();
        server.close();
      });
      await server.connect(transport2);
      await transport2.handleRequest(req, res);
    };
    if (apiKey && baseUrl) {
      await runWithCredentials({ apiKey, baseUrl }, handle);
    } else {
      await handle();
    }
  });
  httpServer.listen(port, host, () => {
    logger.info(`HTTP streaming server listening on ${host}:${port}`);
  });
}
var transport = process.env.MCP_TRANSPORT;
if (transport === "http") {
  startHttpServer();
} else {
  import("./index.js");
}
//# sourceMappingURL=http.js.map