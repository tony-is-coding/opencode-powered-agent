import z from "zod"
import { Tool } from "./tool"
import { TenantContext } from "@/tenant"
import { Log } from "@/util/log"

const log = Log.create({ service: "tool.data_api" })

export const DataApiTool = Tool.define("data_api", {
  description:
    "Query structured data from the internal data API. Use this to retrieve domain-specific knowledge, internal datasets, or structured records.",
  parameters: z.object({
    query: z.string().describe("Natural language query or structured query expression"),
    dataset: z
      .string()
      .optional()
      .describe("Target dataset name, omit to search across all accessible datasets"),
  }),
  async execute(args, _ctx): Promise<{ title: string; output: string; metadata: Record<string, unknown> }> {
    const { tenantId, userId } = TenantContext.get()
    const baseUrl = process.env.DATA_API_BASE_URL
    if (!baseUrl) throw new Error("DATA_API_BASE_URL is not configured")

    const timeout = AbortSignal.timeout(30_000)

    let res: Response
    try {
      res = await fetch(`${baseUrl}/query`, {
        method: "POST",
        headers: {
          "x-tenant-id": tenantId,
          "x-user-id": userId,
          "content-type": "application/json",
        },
        body: JSON.stringify(args),
        signal: timeout,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      log.warn("data_api fetch failed", { error: msg, tenantId })
      return {
        title: "data_api",
        output: `[data_api error] Failed to reach Data API: ${msg}`,
        metadata: { error: true },
      }
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      log.warn("data_api non-ok response", { status: res.status, tenantId })
      return {
        title: "data_api",
        output: `[data_api error] Data API returned ${res.status}: ${body}`,
        metadata: { error: true, status: res.status },
      }
    }

    const output = await res.text()
    return {
      title: "data_api",
      output,
      metadata: {},
    }
  },
})
