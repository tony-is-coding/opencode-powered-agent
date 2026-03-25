/**
 * Provider Auth — Stub Implementation
 *
 * In Agent Core, provider authentication is handled by the MAAS platform.
 * This stub preserves the API surface for route compatibility.
 */
import z from "zod"
import { fn } from "@/util/fn"
import { ProviderID } from "./schema"

export namespace ProviderAuth {
  export const Method = z
    .object({
      type: z.union([z.literal("oauth"), z.literal("api")]),
      label: z.string(),
    })
    .meta({ ref: "ProviderAuthMethod" })
  export type Method = z.infer<typeof Method>

  export const Authorization = z
    .object({
      url: z.string(),
      method: z.union([z.literal("auto"), z.literal("code")]),
      instructions: z.string(),
    })
    .meta({ ref: "ProviderAuthAuthorization" })
  export type Authorization = z.infer<typeof Authorization>

  export async function methods(): Promise<Record<string, Method[]>> {
    // Auth handled by MAAS — return empty
    return {}
  }

  export const authorize = fn(
    z.object({
      providerID: ProviderID.zod,
      method: z.number(),
    }),
    async (_input): Promise<Authorization | undefined> => {
      return undefined
    },
  )

  export const callback = fn(
    z.object({
      providerID: ProviderID.zod,
      method: z.number(),
      code: z.string().optional(),
    }),
    async (_input) => {
      // No-op: auth handled by MAAS
    },
  )

  export const api = fn(
    z.object({
      providerID: ProviderID.zod,
      key: z.string(),
    }),
    async (_input) => {
      // No-op: auth handled by MAAS
    },
  )
}
