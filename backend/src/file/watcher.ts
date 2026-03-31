import { BusEvent } from "@/bus/bus-event"
import { Bus } from "@/bus"
import z from "zod"
import { Log } from "../util/log"
import { FileIgnore } from "./ignore"
import { Config } from "../config/config"
// @ts-ignore
import { createWrapper } from "@parcel/watcher/wrapper"
import { lazy } from "@/util/lazy"
import { withTimeout } from "@/util/timeout"
import type ParcelWatcher from "@parcel/watcher"
import { Flag } from "@/flag/flag"
import { Protected } from "./protected"

const SUBSCRIBE_TIMEOUT_MS = 10_000

declare const OPENCODE_LIBC: string | undefined

export namespace FileWatcher {
  const log = Log.create({ service: "file.watcher" })

  export const Event = {
    Updated: BusEvent.define(
      "file.watcher.updated",
      z.object({
        file: z.string(),
        event: z.union([z.literal("add"), z.literal("change"), z.literal("unlink")]),
      }),
    ),
  }

  const watcher = lazy((): typeof import("@parcel/watcher") | undefined => {
    try {
      const binding = require(
        `@parcel/watcher-${process.platform}-${process.arch}${process.platform === "linux" ? `-${OPENCODE_LIBC || "glibc"}` : ""}`,
      )
      return createWrapper(binding) as typeof import("@parcel/watcher")
    } catch (error) {
      log.error("failed to load watcher binding", { error })
      return
    }
  })

  let _watcherState: { subs?: ParcelWatcher.AsyncSubscription[] } | undefined

  async function getState() {
    if (_watcherState) return _watcherState

    log.info("init")
    const cfg = await Config.get()
    const backend = (() => {
      if (process.platform === "win32") return "windows"
      if (process.platform === "darwin") return "fs-events"
      if (process.platform === "linux") return "inotify"
    })()
    if (!backend) {
      log.error("watcher backend not supported", { platform: process.platform })
      _watcherState = {}
      return _watcherState
    }
    log.info("watcher backend", { platform: process.platform, backend })

    const w = watcher()
    if (!w) {
      _watcherState = {}
      return _watcherState
    }

    const subscribe: ParcelWatcher.SubscribeCallback = (err, evts) => {
      if (err) return
      for (const evt of evts) {
        if (evt.type === "create") Bus.publish(Event.Updated, { file: evt.path, event: "add" })
        if (evt.type === "update") Bus.publish(Event.Updated, { file: evt.path, event: "change" })
        if (evt.type === "delete") Bus.publish(Event.Updated, { file: evt.path, event: "unlink" })
      }
    }

    const subs: ParcelWatcher.AsyncSubscription[] = []
    const cfgIgnores = cfg.watcher?.ignore ?? []

    if (Flag.OPENCODE_EXPERIMENTAL_FILEWATCHER) {
      const pending = w.subscribe(process.cwd(), subscribe, {
        ignore: [...FileIgnore.PATTERNS, ...cfgIgnores, ...Protected.paths()],
        backend,
      })
      const sub = await withTimeout(pending, SUBSCRIBE_TIMEOUT_MS).catch((err) => {
        log.error("failed to subscribe to cwd", { error: err })
        pending.then((s) => s.unsubscribe()).catch(() => {})
        return undefined
      })
      if (sub) subs.push(sub)
    }

    _watcherState = { subs }
    return _watcherState
  }

  export function init() {
    if (Flag.OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER) {
      return
    }
    getState()
  }
}
