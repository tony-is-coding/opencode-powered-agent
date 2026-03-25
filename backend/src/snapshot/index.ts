import z from "zod"

/**
 * Snapshot Noop 实现
 *
 * 原始 Snapshot 模块 100% 依赖 Git，用于在每个 LLM step 前后创建文件系统快照。
 * 通用任务智能体场景下不需要文件系统快照/恢复能力，因此提供空实现。
 *
 * SessionProcessor 中 Snapshot.track() 返回 undefined 时，
 * 后续 Snapshot.patch() 逻辑会被 `if (snapshot)` 守卫自动跳过。
 */
export namespace Snapshot {
  export function init(): void {}

  export async function cleanup(): Promise<void> {}

  export async function track(): Promise<string | undefined> {
    return undefined
  }

  export const Patch = z.object({
    hash: z.string(),
    files: z.string().array(),
  })
  export type Patch = z.infer<typeof Patch>

  export async function patch(_hash: string): Promise<Patch> {
    return { hash: "", files: [] }
  }

  export async function restore(_snapshot: string): Promise<void> {}

  export async function revert(_patches: Patch[]): Promise<void> {}

  export async function diff(_hash: string): Promise<string> {
    return ""
  }

  export const FileDiff = z
    .object({
      file: z.string(),
      before: z.string(),
      after: z.string(),
      additions: z.number(),
      deletions: z.number(),
      status: z.enum(["added", "deleted", "modified"]).optional(),
    })
    .meta({
      ref: "FileDiff",
    })
  export type FileDiff = z.infer<typeof FileDiff>

  export async function diffFull(_from: string, _to: string): Promise<FileDiff[]> {
    return []
  }
}
