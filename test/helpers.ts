import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import { createDb } from "../src/db/index.js";
import { createApp } from "../src/app.js";
import * as schema from "../src/db/schema.js";

type DB = BetterSQLite3Database<typeof schema>;

/** Create a test app with an in-memory database */
export function createTestApp() {
  const db = createDb(":memory:");
  const app = createApp(db);
  return { app, db };
}

export function seedLegacyEvent(
  db: DB,
  input: {
    name: string;
    description?: string | null;
    location?: string | null;
    date?: string | null;
    organizerName?: string;
    organizerProfile?: string;
    organizerContact?: string;
  }
) {
  const eventId = uuidv4();
  const inviteCode = createInviteCode();
  const organizerUserId = uuidv4();
  const organizerAgentId = uuidv4();

  db.transaction((tx) => {
    tx.insert(schema.events)
      .values({
        id: eventId,
        name: input.name,
        description: input.description ?? null,
        location: input.location ?? null,
        date: input.date ?? null,
        inviteCode,
      })
      .run();

    tx.insert(schema.users)
      .values({
        id: organizerUserId,
        name: input.organizerName ?? "主办方",
        contactInfo: input.organizerContact ?? "微信: organizer",
      })
      .run();

    tx.insert(schema.agents)
      .values({
        id: organizerAgentId,
        eventId,
        userId: organizerUserId,
        profile: input.organizerProfile ?? "活动发起人",
      })
      .run();
  });

  return {
    eventId,
    inviteCode,
    organizerUserId,
    organizerAgentId,
  };
}

export function seedLegacyAttendee(
  db: DB,
  input: {
    eventId: string;
    name: string;
    profile: string;
    contactInfo: string;
    userId?: string;
  }
) {
  const userId = input.userId ?? uuidv4();
  const agentId = uuidv4();

  db.transaction((tx) => {
    tx.insert(schema.users)
      .values({
        id: userId,
        name: input.name,
        contactInfo: input.contactInfo,
      })
      .onConflictDoUpdate({
        target: schema.users.id,
        set: { name: input.name, contactInfo: input.contactInfo },
      })
      .run();

    tx.insert(schema.agents)
      .values({
        id: agentId,
        eventId: input.eventId,
        userId,
        profile: input.profile,
      })
      .run();
  });

  return { userId, agentId };
}

function createInviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}
