# Phase 2.1: 文档管理 - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase with design decisions)

<domain>
## Phase Boundary

Implement document management API and frontend page. Users can browse project documentation files, view content with syntax highlighting, and edit Markdown files with live preview.

**Deliverables:**
- Backend: `GET/POST/PUT/DELETE /document/*` endpoints
- Frontend: Documents page with file tree + Monaco editor + Markdown preview
- Security: Path traversal protection, file type validation

</domain>

<decisions>
## Implementation Decisions

### File Scope
**Decision:** Limit to project directory, allow `.md/.txt/.json/.yaml/.yml` extensions
**Rationale:** Common documentation formats, safe scope, prevents accidental system file access

### Editor Type
**Decision:** Monaco editor with Markdown preview pane
**Rationale:** Monaco provides syntax highlighting, familiar VS Code-like experience, Markdown preview shows rendered output

### Agent Integration
**Decision:** Standalone document management, no agent context attachment in P2
**Rationale:** Keep scope focused, agent integration can be added later if needed

### Security
**Decision:** Validate all paths, reject hidden files (starting with `.`), reject path traversal (`..`)
**Rationale:** Explicit security, prevent access to sensitive files like `.env`, `.git`

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Route pattern:** `backend/src/server/routes/*.ts` — each route exports `Routes` object
- **Registration:** `server.ts` line 166+ — `.route("/path", Routes())`
- **Auth:** `authHeaders()` from `web/src/api.ts` — Basic Auth via `Authorization: Basic` header
- **Frontend pages:** `web/src/pages/*.tsx` — React pages with TanStack Query for data fetching

### Established Patterns
- **Backend:** Hono with OpenAPI route descriptions, `describeRoute()` + `async (c) => {}` handlers
- **Frontend:** TanStack Query `useQuery`/`useMutation`, `API_BASE_URL` constant, `authHeaders()` for auth
- **Navigation:** React Router with `createBrowserRouter` in `main.tsx`

### Integration Points
- **Route registration:** Add `DocumentRoutes` import and `.route("/document", DocumentRoutes())` in server.ts
- **Navigation:** Add `/documents` route to frontend router
- **Sidebar:** Add Documents link to existing navigation (if any)

</code_context>

<specifics>
## Specific Ideas

- File tree on left side, editor on right (VS Code-like layout)
- Monaco editor with GitHub-flavored Markdown preview
- Breadcrumb navigation showing current file path
- New file button with template selection (empty markdown, README template)
- Delete confirmation dialog

</specifics>

<deferred>
## Deferred Ideas

- Document version history (could use git for this)
- Collaborative editing (would require operational transforms)
- Document search/full-text search
- Attach document as context to agent messages

</deferred>
