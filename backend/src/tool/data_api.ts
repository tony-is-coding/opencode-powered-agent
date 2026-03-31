import z from "zod"
import { Tool } from "./tool"
import { Server } from "@/server/server"

/**
 * DataApiTool — lets agents call the backend's own REST API.
 * Useful for reading/writing sessions, schedules, and other platform data.
 */
export const DataApiTool = Tool.define("data_api", {
  description:
    "Call the backend REST API to read or write platform data (sessions, schedules, etc.). " +
    "Use this tool when you need to interact with structured platform data rather than the filesystem.",
  parameters: z.object({
    method: z
      .enum(["GET", "POST", "PUT", "PATCH", "DELETE"])
      .describe("HTTP method"),
    path: z
      .string()
      .describe("API path, e.g. /session or /schedule/123. Must start with /"),
    body: z
      .record(z.string(), z.any())
      .optional()
      .describe("Request body for POST/PUT/PATCH requests"),
  }),
  async execute(params, _ctx) {
    if (!params.path.startsWith("/")) {
      throw new Error("path must start with /")
    }

    const base = Server.url?.toString().replace(/\/$/, "") ?? "http://localhost:4096"
    const url = `${base}${params.path}`

    const init: RequestInit = {
      method: params.method,
      headers: { "Content-Type": "application/json" },
    }
    if (params.body && ["POST", "PUT", "PATCH"].includes(params.method)) {
      init.body = JSON.stringify(params.body)
    }

    const res = await fetch(url, init)
    const text = await res.text()

    let output: string
    try {
      const json = JSON.parse(text)
      output = JSON.stringify(json, null, 2)
    } catch {
      output = text
    }

    return {
      title: `${params.method} ${params.path} → ${res.status}`,
      output,
      metadata: { status: res.status, ok: res.ok },
    }
  },
})
