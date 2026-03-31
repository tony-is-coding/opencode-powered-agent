import { Context } from "@/util/context"
import { Log } from "@/util/log"
import type { Context as HonoContext, Next } from "hono"

interface TenantInfo {
  tenantId: string
  userId: string
}

const ctx = Context.create<TenantInfo>("tenant")
const log = Log.create({ service: "tenant" })
const SAFE_ID = /^[a-zA-Z0-9_-]{1,128}$/

export namespace TenantContext {
  export type Info = TenantInfo

  export function get(): TenantInfo {
    return ctx.use()
  }

  export function provide<R>(value: TenantInfo, fn: () => R): R {
    return ctx.provide(value, fn)
  }

  export async function middleware(c: HonoContext, next: Next) {
    const tenantId = c.req.header("x-tenant-id")?.trim()
    const userId = c.req.header("x-user-id")?.trim()
    if (!tenantId || !userId) {
      log.warn("missing tenant or user identity", {
        path: c.req.path,
        hasTenantId: !!tenantId,
        hasUserId: !!userId,
      })
      return c.json({ error: "missing tenant or user identity" }, 401)
    }
    if (!SAFE_ID.test(tenantId) || !SAFE_ID.test(userId)) {
      log.warn("invalid tenant or user identity format", { path: c.req.path })
      return c.json({ error: "invalid tenant or user identity format" }, 400)
    }
    return ctx.provide({ tenantId, userId }, next)
  }
}
