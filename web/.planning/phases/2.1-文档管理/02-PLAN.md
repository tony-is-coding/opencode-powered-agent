# Phase 2.1: 文档管理 - Execution Plan

**Created:** 2026-03-26
**Status:** READY
**Estimated Effort:** Human ~1 day / CC ~30 min

---

## Objective

Implement document management system: browse project files, view/edit Markdown with Monaco editor and preview.

## Tasks

### Task 1: Backend Document Routes

**File:** `backend/src/server/routes/document.ts`

Create new route file with endpoints:

| Method | Path | Description |
|--------|------|-------------|
| GET | /document | List files (tree structure) |
| GET | /document/*path | Get file content |
| PUT | /document/*path | Update file |
| POST | /document | Create new file |
| DELETE | /document/*path | Delete file |

**Implementation notes:**
- Use Bun's `node:fs` module (Bun's Node compatibility)
- Validate paths: reject `..`, reject hidden files (starting with `.`)
- Only allow extensions: `.md`, `.txt`, `.json`, `.yaml`, `.yml`
- Use Hono's wildcard: `/document/*path` captures nested paths

**Security:**
```typescript
const ALLOWED_EXTENSIONS = ['.md', '.txt', '.json', '.yaml', '.yml']
function validatePath(path: string): { valid: boolean; error?: string } {
  // Reject path traversal
  if (path.includes('..')) return { valid: false, error: 'Path traversal detected' }
  // Reject hidden files
  if (path.split('/').some(p => p.startsWith('.'))) return { valid: false, error: 'Hidden files not allowed' }
  // Check extension
  const ext = path.toLowerCase().slice(path.lastIndexOf('.'))
  if (!ALLOWED_EXTENSIONS.includes(ext)) return { valid: false, error: 'File type not allowed' }
  return { valid: true }
}
```

**Commit:** `feat(backend): add document management routes`

---

### Task 2: Register Document Routes

**File:** `backend/src/server/server.ts`

Add import and route registration:

```typescript
import { DocumentRoutes } from "./routes/document"
// ... in route setup:
.route("/document", DocumentRoutes())
```

**Commit:** `feat(backend): register document routes`

---

### Task 3: Frontend API Client

**File:** `web/src/api.ts`

Add document API functions:

```typescript
export interface DocumentFile {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  modified?: number
}

export async function listDocuments(): Promise<DocumentFile[]>
export async function getDocument(path: string): Promise<{ content: string; path: string }>
export async function updateDocument(path: string, content: string): Promise<void>
export async function createDocument(path: string, content: string): Promise<void>
export async function deleteDocument(path: string): Promise<void>
```

**Commit:** `feat(web): add document API client`

---

### Task 4: Documents Page

**File:** `web/src/pages/DocumentsPage.tsx`

Create page with:
- File tree component (left panel)
- Monaco editor (right panel)
- Markdown preview toggle
- Breadcrumb navigation
- New file / Delete buttons

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ Documents                         [New File] [Refresh]  │
├────────────────┬────────────────────────────────────────┤
│ 📁 docs/       │ docs/design.md                        │
│   📄 design.md │ ─────────────────────────────────────  │
│   📄 api.md    │ # Design Doc                          │
│ 📁 examples/   │                                       │
│   📄 demo.md   │ [Edit] [Preview] [Save]               │
└────────────────┴────────────────────────────────────────┘
```

**State:**
- `selectedPath: string | null`
- `content: string`
- `isEditing: boolean`
- `showPreview: boolean`

**Commit:** `feat(web): add Documents page`

---

### Task 5: Add Route to Router

**File:** `web/src/main.tsx`

Add `/documents` route:

```tsx
import { DocumentsPage } from './pages/DocumentsPage'
// In createBrowserRouter:
{ path: '/documents', element: <DocumentsPage /> }
```

**Commit:** `feat(web): add documents route`

---

### Task 6: Add Navigation Link

**File:** `web/src/App.tsx` (or navigation component)

Add Documents link to nav:

```tsx
<Link to="/documents">📄 Documents</Link>
```

**Commit:** `feat(web): add documents nav link`

---

### Task 7: CSS Styling

**File:** `web/src/App.css`

Add styles for:
- `.documents-page` — flex layout
- `.file-tree` — left panel styling
- `.document-editor` — right panel
- `.breadcrumb` — path display
- `.file-item` — tree item hover/active states

**Commit:** `style(web): add documents page styles`

---

## Files Changed

| File | Change |
|------|--------|
| `backend/src/server/routes/document.ts` | New — document CRUD routes |
| `backend/src/server/server.ts` | Register document routes |
| `web/src/api.ts` | Add document API functions |
| `web/src/pages/DocumentsPage.tsx` | New — Documents page |
| `web/src/main.tsx` | Add /documents route |
| `web/src/App.tsx` | Add nav link |
| `web/src/App.css` | Add styles |

## Testing

1. Browse file tree, verify only allowed extensions shown
2. Click file → content loads in editor
3. Edit file → save → verify persisted
4. Create new file → appears in tree
5. Delete file → confirmation → removed
6. Try path traversal (`../../../etc/passwd`) → rejected
7. Try hidden file (`.env`) → rejected

## Success Criteria

- [ ] File tree shows project documents
- [ ] Monaco editor displays content with syntax highlighting
- [ ] Markdown preview renders correctly
- [ ] Create/update/delete operations work
- [ ] Path traversal blocked
- [ ] Hidden files blocked
- [ ] Only allowed extensions accessible
