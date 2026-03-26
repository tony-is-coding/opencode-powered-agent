import { Hono } from "hono"
import { describeRoute, validator, resolver } from "hono-openapi"
import z from "zod"
import { ScheduleTable } from "../../schedule/schedule.sql"
import { Database, eq } from "../../storage/db"
import { errors } from "../error"
import { lazy } from "@/util/lazy"

function generateId() {
  return `sch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function getNextRun(cron: string): number | null {
  // Simple next-minute calculation for interval-based cron
  // For MVP: parse "*/N * * * *" pattern for minute intervals
  const parts = cron.split(" ")
  if (parts.length !== 5) return null
  const now = Date.now()
  const minutePart = parts[0]
  if (minutePart.startsWith("*/")) {
    const interval = parseInt(minutePart.slice(2), 10)
    if (!isNaN(interval) && interval > 0) {
      return now + interval * 60 * 1000
    }
  }
  // Default: next minute
  return now + 60 * 1000
}

const ScheduleInfo = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  cron: z.string(),
  command: z.string(),
  enabled: z.boolean(),
  last_run: z.number().nullable().optional(),
  next_run: z.number().nullable().optional(),
  time_created: z.number(),
  time_updated: z.number(),
})

export const ScheduleRoutes = lazy(() =>
  new Hono()
    .get(
      "/",
      describeRoute({
        summary: "List schedules",
        description: "Get all scheduled tasks.",
        operationId: "schedule.list",
        responses: {
          200: {
            description: "List of schedules",
            content: {
              "application/json": {
                schema: resolver(ScheduleInfo.array()),
              },
            },
          },
        },
      }),
      async (c) => {
        const rows = Database.use((db) =>
          db.select().from(ScheduleTable).all(),
        )
        return c.json(rows)
      },
    )
    .get(
      "/:id",
      describeRoute({
        summary: "Get schedule",
        description: "Get a specific scheduled task by ID.",
        operationId: "schedule.get",
        responses: {
          200: {
            description: "Schedule detail",
            content: {
              "application/json": {
                schema: resolver(ScheduleInfo),
              },
            },
          },
          ...errors(404),
        },
      }),
      async (c) => {
        const id = c.req.param("id")
        const row = Database.use((db) =>
          db.select().from(ScheduleTable).where(eq(ScheduleTable.id, id)).get(),
        )
        if (!row) return c.json({ error: "Schedule not found" }, 404)
        return c.json(row)
      },
    )
    .post(
      "/",
      describeRoute({
        summary: "Create schedule",
        description: "Create a new scheduled task.",
        operationId: "schedule.create",
        responses: {
          200: {
            description: "Schedule created",
            content: {
              "application/json": {
                schema: resolver(ScheduleInfo),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator(
        "json",
        z.object({
          name: z.string().min(1),
          description: z.string().optional().default(""),
          cron: z.string().min(1),
          command: z.string().min(1),
          enabled: z.boolean().optional().default(true),
        }),
      ),
      async (c) => {
        const body = c.req.valid("json")
        const id = generateId()
        const now = Date.now()
        const nextRun = body.enabled ? getNextRun(body.cron) : null

        const row = {
          id,
          name: body.name,
          description: body.description || "",
          cron: body.cron,
          command: body.command,
          enabled: body.enabled,
          last_run: null,
          next_run: nextRun,
          time_created: now,
          time_updated: now,
        }

        Database.use((db) => {
          db.insert(ScheduleTable).values(row).run()
        })

        return c.json(row)
      },
    )
    .put(
      "/:id",
      describeRoute({
        summary: "Update schedule",
        description: "Update an existing scheduled task.",
        operationId: "schedule.update",
        responses: {
          200: {
            description: "Schedule updated",
            content: {
              "application/json": {
                schema: resolver(ScheduleInfo),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "json",
        z.object({
          name: z.string().min(1).optional(),
          description: z.string().optional(),
          cron: z.string().min(1).optional(),
          command: z.string().min(1).optional(),
          enabled: z.boolean().optional(),
        }),
      ),
      async (c) => {
        const id = c.req.param("id")
        const body = c.req.valid("json")

        const existing = Database.use((db) =>
          db.select().from(ScheduleTable).where(eq(ScheduleTable.id, id)).get(),
        )
        if (!existing) return c.json({ error: "Schedule not found" }, 404)

        const updates: Record<string, unknown> = { time_updated: Date.now() }
        if (body.name !== undefined) updates.name = body.name
        if (body.description !== undefined) updates.description = body.description
        if (body.cron !== undefined) {
          updates.cron = body.cron
          updates.next_run = getNextRun(body.cron)
        }
        if (body.command !== undefined) updates.command = body.command
        if (body.enabled !== undefined) {
          updates.enabled = body.enabled
          if (!body.enabled) updates.next_run = null
          else updates.next_run = getNextRun(body.cron ?? existing.cron)
        }

        const row = Database.use((db) =>
          db
            .update(ScheduleTable)
            .set(updates)
            .where(eq(ScheduleTable.id, id))
            .returning()
            .get(),
        )

        return c.json(row)
      },
    )
    .delete(
      "/:id",
      describeRoute({
        summary: "Delete schedule",
        description: "Delete a scheduled task.",
        operationId: "schedule.delete",
        responses: {
          200: {
            description: "Schedule deleted",
            content: {
              "application/json": {
                schema: resolver(z.object({ success: z.boolean() })),
              },
            },
          },
          ...errors(404),
        },
      }),
      async (c) => {
        const id = c.req.param("id")
        const existing = Database.use((db) =>
          db.select().from(ScheduleTable).where(eq(ScheduleTable.id, id)).get(),
        )
        if (!existing) return c.json({ error: "Schedule not found" }, 404)

        Database.use((db) => {
          db.delete(ScheduleTable).where(eq(ScheduleTable.id, id)).run()
        })

        return c.json({ success: true })
      },
    )
    .post(
      "/:id/trigger",
      describeRoute({
        summary: "Trigger schedule",
        description: "Manually trigger a scheduled task immediately.",
        operationId: "schedule.trigger",
        responses: {
          200: {
            description: "Schedule triggered",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({ success: z.boolean(), triggered_at: z.number() }),
                ),
              },
            },
          },
          ...errors(404),
        },
      }),
      async (c) => {
        const id = c.req.param("id")
        const existing = Database.use((db) =>
          db.select().from(ScheduleTable).where(eq(ScheduleTable.id, id)).get(),
        )
        if (!existing) return c.json({ error: "Schedule not found" }, 404)

        const now = Date.now()
        Database.use((db) => {
          db.update(ScheduleTable)
            .set({
              last_run: now,
              next_run: getNextRun(existing.cron),
              time_updated: now,
            })
            .where(eq(ScheduleTable.id, id))
            .run()
        })

        return c.json({ success: true, triggered_at: now })
      },
    ),
)
