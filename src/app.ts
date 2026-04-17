import { Hono } from "hono";
import { cors } from "hono/cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { registerTools } from "./mcp/tools.js";
import { createDb } from "./db/index.js";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { count, eq } from "drizzle-orm";
import * as schema from "./db/schema.js";

type DB = BetterSQLite3Database<typeof schema>;

export function createApp(db?: DB) {
  const database = db ?? createDb();

  function createMcpServer(): McpServer {
    const server = new McpServer({
      name: "linka",
      version: "1.0.0",
    });
    registerTools(server, database);
    return server;
  }

  const app = new Hono();

  app.use(
    "*",
    cors({
      origin: "*",
      allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
      allowHeaders: [
        "Content-Type",
        "mcp-session-id",
        "Last-Event-ID",
        "mcp-protocol-version",
      ],
      exposeHeaders: ["mcp-session-id", "mcp-protocol-version"],
    })
  );

  app.get("/health", (c) => c.json({ status: "ok" }));

  app.get("/api/stats", async (c) => {
    const [eventsResult] = await database
      .select({ value: count() })
      .from(schema.events);
    const [agentsResult] = await database
      .select({ value: count() })
      .from(schema.agents);
    return c.json({
      events: eventsResult.value,
      agents: agentsResult.value,
    });
  });

  app.get("/join/:code", async (c) => {
    const code = c.req.param("code");
    const event = database
      .select()
      .from(schema.events)
      .where(eq(schema.events.inviteCode, code))
      .get();

    if (!event) {
      const accept = c.req.header("Accept") || "";
      if (accept.includes("text/html")) {
        return c.html("<html><body><h1>活动不存在</h1><p>邀请码无效或活动已关闭。</p></body></html>", 404);
      }
      return c.json({ error: "活动不存在" }, 404);
    }

    const accept = c.req.header("Accept") || "";
    if (accept.includes("text/html")) {
      const html = `<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${event.name} - Linka</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 480px; margin: 40px auto; padding: 0 20px; color: #333; }
    h1 { font-size: 1.5rem; margin-bottom: 8px; }
    .meta { color: #666; font-size: 0.9rem; margin-bottom: 16px; }
    .desc { line-height: 1.6; margin-bottom: 24px; }
    .join-hint { background: #f5f0e8; padding: 16px; border-radius: 8px; font-size: 0.9rem; line-height: 1.6; }
    code { background: #e8e0d0; padding: 2px 6px; border-radius: 4px; font-size: 0.85rem; }
  </style>
</head>
<body>
  <h1>${event.name}</h1>
  <div class="meta">
    ${event.date ? `<span>📅 ${event.date}</span>` : ""}
    ${event.location ? `<span> · 📍 ${event.location}</span>` : ""}
  </div>
  ${event.description ? `<p class="desc">${event.description}</p>` : ""}
  <div class="join-hint">
    <strong>如何加入？</strong><br>
    把这个页面的链接或二维码发给你的 AI 助手（Claude、飞书 aily 等），它会自动帮你加入活动。<br><br>
    邀请码：<code>${event.inviteCode}</code>
  </div>
</body>
</html>`;
      return c.html(html);
    }

    return c.json({
      event_name: event.name,
      description: event.description,
      location: event.location,
      date: event.date,
      invite_code: event.inviteCode,
    });
  });

  app.all("/mcp", async (c) => {
    const transport = new WebStandardStreamableHTTPServerTransport();
    const server = createMcpServer();
    await server.connect(transport);
    return transport.handleRequest(c.req.raw);
  });

  return app;
}
