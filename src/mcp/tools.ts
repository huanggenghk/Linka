import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { v4 as uuidv4 } from "uuid";
import QRCode from "qrcode";
import { users, events, agents } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type * as schema from "../db/schema.js";

const BASE_URL = process.env.BASE_URL || "https://linka.zone";

type DB = BetterSQLite3Database<typeof schema>;

export function registerTools(server: McpServer, db: DB) {
  // Tool 1: create_event
  server.registerTool(
    "create_event",
    {
      title: "创建活动",
      description: `创建一个新的线下活动。主办方使用此工具来创建活动并获得邀请码和二维码。

Agent 应该做的事：
1. 询问主办方活动信息（名称、描述、地点、日期）
2. 调用此工具创建活动
3. 把返回的二维码图片展示给主办方，让主办方分享给参会者
4. 参会者把二维码发给自己的 Agent 即可加入`,
      inputSchema: {
        name: z.string().describe("活动名称"),
        description: z.string().optional().describe("活动描述"),
        location: z.string().optional().describe("活动地点"),
        date: z.string().optional().describe("活动日期"),
      },
    },
    async ({ name, description, location, date }) => {
      const id = uuidv4();
      const inviteCode = generateInviteCode();

      db.insert(events)
        .values({
          id,
          name,
          description: description || null,
          location: location || null,
          date: date || null,
          inviteCode,
        })
        .run();

      const joinUrl = `${BASE_URL}/join/${inviteCode}`;
      const qrCode = await QRCode.toDataURL(joinUrl);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              event_id: id,
              invite_code: inviteCode,
              join_url: joinUrl,
              qr_code: qrCode,
            }),
          },
        ],
      };
    }
  );

  // Tool 2: join_event
  server.registerTool(
    "join_event",
    {
      title: "加入活动",
      description: `加入一个活动并注册你的社交画像和联系方式。

Agent 应该做的事：
1. 基于与用户过去的沟通，自动总结一段社交画像
2. 询问用户希望暴露的联系方式
3. 调用此工具注册到活动
4. 记住返回的 user_token 和 event_id，后续使用
5. 告知用户已加入、当前人数、暴露的画像和联系方式

如果用户之前注册过，请传入 user_token 以关联身份。
如果用户重复加入同一活动，画像和联系方式会自动更新。`,
      inputSchema: {
        invite_code: z.string().describe("主办方提供的邀请码"),
        name: z.string().describe("用户显示名"),
        profile: z
          .string()
          .describe("自然语言社交画像（Agent 基于用户对话自动生成）"),
        contact_info: z
          .string()
          .describe('联系方式，如 "微信: hugo_ai"'),
        user_token: z
          .string()
          .optional()
          .describe("已有用户的 token，用于关联跨活动身份"),
      },
    },
    async ({ invite_code, name, profile, contact_info, user_token }) => {
      // Find event by invite code
      const event = db
        .select()
        .from(events)
        .where(eq(events.inviteCode, invite_code))
        .get();

      if (!event) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: "无效的邀请码",
              }),
            },
          ],
          isError: true,
        };
      }

      // Handle user identity
      let userId: string;
      if (user_token) {
        const existingUser = db
          .select()
          .from(users)
          .where(eq(users.id, user_token))
          .get();

        if (existingUser) {
          userId = existingUser.id;
          // Update user name and contact info
          db.update(users)
            .set({ name, contactInfo: contact_info })
            .where(eq(users.id, userId))
            .run();
        } else {
          // Token not found, create new user with the provided token as ID
          userId = user_token;
          db.insert(users)
            .values({ id: userId, name, contactInfo: contact_info })
            .run();
        }
      } else {
        // New user
        userId = uuidv4();
        db.insert(users)
          .values({ id: userId, name, contactInfo: contact_info })
          .run();
      }

      // Check if already joined this event (upsert)
      const existingAgent = db
        .select()
        .from(agents)
        .where(and(eq(agents.eventId, event.id), eq(agents.userId, userId)))
        .get();

      let agentId: string;
      if (existingAgent) {
        // Upsert: update profile
        agentId = existingAgent.id;
        db.update(agents)
          .set({ profile })
          .where(eq(agents.id, agentId))
          .run();
      } else {
        // New registration
        agentId = uuidv4();
        db.insert(agents)
          .values({
            id: agentId,
            eventId: event.id,
            userId,
            profile,
          })
          .run();
      }

      // Count registered agents
      const countResult = db
        .select()
        .from(agents)
        .where(eq(agents.eventId, event.id))
        .all();

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              event_id: event.id,
              event_name: event.name,
              agent_id: agentId,
              user_token: userId,
              registered_count: countResult.length,
            }),
          },
        ],
      };
    }
  );

  // Tool 3: get_attendees
  server.registerTool(
    "get_attendees",
    {
      title: "获取参会者列表",
      description: `获取活动的所有参会者画像和联系方式。

Agent 应该做的事：
1. 拿到所有参会者画像和联系方式
2. 基于用户上下文（过去对话、当前需求）做推荐排序
3. 给用户推荐最匹配的几个人，附上联系方式`,
      inputSchema: {
        event_id: z
          .string()
          .describe("活动 ID（从 join_event 返回值获取）"),
      },
    },
    async ({ event_id }) => {
      // Verify event exists
      const event = db
        .select()
        .from(events)
        .where(eq(events.id, event_id))
        .get();

      if (!event) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ error: "活动不存在" }),
            },
          ],
          isError: true,
        };
      }

      // Get all agents with their user info
      const attendeeRows = db
        .select({
          agentId: agents.id,
          name: users.name,
          profile: agents.profile,
          contactInfo: users.contactInfo,
        })
        .from(agents)
        .innerJoin(users, eq(agents.userId, users.id))
        .where(eq(agents.eventId, event_id))
        .all();

      const attendees = attendeeRows.map((row) => ({
        agent_id: row.agentId,
        name: row.name,
        profile: row.profile,
        contact_info: row.contactInfo,
      }));

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ attendees }),
          },
        ],
      };
    }
  );
}

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
