import { sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(), // UUID, also serves as user_token
  name: text("name").notNull(),
  contactInfo: text("contact_info").notNull(),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const events = sqliteTable("events", {
  id: text("id").primaryKey(), // UUID
  name: text("name").notNull(),
  description: text("description"),
  location: text("location"),
  date: text("date"),
  inviteCode: text("invite_code").unique().notNull(),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const agents = sqliteTable(
  "agents",
  {
    id: text("id").primaryKey(), // UUID
    eventId: text("event_id")
      .notNull()
      .references(() => events.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    profile: text("profile").notNull(),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    uniqueIndex("agents_event_user_idx").on(table.eventId, table.userId),
  ]
);

export const wechatUsers = sqliteTable("wechat_users", {
  id: text("id").primaryKey(), // Mock WeChat user id for mini-wx MVP
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const bindingSessions = sqliteTable("binding_sessions", {
  id: text("id").primaryKey(),
  wechatUserId: text("wechat_user_id")
    .notNull()
    .references(() => wechatUsers.id),
  bindingCode: text("binding_code").unique().notNull(),
  copyPrompt: text("copy_prompt").notNull(),
  expiresAt: text("expires_at").notNull(),
  claimedAt: text("claimed_at"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const agentBindings = sqliteTable(
  "agent_bindings",
  {
    id: text("id").primaryKey(),
    wechatUserId: text("wechat_user_id")
      .notNull()
      .references(() => wechatUsers.id),
    agentPlatform: text("agent_platform").notNull(),
    agentName: text("agent_name").notNull(),
    skillInstanceId: text("skill_instance_id"),
    agentToken: text("agent_token").notNull(),
    boundAt: text("bound_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    revokedAt: text("revoked_at"),
  },
  (table) => [
    uniqueIndex("agent_bindings_agent_token_idx").on(table.agentToken),
  ]
);

export const directShares = sqliteTable("direct_shares", {
  id: text("id").primaryKey(),
  initiatorWechatUserId: text("initiator_wechat_user_id")
    .notNull()
    .references(() => wechatUsers.id),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const directEdges = sqliteTable(
  "direct_edges",
  {
    id: text("id").primaryKey(),
    userAWechatUserId: text("user_a_wechat_user_id")
      .notNull()
      .references(() => wechatUsers.id),
    userBWechatUserId: text("user_b_wechat_user_id")
      .notNull()
      .references(() => wechatUsers.id),
    createdByShareId: text("created_by_share_id")
      .notNull()
      .references(() => directShares.id),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    uniqueIndex("direct_edges_users_idx").on(
      table.userAWechatUserId,
      table.userBWechatUserId
    ),
  ]
);
