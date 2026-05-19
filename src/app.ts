import { Hono } from "hono";
import { cors } from "hono/cors";
import { createDb } from "./db/index.js";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./db/schema.js";
import { registerAgentBindingRoutes } from "./agent-bindings.js";
import { registerDirectLinkRoutes } from "./direct-links.js";
import { registerWechatAuthRoutes } from "./wechat-auth.js";
import { registerAgentProfileRoutes } from "./agent-profiles.js";

type DB = BetterSQLite3Database<typeof schema>;

export function createApp(db?: DB) {
  const database = db ?? createDb();

  const app = new Hono();

  app.use(
    "*",
    cors({
      origin: "*",
      allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
      allowHeaders: [
        "Content-Type",
        "Authorization",
        "X-Mock-Wechat-User-Id",
      ],
    })
  );

  app.get("/health", (c) => c.json({ status: "ok" }));

  registerWechatAuthRoutes(app, database);
  registerAgentBindingRoutes(app, database);
  registerDirectLinkRoutes(app, database);
  registerAgentProfileRoutes(app, database);
  return app;
}
