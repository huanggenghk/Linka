import type { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as z from "zod/v4";
import * as schema from "./db/schema.js";
import { requireAgentBinding } from "./agent-auth.js";
import { readJson } from "./wechat-auth.js";

type DB = BetterSQLite3Database<typeof schema>;

const DEFAULT_PREFERENCES = {
  auto_update_enabled: true,
  auto_update_frequency: "daily",
  auto_update_time: "21:00",
  auto_update_timezone: "Asia/Shanghai",
} as const;

const profileSchema = z.object({
  profile: z.string().trim().min(1).max(4000),
  update_source: z.enum(["manual", "auto"]).default("manual"),
  summary_direction: z.string().trim().max(1000).optional(),
  confirmed: z.boolean().optional(),
});

const preferenceSchema = z.object({
  auto_update_enabled: z.boolean().optional(),
  auto_update_frequency: z.enum(["daily", "weekly", "manual"]).optional(),
  auto_update_time: z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional(),
  auto_update_timezone: z.string().trim().min(1).max(64).optional(),
});

export function registerAgentProfileRoutes(app: Hono, database: DB) {
  app.get("/api/agent/profile", async (c) => {
    const auth = requireAgentBinding(c, database);
    if (!auth.ok) {
      return c.json({ error: auth.error }, auth.status);
    }

    const profile = getProfile(database, auth.binding.wechatUserId);
    const preferences = getPreferences(database, auth.binding.wechatUserId);

    return c.json({
      profile: profile
        ? {
            text: profile.profile,
            update_source: profile.updateSource,
            summary_direction: profile.summaryDirection,
            updated_at: profile.updatedAt,
          }
        : null,
      preferences,
    });
  });

  app.post("/api/agent/profile", async (c) => {
    const auth = requireAgentBinding(c, database);
    if (!auth.ok) {
      return c.json({ error: auth.error }, auth.status);
    }

    const body = await readJson(c);
    const parsed = profileSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "请求参数无效" }, 400);
    }

    if (parsed.data.update_source === "manual" && parsed.data.confirmed !== true) {
      return c.json({ error: "手动画像更新必须先得到用户确认" }, 400);
    }

    const now = new Date().toISOString();
    upsertProfile(database, {
      wechatUserId: auth.binding.wechatUserId,
      profile: parsed.data.profile,
      updateSource: parsed.data.update_source,
      summaryDirection: parsed.data.summary_direction ?? null,
      now,
    });

    if (parsed.data.update_source === "auto") {
      touchAutoUpdate(database, auth.binding.wechatUserId, now);
    }

    return c.json({
      status: "updated",
      profile: {
        text: parsed.data.profile,
        update_source: parsed.data.update_source,
        summary_direction: parsed.data.summary_direction ?? null,
        updated_at: now,
      },
      preferences: getPreferences(database, auth.binding.wechatUserId),
    });
  });

  app.post("/api/agent/profile/preferences", async (c) => {
    const auth = requireAgentBinding(c, database);
    if (!auth.ok) {
      return c.json({ error: auth.error }, auth.status);
    }

    const body = await readJson(c);
    const parsed = preferenceSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "请求参数无效" }, 400);
    }

    const existing = getRawPreferences(database, auth.binding.wechatUserId);
    const now = new Date().toISOString();
    const next = {
      autoUpdateEnabled:
        parsed.data.auto_update_enabled ?? existing?.autoUpdateEnabled ?? true,
      autoUpdateFrequency:
        parsed.data.auto_update_frequency ??
        existing?.autoUpdateFrequency ??
        DEFAULT_PREFERENCES.auto_update_frequency,
      autoUpdateTime:
        parsed.data.auto_update_time ??
        existing?.autoUpdateTime ??
        DEFAULT_PREFERENCES.auto_update_time,
      autoUpdateTimezone:
        parsed.data.auto_update_timezone ??
        existing?.autoUpdateTimezone ??
        DEFAULT_PREFERENCES.auto_update_timezone,
      lastAutoUpdatedAt: existing?.lastAutoUpdatedAt ?? null,
    };
    if (next.autoUpdateFrequency === "manual") {
      next.autoUpdateEnabled = false;
    }

    upsertPreferences(database, auth.binding.wechatUserId, next, now);

    return c.json({
      status: "updated",
      preferences: getPreferences(database, auth.binding.wechatUserId),
    });
  });
}

function getProfile(database: DB, wechatUserId: string) {
  return database
    .select()
    .from(schema.wechatUserProfiles)
    .where(eq(schema.wechatUserProfiles.wechatUserId, wechatUserId))
    .get();
}

function getRawPreferences(database: DB, wechatUserId: string) {
  return database
    .select()
    .from(schema.wechatProfilePreferences)
    .where(eq(schema.wechatProfilePreferences.wechatUserId, wechatUserId))
    .get();
}

function getPreferences(database: DB, wechatUserId: string) {
  const row = getRawPreferences(database, wechatUserId);
  if (!row) {
    return {
      ...DEFAULT_PREFERENCES,
      last_auto_updated_at: null,
    };
  }

  return {
    auto_update_enabled: row.autoUpdateEnabled,
    auto_update_frequency: row.autoUpdateFrequency,
    auto_update_time: row.autoUpdateTime,
    auto_update_timezone: row.autoUpdateTimezone,
    last_auto_updated_at: row.lastAutoUpdatedAt,
  };
}

function upsertProfile(
  database: DB,
  input: {
    wechatUserId: string;
    profile: string;
    updateSource: "manual" | "auto";
    summaryDirection: string | null;
    now: string;
  }
) {
  const existing = getProfile(database, input.wechatUserId);
  if (existing) {
    database
      .update(schema.wechatUserProfiles)
      .set({
        profile: input.profile,
        updateSource: input.updateSource,
        summaryDirection: input.summaryDirection,
        updatedAt: input.now,
      })
      .where(eq(schema.wechatUserProfiles.wechatUserId, input.wechatUserId))
      .run();
    return;
  }

  database
    .insert(schema.wechatUserProfiles)
    .values({
      wechatUserId: input.wechatUserId,
      profile: input.profile,
      updateSource: input.updateSource,
      summaryDirection: input.summaryDirection,
      createdAt: input.now,
      updatedAt: input.now,
    })
    .run();
}

function touchAutoUpdate(database: DB, wechatUserId: string, now: string) {
  const existing = getRawPreferences(database, wechatUserId);
  upsertPreferences(
    database,
    wechatUserId,
    {
      autoUpdateEnabled: existing?.autoUpdateEnabled ?? true,
      autoUpdateFrequency:
        existing?.autoUpdateFrequency ?? DEFAULT_PREFERENCES.auto_update_frequency,
      autoUpdateTime: existing?.autoUpdateTime ?? DEFAULT_PREFERENCES.auto_update_time,
      autoUpdateTimezone:
        existing?.autoUpdateTimezone ?? DEFAULT_PREFERENCES.auto_update_timezone,
      lastAutoUpdatedAt: now,
    },
    now
  );
}

function upsertPreferences(
  database: DB,
  wechatUserId: string,
  preferences: {
    autoUpdateEnabled: boolean;
    autoUpdateFrequency: string;
    autoUpdateTime: string;
    autoUpdateTimezone: string;
    lastAutoUpdatedAt: string | null;
  },
  now: string
) {
  const existing = getRawPreferences(database, wechatUserId);
  if (existing) {
    database
      .update(schema.wechatProfilePreferences)
      .set({
        autoUpdateEnabled: preferences.autoUpdateEnabled,
        autoUpdateFrequency: preferences.autoUpdateFrequency,
        autoUpdateTime: preferences.autoUpdateTime,
        autoUpdateTimezone: preferences.autoUpdateTimezone,
        lastAutoUpdatedAt: preferences.lastAutoUpdatedAt,
        updatedAt: now,
      })
      .where(eq(schema.wechatProfilePreferences.wechatUserId, wechatUserId))
      .run();
    return;
  }

  database
    .insert(schema.wechatProfilePreferences)
    .values({
      wechatUserId,
      autoUpdateEnabled: preferences.autoUpdateEnabled,
      autoUpdateFrequency: preferences.autoUpdateFrequency,
      autoUpdateTime: preferences.autoUpdateTime,
      autoUpdateTimezone: preferences.autoUpdateTimezone,
      lastAutoUpdatedAt: preferences.lastAutoUpdatedAt,
      createdAt: now,
      updatedAt: now,
    })
    .run();
}
