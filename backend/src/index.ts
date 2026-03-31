/**
 * OpenCode Agent Core — Server Entry Point
 *
 * This is the main entry point for the Agent Core service.
 * It starts a headless HTTP server (no CLI, no TUI).
 */
import { Server } from "./server/server"
import { Log } from "./util/log"
import { Flag } from "./flag/flag"
import { MCP } from "./mcp"

process.on("unhandledRejection", (e) => {
  Log.Default.error("rejection", {
    e: e instanceof Error ? e.message : e,
  })
})

process.on("uncaughtException", (e) => {
  Log.Default.error("exception", {
    e: e instanceof Error ? e.message : e,
  })
})

await Log.init({
  print: true,
  dev: process.env.NODE_ENV !== "production",
  level: (process.env.LOG_LEVEL as Log.Level) ?? "INFO",
})

process.env.AGENT = "1"
process.env.OPENCODE = "1"
process.env.OPENCODE_PID = String(process.pid)

// Map ANTHROPIC_AUTH_TOKEN → ANTHROPIC_API_KEY for @ai-sdk/anthropic compatibility
if (process.env.ANTHROPIC_AUTH_TOKEN && !process.env.ANTHROPIC_API_KEY) {
  process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_AUTH_TOKEN
}

// Map ANTHROPIC_AUTH_TOKEN → LOCAL_PROXY_API_KEY for local OpenAI-compatible proxy
if (process.env.ANTHROPIC_AUTH_TOKEN && !process.env.LOCAL_PROXY_API_KEY) {
  process.env.LOCAL_PROXY_API_KEY = process.env.ANTHROPIC_AUTH_TOKEN
}

const port = Number(process.env.PORT ?? 4096)
const hostname = process.env.HOST ?? "0.0.0.0"

if (!Flag.OPENCODE_SERVER_PASSWORD) {
  Log.Default.warn("OPENCODE_SERVER_PASSWORD is not set; server is unsecured.")
}

const server = Server.listen({ port, hostname })
Log.Default.info("agent-core started", {
  url: `http://${server.hostname}:${server.port}`,
})

// Initialize MCP connections on startup
MCP.init().catch((e) => Log.Default.error("mcp init failed", { e }))

// Keep process alive
await new Promise(() => {})
