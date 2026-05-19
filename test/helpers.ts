import { Hono } from "hono";
import { createDb } from "../src/db/index.js";
import { createApp } from "../src/app.js";

/** Create a test app with an in-memory database */
export function createTestApp() {
  const db = createDb(":memory:");
  const app = createApp(db);
  return { app, db };
}

export async function postJson(
  app: Hono,
  path: string,
  body: Record<string, unknown>
) {
  return app.request(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export async function createEvent(app: Hono, args: Record<string, unknown>) {
  const res = await postJson(app, "/api/events", createEventArgs(args));
  return {
    res,
    data: await res.json(),
  };
}

export async function joinEvent(app: Hono, args: Record<string, unknown>) {
  const res = await postJson(app, "/api/events/join", args);
  return {
    res,
    data: await res.json(),
  };
}

export async function getAttendees(app: Hono, eventId: string) {
  const res = await app.request(`/api/events/${eventId}/attendees`);
  return {
    res,
    data: await res.json(),
  };
}

/** Default organizer fields used by tests that don't care about the organizer */
export const DEFAULT_ORGANIZER = {
  organizer_name: "主办方",
  organizer_profile: "活动发起人",
  organizer_contact: "微信: organizer",
};

/** Shortcut for activity creation calls with default organizer fields merged in */
export function createEventArgs(args: Record<string, unknown>) {
  return { ...DEFAULT_ORGANIZER, ...args };
}
