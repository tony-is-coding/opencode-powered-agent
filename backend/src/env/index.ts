export namespace Env {
  const env: Record<string, string | undefined> = { ...process.env }

  export function get(key: string) {
    return env[key]
  }

  export function all() {
    return env
  }

  export function set(key: string, value: string) {
    env[key] = value
  }

  export function remove(key: string) {
    delete env[key]
  }
}
