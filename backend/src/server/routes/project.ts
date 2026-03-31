import { Hono } from "hono"
import { lazy } from "../../util/lazy"

// Project routes removed — sessions are now tenant-scoped, no project concept
export const ProjectRoutes = lazy(() => new Hono())
