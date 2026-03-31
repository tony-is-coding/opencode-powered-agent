import { Effect, ScopedCache, Scope } from "effect"

type Disposer = (directory: string) => Effect.Effect<void>
const disposers = new Set<Disposer>()

const TypeId = "~opencode/InstanceState"

export interface InstanceState<A, E = never, R = never> {
  readonly [TypeId]: typeof TypeId
  readonly cache: ScopedCache.ScopedCache<string, A, E, R>
}

export namespace InstanceState {
  export const make = <A, E = never, R = never>(
    init: (directory: string) => Effect.Effect<A, E, R | Scope.Scope>,
  ): Effect.Effect<InstanceState<A, E, Exclude<R, Scope.Scope>>, never, R | Scope.Scope> =>
    Effect.gen(function* () {
      const cache = yield* ScopedCache.make<string, A, E, R>({
        capacity: Number.POSITIVE_INFINITY,
        lookup: init,
      })

      const disposer: Disposer = (directory) => ScopedCache.invalidate(cache, directory)
      disposers.add(disposer)
      yield* Effect.addFinalizer(() => Effect.sync(() => void disposers.delete(disposer)))

      return {
        [TypeId]: TypeId,
        cache,
      }
    })

  export const get = <A, E, R>(self: InstanceState<A, E, R>) =>
    Effect.suspend(() => ScopedCache.get(self.cache, process.cwd()))

  export const has = <A, E, R>(self: InstanceState<A, E, R>) =>
    Effect.suspend(() => ScopedCache.has(self.cache, process.cwd()))

  export const invalidate = <A, E, R>(self: InstanceState<A, E, R>) =>
    Effect.suspend(() => ScopedCache.invalidate(self.cache, process.cwd()))

  export const dispose = (directory: string) =>
    Effect.all(
      [...disposers].map((disposer) => disposer(directory)),
      { concurrency: "unbounded" },
    )
}
