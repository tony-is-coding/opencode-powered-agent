/**
 * Provider Auth Service — Stub Implementation
 *
 * Original module deeply coupled to OpenCode's Auth/OAuth system.
 * In Agent Core, authentication is handled by external tenant system via HTTP headers.
 * MAAS platform handles LLM provider authentication.
 *
 * This stub preserves the type exports for compatibility.
 */
import z from "zod"
import { ProviderID } from "./schema"

export const Method = z
  .object({
    type: z.union([z.literal("oauth"), z.literal("api")]),
    label: z.string(),
  })
  .meta({
    ref: "ProviderAuthMethod",
  })
export type Method = z.infer<typeof Method>

export const Authorization = z
  .object({
    url: z.string(),
    method: z.union([z.literal("auto"), z.literal("code")]),
    instructions: z.string(),
  })
  .meta({
    ref: "ProviderAuthAuthorization",
  })
export type Authorization = z.infer<typeof Authorization>
