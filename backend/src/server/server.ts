import { BusEvent } from "@/bus/bus-event"
import { Bus } from "@/bus"
import { Log } from "../util/log"
import { describeRoute, generateSpecs, validator, resolver, openAPIRouteHandler } from "hono-openapi"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { streamSSE } from "hono/streaming"
import { basicAuth } from "hono/basic-auth"
import z from "zod"
import { Provider } from "../provider/provider"
import { NamedError } from "@opencode-ai/util/error"
import { Agent } from "../agent/agent"
import { Skill } from "../skill/skill"
import { Plugin } from "../plugin"
import { Settings } from "../config/settings"
import { Flag } from "../flag/flag"
import { Command } from "../command"
import { Global } from "../global"
import { ProviderID } from "../provider/schema"
import { SessionRoutes } from "./routes/session"
import { McpRoutes } from "./routes/mcp"
import { ConfigRoutes } from "./routes/config"
import { ExperimentalRoutes } from "./routes/experimental"
import { ProviderRoutes } from "./routes/provider"
import { NotFoundError } from "../storage/db"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import { HTTPException } from "hono/http-exception"
import { errors } from "./error"
import { QuestionRoutes } from "./routes/question"
import { PermissionRoutes } from "./routes/permission"
import { GlobalRoutes } from "./routes/global"
import { DocumentRoutes } from "./routes/document"
import { ScheduleRoutes } from "./routes/schedule"
import { lazy } from "@/util/lazy"
import { TenantContext } from "@/tenant"

// @ts-ignore This global is needed to prevent ai-sdk from logging warnings to stdout https://github.com/vercel/ai/blob/2dc67e0ef538307f21368db32d5a12345d98831b/packages/ai/src/logger/log-warnings.ts#L85
globalThis.AI_SDK_LOG_WARNINGS = false

export namespace Server {
  const log = Log.create({ service: "server" })

  export const Default = lazy(() => createApp({}))

  export const createApp = (opts: { cors?: string[] }): Hono => {
    const app = new Hono()
    return app
      .onError((err, c) => {
        log.error("failed", {
          error: err,
        })
        if (err instanceof NamedError) {
          let status: ContentfulStatusCode
          if (err instanceof NotFoundError) status = 404
          else if (err instanceof Provider.ModelNotFoundError) status = 400
          else if (err.name.startsWith("Worktree")) status = 400
          else status = 500
          return c.json(err.toObject(), { status })
        }
        if (err instanceof HTTPException) return err.getResponse()
        const message = err instanceof Error && err.stack ? err.stack : err.toString()
        return c.json(new NamedError.Unknown({ message }).toObject(), {
          status: 500,
        })
      })
      .use((c, next) => {
        // Allow CORS preflight requests to succeed without auth.
        // Browser clients sending Authorization headers will preflight with OPTIONS.
        if (c.req.method === "OPTIONS") return next()
        const password = Flag.OPENCODE_SERVER_PASSWORD
        if (!password) return next()
        const username = Flag.OPENCODE_SERVER_USERNAME ?? "opencode"
        return basicAuth({ username, password })(c, next)
      })
      .use(async (c, next) => {
        const skipLogging = c.req.path === "/log"
        if (!skipLogging) {
          log.info("request", {
            method: c.req.method,
            path: c.req.path,
          })
        }
        const timer = log.time("request", {
          method: c.req.method,
          path: c.req.path,
        })
        await next()
        if (!skipLogging) {
          timer.stop()
        }
      })
      .use(
        cors({
          origin(input) {
            if (!input) return

            if (input.startsWith("http://localhost:")) return input
            if (input.startsWith("http://127.0.0.1:")) return input
            if (
              input === "tauri://localhost" ||
              input === "http://tauri.localhost" ||
              input === "https://tauri.localhost"
            )
              return input

            // *.opencode.ai (https only, adjust if needed)
            if (/^https:\/\/([a-z0-9-]+\.)*opencode\.ai$/.test(input)) {
              return input
            }
            if (opts?.cors?.includes(input)) {
              return input
            }

            return
          },
        }),
      )
      .route("/global", GlobalRoutes())
      // Auth routes removed — external tenant system handles authentication
      .use(async (c, next) => {
        if (c.req.path === "/log") return next()
        return TenantContext.middleware(c, next)
      })
      .get(
        "/doc",
        openAPIRouteHandler(app, {
          documentation: {
            info: {
              title: "opencode",
              version: "0.0.3",
              description: "opencode api",
            },
            openapi: "3.1.1",
          },
        }),
      )
      .use(
        validator(
          "query",
          z.object({
            directory: z.string().optional(),
            workspace: z.string().optional(),
          }),
        ),
      )
      // .route("/project", ProjectRoutes()) — removed: project routes replaced by tenant isolation
      // .route("/pty", PtyRoutes()) — removed: PTY not needed for general-purpose agent
      .route("/config", ConfigRoutes())
      .route("/experimental", ExperimentalRoutes())
      .route("/session", SessionRoutes())
      .route("/permission", PermissionRoutes())
      .route("/question", QuestionRoutes())
      .route("/provider", ProviderRoutes())
      // .route("/", FileRoutes()) — removed: file routes not needed
      .route("/mcp", McpRoutes())
      .route("/document", DocumentRoutes())
      .route("/schedule", ScheduleRoutes())
      // .route("/tui", TuiRoutes()) — removed: TUI not needed
      .get(
        "/command",
        describeRoute({
          summary: "List commands",
          description: "Get a list of all available commands in the OpenCode system.",
          operationId: "command.list",
          responses: {
            200: {
              description: "List of commands",
              content: {
                "application/json": {
                  schema: resolver(Command.Info.array()),
                },
              },
            },
          },
        }),
        async (c) => {
          const commands = await Command.list()
          return c.json(commands)
        },
      )
      .post(
        "/log",
        describeRoute({
          summary: "Write log",
          description: "Write a log entry to the server logs with specified level and metadata.",
          operationId: "app.log",
          responses: {
            200: {
              description: "Log entry written successfully",
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
            ...errors(400),
          },
        }),
        validator(
          "json",
          z.object({
            service: z.string().meta({ description: "Service name for the log entry" }),
            level: z.enum(["debug", "info", "error", "warn"]).meta({ description: "Log level" }),
            message: z.string().meta({ description: "Log message" }),
            extra: z
              .record(z.string(), z.any())
              .optional()
              .meta({ description: "Additional metadata for the log entry" }),
          }),
        ),
        async (c) => {
          const { service, level, message, extra } = c.req.valid("json")
          const logger = Log.create({ service })

          switch (level) {
            case "debug":
              logger.debug(message, extra)
              break
            case "info":
              logger.info(message, extra)
              break
            case "error":
              logger.error(message, extra)
              break
            case "warn":
              logger.warn(message, extra)
              break
          }

          return c.json(true)
        },
      )
      .get(
        "/agent",
        describeRoute({
          summary: "List agents",
          description: "Get a list of all available AI agents in the OpenCode system.",
          operationId: "app.agents",
          responses: {
            200: {
              description: "List of agents",
              content: {
                "application/json": {
                  schema: resolver(Agent.Info.array()),
                },
              },
            },
          },
        }),
        async (c) => {
          const modes = await Agent.list()
          return c.json(modes)
        },
      )
      .get(
        "/skill",
        describeRoute({
          summary: "List skills",
          description: "Get a list of skills. By default returns only enabled skills. Use ?all=true to return all discovered skills.",
          operationId: "app.skills",
          responses: {
            200: {
              description: "List of skills",
              content: {
                "application/json": {
                  schema: resolver(Skill.Info.array()),
                },
              },
            },
          },
        }),
        validator(
          "query",
          z.object({
            directory: z.string().optional(),
            workspace: z.string().optional(),
            all: z.string().optional(),
          }),
        ),
        async (c) => {
          const showAll = c.req.query("all") === "true"
          const skills = showAll ? await Skill.all() : await Skill.enabled()
          return c.json(skills)
        },
      )
      .get(
        "/skill/:name",
        describeRoute({
          summary: "Get skill detail",
          description: "Get a single skill by name, including its full SKILL.md content.",
          operationId: "app.skill.get",
          responses: {
            200: {
              description: "Skill detail",
              content: {
                "application/json": {
                  schema: resolver(Skill.Info),
                },
              },
            },
            ...errors(404),
          },
        }),
        async (c) => {
          const name = c.req.param("name")
          const skill = await Skill.get(name)
          if (!skill) return c.json({ error: "Skill not found" }, 404)
          return c.json(skill)
        },
      )
      .put(
        "/skill/:name/toggle",
        describeRoute({
          summary: "Toggle skill",
          description: "Enable or disable a skill by name.",
          operationId: "app.skill.toggle",
          responses: {
            200: {
              description: "Updated enabled state",
              content: {
                "application/json": {
                  schema: resolver(z.object({ name: z.string(), enabled: z.boolean() })),
                },
              },
            },
          },
        }),
        validator(
          "json",
          z.object({
            enabled: z.boolean(),
          }),
        ),
        async (c) => {
          const name = c.req.param("name")
          const { enabled } = c.req.valid("json")
          const settings = await Settings.get()
          const current = settings.enabled_skills ?? []
          const next = enabled
            ? [...new Set([...current, name])]
            : current.filter((s: string) => s !== name)
          await Settings.update({ enabled_skills: next })
          return c.json({ name, enabled })
        },
      )
      .get(
        "/plugin",
        describeRoute({
          summary: "List plugins",
          description: "Get a list of all loaded plugins and their status.",
          operationId: "app.plugins",
          responses: {
            200: {
              description: "List of plugins",
              content: {
                "application/json": {
                  schema: resolver(Plugin.Info.array()),
                },
              },
            },
          },
        }),
        async (c) => {
          const plugins = await Plugin.infos()
          return c.json(plugins)
        },
      )
      .get(
        "/settings",
        describeRoute({
          summary: "Get settings",
          description: "Retrieve the project-level settings from .claude/settings.json.",
          operationId: "settings.get",
          responses: {
            200: {
              description: "Current settings",
              content: {
                "application/json": {
                  schema: resolver(Settings.Info),
                },
              },
            },
          },
        }),
        async (c) => {
          return c.json(await Settings.get())
        },
      )
      .patch(
        "/settings",
        describeRoute({
          summary: "Update settings",
          description: "Update project-level settings in .claude/settings.json.",
          operationId: "settings.update",
          responses: {
            200: {
              description: "Updated settings",
              content: {
                "application/json": {
                  schema: resolver(Settings.Info),
                },
              },
            },
            ...errors(400),
          },
        }),
        validator("json", Settings.Info),
        async (c) => {
          const patch = c.req.valid("json")
          const updated = await Settings.update(patch)
          return c.json(updated)
        },
      )
      // LSP status route removed — not needed for general-purpose agent
      // Formatter status route removed — not needed for general-purpose agent
      .get(
        "/event",
        describeRoute({
          summary: "Subscribe to events",
          description: "Get events",
          operationId: "event.subscribe",
          responses: {
            200: {
              description: "Event stream",
              content: {
                "text/event-stream": {
                  schema: resolver(BusEvent.payloads()),
                },
              },
            },
          },
        }),
        async (c) => {
          log.info("event connected")
          c.header("X-Accel-Buffering", "no")
          c.header("X-Content-Type-Options", "nosniff")
          return streamSSE(c, async (stream) => {
            stream.writeSSE({
              data: JSON.stringify({
                type: "server.connected",
                properties: {},
              }),
            })
            const unsub = Bus.subscribeAll(async (event) => {
              await stream.writeSSE({
                data: JSON.stringify(event),
              })
              if (event.type === Bus.InstanceDisposed.type) {
                stream.close()
              }
            })

            // Send heartbeat every 10s to prevent stalled proxy streams.
            const heartbeat = setInterval(() => {
              stream.writeSSE({
                data: JSON.stringify({
                  type: "server.heartbeat",
                  properties: {},
                }),
              })
            }, 10_000)

            await new Promise<void>((resolve) => {
              stream.onAbort(() => {
                clearInterval(heartbeat)
                unsub()
                resolve()
                log.info("event disconnected")
              })
            })
          })
        },
      )
      // Proxy catch-all removed — not needed for standalone agent core service
  }

  export async function openapi() {
    // Cast to break excessive type recursion from long route chains
    const result = await generateSpecs(Default(), {
      documentation: {
        info: {
          title: "opencode",
          version: "1.0.0",
          description: "opencode api",
        },
        openapi: "3.1.1",
      },
    })
    return result
  }

  /** @deprecated do not use this dumb shit */
  export let url: URL

  export function listen(opts: {
    port: number
    hostname: string
    cors?: string[]
  }) {
    url = new URL(`http://${opts.hostname}:${opts.port}`)
    const app = createApp(opts)
    const args = {
      hostname: opts.hostname,
      idleTimeout: 0,
      fetch: app.fetch,
    } as const
    const tryServe = (port: number) => {
      try {
        return Bun.serve({ ...args, port })
      } catch {
        return undefined
      }
    }
    const server = opts.port === 0 ? (tryServe(4096) ?? tryServe(0)) : tryServe(opts.port)
    if (!server) throw new Error(`Failed to start server on port ${opts.port}`)

    return server
  }
}
