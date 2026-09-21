#!/usr/bin/env node
import {
  createServer,
  logger
} from "./chunk-J3UIM6U6.js";

// src/index.ts
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
var server = createServer();
var transport = new StdioServerTransport();
await server.connect(transport);
logger.info("UISP MCP server started (stdio)");
//# sourceMappingURL=index.js.map