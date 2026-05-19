import { createDb } from "../src/db/index.js";
import { createApp } from "../src/app.js";

/** Create a test app with an in-memory database */
export function createTestApp() {
  const db = createDb(":memory:");
  const app = createApp(db);
  return { app, db };
}
