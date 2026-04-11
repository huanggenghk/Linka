import { Hono } from "hono";
import { createDb } from "../src/db/index.js";
import { createApp } from "../src/app.js";

/** Create a test app with an in-memory database */
export function createTestApp() {
  const db = createDb(":memory:");
  const app = createApp(db);
  return { app, db };
}

/** Send a JSON-RPC request to the MCP endpoint */
export async function mcpRequest(
  app: Hono,
  method: string,
  params: Record<string, unknown> = {},
  id: number = 1
) {
  const res = await app.request("/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  const text = await res.text();
  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("text/event-stream")) {
    // Parse SSE format: "event: message\ndata: {...}\n\n"
    const lines = text.split("\n");
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        return JSON.parse(line.slice(6));
      }
    }
    throw new Error(`No data line found in SSE response: ${text}`);
  }

  return JSON.parse(text);
}

/** Call an MCP tool and return the raw JSON-RPC response */
export async function callTool(
  app: Hono,
  toolName: string,
  args: Record<string, unknown>
) {
  return mcpRequest(app, "tools/call", {
    name: toolName,
    arguments: args,
  });
}

/** Extract parsed JSON from tool call result */
export function parseToolResult(res: any): any {
  const text = res.result?.content?.[0]?.text;
  if (!text) return null;
  return JSON.parse(text);
}

/** Check if the result is an error */
export function isToolError(res: any): boolean {
  return res.result?.isError === true;
}
