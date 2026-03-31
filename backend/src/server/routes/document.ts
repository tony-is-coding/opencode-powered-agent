import { Hono } from "hono"
import { describeRoute, validator, resolver } from "hono-openapi"
import z from "zod"
import * as fs from "fs"
import * as path from "path"
import { errors } from "../error"
import { lazy } from "@/util/lazy"

const ALLOWED_EXTENSIONS = [".md", ".txt", ".json", ".yaml", ".yml"]

function validatePath(relativePath: string): { valid: boolean; error?: string } {
  // Reject path traversal
  if (relativePath.includes("..")) {
    return { valid: false, error: "Path traversal detected" }
  }
  // Reject hidden files (starting with .)
  if (relativePath.split("/").some((p) => p.startsWith("."))) {
    return { valid: false, error: "Hidden files not allowed" }
  }
  // Check extension
  const ext = relativePath.toLowerCase().slice(relativePath.lastIndexOf("."))
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return { valid: false, error: "File type not allowed" }
  }
  return { valid: true }
}

export interface DocumentFile {
  name: string
  path: string
  type: "file" | "directory"
  size?: number
  modified?: number
}

function buildFileTree(dir: string, basePath: string): DocumentFile[] {
  const result: DocumentFile[] = []
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return result
  }

  // Sort: directories first, then files, both alphabetically
  entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1
    if (!a.isDirectory() && b.isDirectory()) return 1
    return a.name.localeCompare(b.name)
  })

  for (const entry of entries) {
    // Skip hidden files and directories
    if (entry.name.startsWith(".")) continue

    const relativePath = path.join(basePath, entry.name)

    if (entry.isDirectory()) {
      result.push({
        name: entry.name,
        path: relativePath,
        type: "directory",
      })
    } else if (entry.isFile()) {
      const ext = entry.name.toLowerCase().slice(entry.name.lastIndexOf("."))
      if (ALLOWED_EXTENSIONS.includes(ext)) {
        const fullPath = path.join(dir, entry.name)
        const stats = fs.statSync(fullPath)
        result.push({
          name: entry.name,
          path: relativePath,
          type: "file",
          size: stats.size,
          modified: stats.mtimeMs,
        })
      }
    }
  }

  return result
}

function scanDirectoryRecursive(dir: string, basePath: string): DocumentFile[] {
  const result: DocumentFile[] = []
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return result
  }

  // Sort: directories first, then files, both alphabetically
  entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1
    if (!a.isDirectory() && b.isDirectory()) return 1
    return a.name.localeCompare(b.name)
  })

  for (const entry of entries) {
    // Skip hidden files and directories
    if (entry.name.startsWith(".")) continue

    const relativePath = path.join(basePath, entry.name)

    if (entry.isDirectory()) {
      result.push({
        name: entry.name,
        path: relativePath,
        type: "directory",
      })
      // Recursively scan subdirectories
      result.push(...scanDirectoryRecursive(path.join(dir, entry.name), relativePath))
    } else if (entry.isFile()) {
      const ext = entry.name.toLowerCase().slice(entry.name.lastIndexOf("."))
      if (ALLOWED_EXTENSIONS.includes(ext)) {
        const fullPath = path.join(dir, entry.name)
        const stats = fs.statSync(fullPath)
        result.push({
          name: entry.name,
          path: relativePath,
          type: "file",
          size: stats.size,
          modified: stats.mtimeMs,
        })
      }
    }
  }

  return result
}

export const DocumentRoutes = lazy(() =>
  new Hono()
    .get(
      "/",
      describeRoute({
        summary: "List documents",
        description: "Get a tree structure of all documents in the project directory.",
        operationId: "document.list",
        responses: {
          200: {
            description: "List of documents",
            content: {
              "application/json": {
                schema: resolver(
                  z.array(
                    z.object({
                      name: z.string(),
                      path: z.string(),
                      type: z.enum(["file", "directory"]),
                      size: z.number().optional(),
                      modified: z.number().optional(),
                    }),
                  ),
                ),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator(
        "query",
        z.object({
          recursive: z
            .string()
            .optional()
            .meta({ description: "If 'true', return recursive tree; otherwise return top-level only" }),
        }),
      ),
      async (c) => {
        const query = c.req.valid("query")
        const projectDir = process.cwd()
        const recursive = query.recursive === "true"

        const files = recursive
          ? scanDirectoryRecursive(projectDir, "")
          : buildFileTree(projectDir, "")

        return c.json(files)
      },
    )
    .get(
      "/*",
      describeRoute({
        summary: "Get document",
        description: "Get the content of a specific document by its path.",
        operationId: "document.get",
        responses: {
          200: {
            description: "Document content",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    path: z.string(),
                    content: z.string(),
                  }),
                ),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      async (c) => {
        const relativePath = c.req.path.replace("/document/", "")
        const validation = validatePath(relativePath)

        if (!validation.valid) {
          return c.json({ error: validation.error }, 400)
        }

        const projectDir = process.cwd()
        const fullPath = path.join(projectDir, relativePath)

        // Ensure the resolved path is still within project directory
        const resolved = path.resolve(fullPath)
        if (!resolved.startsWith(projectDir)) {
          return c.json({ error: "Path traversal detected" }, 400)
        }

        if (!fs.existsSync(resolved)) {
          return c.json({ error: "File not found" }, 404)
        }

        try {
          const content = fs.readFileSync(resolved, "utf-8")
          return c.json({ path: relativePath, content })
        } catch (err) {
          return c.json({ error: "Failed to read file" }, 500)
        }
      },
    )
    .put(
      "/*",
      describeRoute({
        summary: "Update document",
        description: "Update the content of an existing document.",
        operationId: "document.update",
        responses: {
          200: {
            description: "Document updated",
            content: {
              "application/json": {
                schema: resolver(z.object({ success: z.boolean() })),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "json",
        z.object({
          content: z.string(),
        }),
      ),
      async (c) => {
        const relativePath = c.req.path.replace("/document/", "")
        const validation = validatePath(relativePath)

        if (!validation.valid) {
          return c.json({ error: validation.error }, 400)
        }

        const projectDir = process.cwd()
        const fullPath = path.join(projectDir, relativePath)

        // Ensure the resolved path is still within project directory
        const resolved = path.resolve(fullPath)
        if (!resolved.startsWith(projectDir)) {
          return c.json({ error: "Path traversal detected" }, 400)
        }

        if (!fs.existsSync(resolved)) {
          return c.json({ error: "File not found" }, 404)
        }

        try {
          const body = c.req.valid("json")
          fs.writeFileSync(resolved, body.content, "utf-8")
          return c.json({ success: true })
        } catch (err) {
          return c.json({ error: "Failed to write file" }, 500)
        }
      },
    )
    .post(
      "/",
      describeRoute({
        summary: "Create document",
        description: "Create a new document with the specified path and content.",
        operationId: "document.create",
        responses: {
          200: {
            description: "Document created",
            content: {
              "application/json": {
                schema: resolver(z.object({ success: z.boolean(), path: z.string() })),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator(
        "json",
        z.object({
          path: z.string().meta({ description: "Relative path for the new file" }),
          content: z.string().optional().default(""),
        }),
      ),
      async (c) => {
        const body = c.req.valid("json")
        const relativePath = body.path

        const validation = validatePath(relativePath)
        if (!validation.valid) {
          return c.json({ error: validation.error }, 400)
        }

        const projectDir = process.cwd()
        const fullPath = path.join(projectDir, relativePath)

        // Ensure the resolved path is still within project directory
        const resolved = path.resolve(fullPath)
        if (!resolved.startsWith(projectDir)) {
          return c.json({ error: "Path traversal detected" }, 400)
        }

        // Check if file already exists
        if (fs.existsSync(resolved)) {
          return c.json({ error: "File already exists" }, 400)
        }

        try {
          // Ensure parent directory exists
          const parentDir = path.dirname(resolved)
          fs.mkdirSync(parentDir, { recursive: true })

          fs.writeFileSync(resolved, body.content, "utf-8")
          return c.json({ success: true, path: relativePath })
        } catch (err) {
          return c.json({ error: "Failed to create file" }, 500)
        }
      },
    )
    .delete(
      "/*",
      describeRoute({
        summary: "Delete document",
        description: "Delete a document by its path.",
        operationId: "document.delete",
        responses: {
          200: {
            description: "Document deleted",
            content: {
              "application/json": {
                schema: resolver(z.object({ success: z.boolean() })),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      async (c) => {
        const relativePath = c.req.path.replace("/document/", "")
        const validation = validatePath(relativePath)

        if (!validation.valid) {
          return c.json({ error: validation.error }, 400)
        }

        const projectDir = process.cwd()
        const fullPath = path.join(projectDir, relativePath)

        // Ensure the resolved path is still within project directory
        const resolved = path.resolve(fullPath)
        if (!resolved.startsWith(projectDir)) {
          return c.json({ error: "Path traversal detected" }, 400)
        }

        if (!fs.existsSync(resolved)) {
          return c.json({ error: "File not found" }, 404)
        }

        try {
          fs.unlinkSync(resolved)
          return c.json({ success: true })
        } catch (err) {
          return c.json({ error: "Failed to delete file" }, 500)
        }
      },
    ),
)
