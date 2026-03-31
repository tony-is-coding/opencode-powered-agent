import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"
import { Timestamps } from "../storage/schema.sql"

export const ScheduleTable = sqliteTable("schedule", {
  id: text().primaryKey(),
  name: text().notNull(),
  description: text().default(""),
  cron: text().notNull(),
  command: text().notNull(),
  enabled: integer({ mode: "boolean" }).notNull().default(true),
  last_run: integer(),
  next_run: integer(),
  ...Timestamps,
})
