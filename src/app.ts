import { Hono } from "hono";
import { cors } from "hono/cors";
import { generateInviteCard } from "./cards/invite-card.js";
import { createDb } from "./db/index.js";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { count, desc, eq } from "drizzle-orm";
import * as schema from "./db/schema.js";
import { renderJoinPage } from "./views/join.js";
import { registerActivityEventRoutes } from "./activity-events.js";
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

  registerActivityEventRoutes(app, database);
  registerWechatAuthRoutes(app, database);
  registerAgentBindingRoutes(app, database);
  registerDirectLinkRoutes(app, database);
  registerAgentProfileRoutes(app, database);

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
      const feedRows = database
        .select({
          name: schema.users.name,
          profile: schema.agents.profile,
          joinedAt: schema.agents.createdAt,
        })
        .from(schema.agents)
        .innerJoin(schema.users, eq(schema.agents.userId, schema.users.id))
        .where(eq(schema.agents.eventId, event.id))
        .orderBy(desc(schema.agents.createdAt))
        .limit(12)
        .all();

      const [activeResult] = database
        .select({ value: count() })
        .from(schema.agents)
        .where(eq(schema.agents.eventId, event.id))
        .all();

      const baseUrl = process.env.BASE_URL || "https://linka.zone";

      const html = renderJoinPage({
        event: {
          name: event.name,
          date: event.date,
          location: event.location,
          host: null,
        },
        activeCount: activeResult?.value ?? 0,
        feed: feedRows.map((r) => ({
          name: r.name,
          profilePreview: r.profile,
          joinedAt: r.joinedAt,
        })),
        joinUrl: `${baseUrl}/join/${event.inviteCode}`,
      });

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

  app.get("/card/:code{.+\\.png}", async (c) => {
    const codeParam = c.req.param("code").replace(/\.png$/, "");
    const event = database
      .select()
      .from(schema.events)
      .where(eq(schema.events.inviteCode, codeParam))
      .get();

    if (!event) {
      return c.json({ error: "活动不存在" }, 404);
    }

    const baseUrl = process.env.BASE_URL || "https://linka.zone";
    const cardPng = await generateInviteCard({
      eventName: event.name,
      date: event.date,
      location: event.location,
      joinUrl: `${baseUrl}/join/${event.inviteCode}`,
    });

    c.header("Content-Type", "image/png");
    c.header("Cache-Control", "public, max-age=86400, immutable");
    return c.body(new Uint8Array(cardPng));
  });
  return app;
}
