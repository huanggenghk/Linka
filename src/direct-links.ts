import type { Hono } from "hono";
import { and, desc, eq, or } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { randomBytes } from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import * as schema from "./db/schema.js";
import {
  MOCK_WECHAT_USER_HEADER,
  getActiveBinding,
  getMockWechatUserId,
} from "./agent-bindings.js";

type DB = BetterSQLite3Database<typeof schema>;

export function registerDirectLinkRoutes(app: Hono, database: DB) {
  app.post("/api/direct-shares", async (c) => {
    const wechatUserId = getMockWechatUserId(c);
    if (!wechatUserId) {
      return c.json({ error: `${MOCK_WECHAT_USER_HEADER} 不能为空` }, 400);
    }

    const initiatorBinding = getActiveBinding(database, wechatUserId);
    if (!initiatorBinding) {
      return c.json({ error: "请先绑定你的 AI 助手" }, 403);
    }

    const shareId = createShareId();
    const now = new Date().toISOString();

    database
      .insert(schema.directShares)
      .values({
        id: shareId,
        initiatorWechatUserId: wechatUserId,
        createdAt: now,
      })
      .run();

    return c.json(
      {
        share_id: shareId,
        share_path: `/pages/index/index?share_id=${shareId}`,
        initiator_agent_platform: initiatorBinding.agentPlatform,
        initiator_agent_name: initiatorBinding.agentName,
        created_at: now,
      },
      201
    );
  });

  app.get("/api/direct-shares/:shareId", async (c) => {
    const share = getShare(database, c.req.param("shareId"));
    if (!share) {
      return c.json({ error: "建联邀请不存在" }, 404);
    }

    const initiatorBinding = getActiveBinding(
      database,
      share.initiatorWechatUserId
    );
    if (!initiatorBinding) {
      return c.json({ error: "发起方尚未绑定 AI 助手" }, 410);
    }

    const viewerWechatUserId = getMockWechatUserId(c);
    const viewerBinding = viewerWechatUserId
      ? getActiveBinding(database, viewerWechatUserId)
      : null;

    return c.json({
      share_id: share.id,
      created_at: share.createdAt,
      initiator_agent_platform: initiatorBinding.agentPlatform,
      initiator_agent_name: initiatorBinding.agentName,
      viewer_status:
        viewerWechatUserId === share.initiatorWechatUserId
          ? "self"
          : viewerBinding
            ? "bound"
            : "unbound",
    });
  });

  app.post("/api/direct-shares/:shareId/accept", async (c) => {
    const receiverWechatUserId = getMockWechatUserId(c);
    if (!receiverWechatUserId) {
      return c.json({ error: `${MOCK_WECHAT_USER_HEADER} 不能为空` }, 400);
    }

    const receiverBinding = getActiveBinding(database, receiverWechatUserId);
    if (!receiverBinding) {
      return c.json({ error: "请先绑定你的 AI 助手" }, 403);
    }

    const share = getShare(database, c.req.param("shareId"));
    if (!share) {
      return c.json({ error: "建联邀请不存在" }, 404);
    }

    if (share.initiatorWechatUserId === receiverWechatUserId) {
      return c.json({ error: "不能和自己建联" }, 409);
    }

    const initiatorBinding = getActiveBinding(
      database,
      share.initiatorWechatUserId
    );
    if (!initiatorBinding) {
      return c.json({ error: "发起方尚未绑定 AI 助手" }, 410);
    }

    const [userAWechatUserId, userBWechatUserId] = sortPair(
      share.initiatorWechatUserId,
      receiverWechatUserId
    );

    const existingEdge = getEdge(database, userAWechatUserId, userBWechatUserId);
    if (existingEdge) {
      return c.json(formatEdge(existingEdge, receiverWechatUserId, database));
    }

    const edge = {
      id: uuidv4(),
      userAWechatUserId,
      userBWechatUserId,
      createdByShareId: share.id,
      createdAt: new Date().toISOString(),
    };

    database.insert(schema.directEdges).values(edge).run();
    return c.json(formatEdge(edge, receiverWechatUserId, database), 201);
  });

  app.get("/api/direct-edges", async (c) => {
    const wechatUserId = getMockWechatUserId(c);
    if (!wechatUserId) {
      return c.json({ error: `${MOCK_WECHAT_USER_HEADER} 不能为空` }, 400);
    }

    const binding = getActiveBinding(database, wechatUserId);
    if (!binding) {
      return c.json({ error: "请先绑定你的 AI 助手" }, 403);
    }

    const edges = database
      .select()
      .from(schema.directEdges)
      .where(
        or(
          eq(schema.directEdges.userAWechatUserId, wechatUserId),
          eq(schema.directEdges.userBWechatUserId, wechatUserId)
        )
      )
      .orderBy(desc(schema.directEdges.createdAt))
      .all()
      .map((edge) => formatEdge(edge, wechatUserId, database));

    return c.json({ edges });
  });
}

function getShare(database: DB, shareId: string) {
  return database
    .select()
    .from(schema.directShares)
    .where(eq(schema.directShares.id, shareId))
    .get();
}

function getEdge(database: DB, userAWechatUserId: string, userBWechatUserId: string) {
  return database
    .select()
    .from(schema.directEdges)
    .where(
      and(
        eq(schema.directEdges.userAWechatUserId, userAWechatUserId),
        eq(schema.directEdges.userBWechatUserId, userBWechatUserId)
      )
    )
    .get();
}

function formatEdge(
  edge: typeof schema.directEdges.$inferSelect,
  viewerWechatUserId: string,
  database: DB
) {
  const peerWechatUserId =
    edge.userAWechatUserId === viewerWechatUserId
      ? edge.userBWechatUserId
      : edge.userAWechatUserId;
  const peerBinding = getActiveBinding(database, peerWechatUserId);

  return {
    edge_id: edge.id,
    peer_wechat_user_id: peerWechatUserId,
    peer_agent_platform: peerBinding?.agentPlatform ?? null,
    peer_agent_name: peerBinding?.agentName ?? null,
    created_at: edge.createdAt,
  };
}

function sortPair(a: string, b: string) {
  return a < b ? [a, b] : [b, a];
}

function createShareId() {
  return randomBytes(12).toString("base64url");
}
