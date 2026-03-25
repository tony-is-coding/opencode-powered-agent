import path from "path"
import z from "zod"
import { Filesystem } from "@/util/filesystem"
import { Instance } from "@/project/instance"
import { Log } from "@/util/log"

export namespace Settings {
  const log = Log.create({ service: "settings" })

  export const Info = z
    .object({
      enabled_skills: z.array(z.string()).optional(),
      enabled_plugins: z.array(z.string()).optional(),
    })
    .meta({ ref: "Settings" })

  export type Info = z.infer<typeof Info>

  function filePath() {
    return path.join(Instance.directory, ".claude", "settings.json")
  }

  export async function get(): Promise<Info> {
    const fp = filePath()
    const text = await Filesystem.readText(fp).catch((err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") return undefined
      log.error("failed to read settings", { path: fp, error: err })
      return undefined
    })
    if (!text) return {}
    try {
      const data = JSON.parse(text)
      const parsed = Info.safeParse(data)
      if (parsed.success) return parsed.data
      log.warn("invalid settings.json", { path: fp, issues: parsed.error.issues })
      return {}
    } catch (err) {
      log.warn("failed to parse settings.json", { path: fp, error: err })
      return {}
    }
  }

  export async function update(patch: Partial<Info>): Promise<Info> {
    const current = await get()
    const merged: Info = { ...current, ...patch }
    await Filesystem.writeJson(filePath(), merged)
    return merged
  }

  export function isSkillEnabled(name: string, settings: Info): boolean {
    const list = settings.enabled_skills
    if (!list || list.length === 0) return false
    return list.includes(name)
  }

  export function isPluginEnabled(name: string, settings: Info): boolean {
    const list = settings.enabled_plugins
    if (!list || list.length === 0) return false
    return list.includes(name)
  }
}
