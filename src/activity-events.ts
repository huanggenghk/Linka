import type { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import * as z from "zod/v4";
import * as schema from "./db/schema.js";
import { readJson } from "./wechat-auth.js";

type DB = BetterSQLite3Database<typeof schema>;

const BASE_URL = process.env.BASE_URL || "https://linka.zone";
const INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const createEventSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  location: z.string().trim().optional(),
  date: z.string().trim().optional(),
  organizer_name: z.string().trim().min(1),
  organizer_profile: z.string().trim().min(1),
  organizer_contact: z.string().trim().min(1),
});

const joinEventSchema = z.object({
  invite_code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  profile: z.string().trim().min(1),
  contact_info: z.string().trim().min(1),
  user_token: z.string().trim().min(1).optional(),
});

export function registerActivityEventRoutes(app: Hono, database: DB) {
  app.post("/api/events", async (c) => {
    const body = await readJson(c);
    const parsed = createEventSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "请求参数无效" }, 400);
    }

    const eventId = uuidv4();
    const inviteCode = createUniqueInviteCode(database);
    const userId = uuidv4();
    const agentId = uuidv4();

    database.transaction((tx) => {
      tx.insert(schema.events)
        .values({
          id: eventId,
          name: parsed.data.name,
          description: parsed.data.description || null,
          location: parsed.data.location || null,
          date: parsed.data.date || null,
          inviteCode,
        })
        .run();

      tx.insert(schema.users)
        .values({
          id: userId,
          name: parsed.data.organizer_name,
          contactInfo: parsed.data.organizer_contact,
        })
        .run();

      tx.insert(schema.agents)
        .values({
          id: agentId,
          eventId,
          userId,
          profile: parsed.data.organizer_profile,
        })
        .run();
    });

    return c.json(
      {
        event_id: eventId,
        invite_code: inviteCode,
        join_url: `${BASE_URL}/join/${inviteCode}`,
        card_url: `${BASE_URL}/card/${inviteCode}.png`,
        organizer_token: userId,
      },
      201
    );
  });

  app.post("/api/events/join", async (c) => {
    const body = await readJson(c);
    const parsed = joinEventSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "请求参数无效" }, 400);
    }

    const event = database
      .select()
      .from(schema.events)
      .where(eq(schema.events.inviteCode, parsed.data.invite_code))
      .get();

    if (!event) {
      return c.json({ error: "无效的邀请码" }, 404);
    }

    const userId = upsertUser(database, {
      userToken: parsed.data.user_token,
      name: parsed.data.name,
      contactInfo: parsed.data.contact_info,
    });
    const agentId = upsertAgent(database, {
      eventId: event.id,
      userId,
      profile: parsed.data.profile,
    });
    const registeredCount = database
      .select({ id: schema.agents.id })
      .from(schema.agents)
      .where(eq(schema.agents.eventId, event.id))
      .all().length;

    return c.json({
      event_id: event.id,
      event_name: event.name,
      agent_id: agentId,
      user_token: userId,
      registered_count: registeredCount,
    });
  });

  app.get("/api/events/:eventId/attendees", async (c) => {
    const eventId = c.req.param("eventId");
    const event = database
      .select({ id: schema.events.id })
      .from(schema.events)
      .where(eq(schema.events.id, eventId))
      .get();

    if (!event) {
      return c.json({ error: "活动不存在" }, 404);
    }

    const attendees = database
      .select({
        agentId: schema.agents.id,
        name: schema.users.name,
        profile: schema.agents.profile,
        contactInfo: schema.users.contactInfo,
      })
      .from(schema.agents)
      .innerJoin(schema.users, eq(schema.agents.userId, schema.users.id))
      .where(eq(schema.agents.eventId, eventId))
      .all()
      .map((row) => ({
        agent_id: row.agentId,
        name: row.name,
        profile: row.profile,
        contact_info: row.contactInfo,
      }));

    return c.json({ attendees });
  });
}

function upsertUser(
  database: DB,
  input: { userToken?: string; name: string; contactInfo: string }
) {
  if (!input.userToken) {
    const userId = uuidv4();
    database
      .insert(schema.users)
      .values({ id: userId, name: input.name, contactInfo: input.contactInfo })
      .run();
    return userId;
  }

  const existingUser = database
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, input.userToken))
    .get();

  if (existingUser) {
    database
      .update(schema.users)
      .set({ name: input.name, contactInfo: input.contactInfo })
      .where(eq(schema.users.id, existingUser.id))
      .run();
    return existingUser.id;
  }

  database
    .insert(schema.users)
    .values({
      id: input.userToken,
      name: input.name,
      contactInfo: input.contactInfo,
    })
    .run();
  return input.userToken;
}

function upsertAgent(
  database: DB,
  input: { eventId: string; userId: string; profile: string }
) {
  const existingAgent = database
    .select()
    .from(schema.agents)
    .where(
      and(
        eq(schema.agents.eventId, input.eventId),
        eq(schema.agents.userId, input.userId)
      )
    )
    .get();

  if (existingAgent) {
    database
      .update(schema.agents)
      .set({ profile: input.profile })
      .where(eq(schema.agents.id, existingAgent.id))
      .run();
    return existingAgent.id;
  }

  const agentId = uuidv4();
  database
    .insert(schema.agents)
    .values({
      id: agentId,
      eventId: input.eventId,
      userId: input.userId,
      profile: input.profile,
    })
    .run();
  return agentId;
}

function createUniqueInviteCode(database: DB) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = createInviteCode();
    const existing = database
      .select({ id: schema.events.id })
      .from(schema.events)
      .where(eq(schema.events.inviteCode, code))
      .get();
    if (!existing) return code;
  }
  throw new Error("Failed to generate unique invite code");
}

function createInviteCode() {
  let code = "";
  for (let i = 0; i < 8; i += 1) {
    code += INVITE_CODE_ALPHABET[Math.floor(Math.random() * INVITE_CODE_ALPHABET.length)];
  }
  return code;
}
