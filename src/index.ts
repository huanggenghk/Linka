import { serve } from "@hono/node-server";
import { createApp } from "./app.js";

const app = createApp();

const PORT = parseInt(process.env.PORT || "3000", 10);

console.log(`Linka MCP Server`);
console.log(`Health: http://localhost:${PORT}/health`);
console.log(`MCP:    http://localhost:${PORT}/mcp`);

serve({ fetch: app.fetch, port: PORT });
