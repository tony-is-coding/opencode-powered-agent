import { useEffect, useState, useCallback } from 'react'
import Editor from '@monaco-editor/react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  type DocumentFile,
  listDocuments,
  getDocument,
  updateDocument,
  createDocument,
  deleteDocument,
} from '../api'
import { toast } from '../components/Toast'

type ViewMode = 'edit' | 'preview' | 'split'

function FileTreeItem({
  file,
  depth,
  selectedPath,
  expandedDirs,
  onSelect,
  onToggleDir,
}: {
  file: DocumentFile
  depth: number
  selectedPath: string | null
  expandedDirs: Set<string>
  onSelect: (path: string) => void
  onToggleDir: (path: string) => void
}) {
  const isDir = file.type === 'directory'
  const isExpanded = expandedDirs.has(file.path)
  const isSelected = file.path === selectedPath

  return (
    <button
      type="button"
      className={`doc-tree-item${isSelected ? ' selected' : ''}`}
      style={{ paddingLeft: `${12 + depth * 16}px` }}
      onClick={() => (isDir ? onToggleDir(file.path) : onSelect(file.path))}
    >
      <span className="doc-tree-icon">
        {isDir ? (isExpanded ? '▾' : '▸') : ''}
      </span>
      <span className="doc-tree-name">{file.name}</span>
      {!isDir && file.size != null && (
        <span className="doc-tree-size">
          {file.size < 1024
            ? `${file.size}B`
            : `${(file.size / 1024).toFixed(1)}K`}
        </span>
      )}
    </button>
  )
}

function FileTree({
  files,
  selectedPath,
  onSelect,
}: {
  files: DocumentFile[]
  selectedPath: string | null
  onSelect: (path: string) => void
}) {
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set())

  const toggleDir = useCallback((dirPath: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev)
      if (next.has(dirPath)) next.delete(dirPath)
      else next.add(dirPath)
      return next
    })
  }, [])

  // Build nested structure from flat list
  const tree = buildTree(files)

  function renderNodes(nodes: TreeNode[], depth: number): React.ReactNode[] {
    const result: React.ReactNode[] = []
    for (const node of nodes) {
      result.push(
        <FileTreeItem
          key={node.file.path}
          file={node.file}
          depth={depth}
          selectedPath={selectedPath}
          expandedDirs={expandedDirs}
          onSelect={onSelect}
          onToggleDir={toggleDir}
        />,
      )
      if (node.children.length > 0 && expandedDirs.has(node.file.path)) {
        result.push(...renderNodes(node.children, depth + 1))
      }
    }
    return result
  }

  return <div className="doc-tree">{renderNodes(tree, 0)}</div>
}

interface TreeNode {
  file: DocumentFile
  children: TreeNode[]
}

function buildTree(files: DocumentFile[]): TreeNode[] {
  const nodeMap = new Map<string, TreeNode>()
  const roots: TreeNode[] = []

  for (const f of files) {
    nodeMap.set(f.path, { file: f, children: [] })
  }

  for (const f of files) {
    const node = nodeMap.get(f.path)!
    const lastSlash = f.path.lastIndexOf('/')
    if (lastSlash === -1) {
      roots.push(node)
    } else {
      const parentPath = f.path.substring(0, lastSlash)
      const parent = nodeMap.get(parentPath)
      if (parent) parent.children.push(node)
      else roots.push(node)
    }
  }

  return roots
}

function NewFileDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (path: string, content: string) => void
}) {
  const [path, setPath] = useState('')
  const [template, setTemplate] = useState<'empty' | 'readme'>('empty')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = path.trim()
    if (!trimmed) return
    const content =
      template === 'readme'
        ? `# ${trimmed.split('/').pop()?.replace('.md', '') || 'Untitled'}\n\n## Overview\n\n`
        : ''
    onCreate(trimmed, content)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: 440 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>新建文件</h2>
          <button className="modal-close" onClick={onClose} type="button">
            ✕
          </button>
        </div>
        <form className="modal-body" onSubmit={handleSubmit}>
          <label className="field-label">文件路径</label>
          <input
            className="text-field"
            placeholder="docs/example.md"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            autoFocus
          />
          <label className="field-label" style={{ marginTop: 12 }}>
            模板
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className={`secondary-action${template === 'empty' ? ' active-template' : ''}`}
              onClick={() => setTemplate('empty')}
            >
              空文件
            </button>
            <button
              type="button"
              className={`secondary-action${template === 'readme' ? ' active-template' : ''}`}
              onClick={() => setTemplate('readme')}
            >
              README 模板
            </button>
          </div>
          <div className="task-actions" style={{ marginTop: 16 }}>
            <button type="submit" className="primary-action" disabled={!path.trim()}>
              创建
            </button>
            <button type="button" className="secondary-action" onClick={onClose}>
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function DocumentsPage() {
  const [files, setFiles] = useState<DocumentFile[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [savedContent, setSavedContent] = useState('')
  const [fileLoading, setFileLoading] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('split')
  const [showNewFile, setShowNewFile] = useState(false)
  const [saving, setSaving] = useState(false)

  const isDirty = content !== savedContent

  const loadFiles = useCallback(async () => {
    try {
      setLoading(true)
      const data = await listDocuments(true)
      setFiles(data)
    } catch {
      toast('加载文件列表失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadFiles()
  }, [loadFiles])

  const handleSelect = useCallback(async (path: string) => {
    try {
      setFileLoading(true)
      setSelectedPath(path)
      const doc = await getDocument(path)
      setContent(doc.content)
      setSavedContent(doc.content)
      // Auto-select view mode based on file type
      if (path.endsWith('.md')) {
        setViewMode('split')
      } else {
        setViewMode('edit')
      }
    } catch {
      toast('加载文件失败')
    } finally {
      setFileLoading(false)
    }
  }, [])

  const handleSave = useCallback(async () => {
    if (!selectedPath || !isDirty) return
    try {
      setSaving(true)
      await updateDocument(selectedPath, content)
      setSavedContent(content)
      toast('已保存', 'success')
    } catch {
      toast('保存失败')
    } finally {
      setSaving(false)
    }
  }, [selectedPath, content, isDirty])

  // Ctrl+S / Cmd+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleSave])

  const handleCreate = useCallback(
    async (path: string, templateContent: string) => {
      try {
        await createDocument(path, templateContent)
        setShowNewFile(false)
        await loadFiles()
        await handleSelect(path)
        toast('文件已创建', 'success')
      } catch (err) {
        toast(err instanceof Error ? err.message : '创建失败')
      }
    },
    [loadFiles, handleSelect],
  )

  const handleDelete = useCallback(async () => {
    if (!selectedPath) return
    if (!window.confirm(`确定删除 ${selectedPath}？`)) return
    try {
      await deleteDocument(selectedPath)
      setSelectedPath(null)
      setContent('')
      setSavedContent('')
      await loadFiles()
      toast('文件已删除', 'success')
    } catch {
      toast('删除失败')
    }
  }, [selectedPath, loadFiles])

  const isMarkdown = selectedPath?.endsWith('.md')
  const editorLang = selectedPath?.endsWith('.json')
    ? 'json'
    : selectedPath?.endsWith('.yaml') || selectedPath?.endsWith('.yml')
      ? 'yaml'
      : 'markdown'

  return (
    <section className="docs-page">
      <header className="docs-page__header">
        <div>
          <p className="skills-page__eyebrow">Document Management</p>
          <h1>Documents</h1>
        </div>
        <div className="docs-page__actions">
          <button
            type="button"
            className="secondary-action"
            onClick={loadFiles}
          >
            刷新
          </button>
          <button
            type="button"
            className="primary-action"
            onClick={() => setShowNewFile(true)}
          >
            新建文件
          </button>
        </div>
      </header>

      <div className="docs-layout">
        {/* File tree */}
        <aside className="docs-sidebar">
          {loading ? (
            <div className="docs-sidebar__loading">
              <div className="spinner" />
            </div>
          ) : files.length === 0 ? (
            <div className="docs-sidebar__empty">
              <p>暂无文档文件</p>
              <span>支持 .md .txt .json .yaml .yml</span>
            </div>
          ) : (
            <FileTree
              files={files}
              selectedPath={selectedPath}
              onSelect={handleSelect}
            />
          )}
        </aside>

        {/* Editor area */}
        <div className="docs-main">
          {!selectedPath ? (
            <div className="docs-empty">
              <p>选择左侧文件开始编辑</p>
              <span>或点击「新建文件」创建文档</span>
            </div>
          ) : fileLoading ? (
            <div className="docs-empty">
              <div className="spinner" />
            </div>
          ) : (
            <>
              {/* Toolbar */}
              <div className="docs-toolbar">
                <div className="docs-breadcrumb">
                  {selectedPath.split('/').map((seg, i, arr) => (
                    <span key={i}>
                      {i > 0 && <span className="docs-breadcrumb__sep">/</span>}
                      <span
                        className={
                          i === arr.length - 1
                            ? 'docs-breadcrumb__current'
                            : ''
                        }
                      >
                        {seg}
                      </span>
                    </span>
                  ))}
                  {isDirty && <span className="docs-dirty-dot" />}
                </div>
                <div className="docs-toolbar__right">
                  {isMarkdown && (
                    <div className="docs-view-toggle">
                      {(['edit', 'split', 'preview'] as ViewMode[]).map((m) => (
                        <button
                          key={m}
                          type="button"
                          className={`docs-view-btn${viewMode === m ? ' active' : ''}`}
                          onClick={() => setViewMode(m)}
                        >
                          {m === 'edit'
                            ? '编辑'
                            : m === 'preview'
                              ? '预览'
                              : '分屏'}
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    className="primary-action"
                    disabled={!isDirty || saving}
                    onClick={handleSave}
                    style={{ padding: '8px 16px', fontSize: '0.82rem' }}
                  >
                    {saving ? '保存中...' : '保存'}
                  </button>
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={handleDelete}
                    style={{
                      padding: '8px 16px',
                      fontSize: '0.82rem',
                      color: 'var(--danger)',
                    }}
                  >
                    删除
                  </button>
                </div>
              </div>

              {/* Editor + Preview */}
              <div className="docs-editor-area">
                {(viewMode === 'edit' || viewMode === 'split') && (
                  <div
                    className="docs-editor-pane"
                    style={{
                      flex: viewMode === 'split' ? '1 1 50%' : '1 1 100%',
                    }}
                  >
                    <Editor
                      height="100%"
                      language={editorLang}
                      theme="vs-dark"
                      value={content}
                      onChange={(v) => setContent(v ?? '')}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        lineNumbers: 'on',
                        wordWrap: 'on',
                        scrollBeyondLastLine: false,
                        padding: { top: 12 },
                      }}
                    />
                  </div>
                )}
                {isMarkdown &&
                  (viewMode === 'preview' || viewMode === 'split') && (
                    <div
                      className="docs-preview-pane"
                      style={{
                        flex:
                          viewMode === 'split' ? '1 1 50%' : '1 1 100%',
                      }}
                    >
                      <div className="docs-preview-content modal-markdown">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
              </div>
            </>
          )}
        </div>
      </div>

      {showNewFile && (
        <NewFileDialog
          onClose={() => setShowNewFile(false)}
          onCreate={handleCreate}
        />
      )}
    </section>
  )
}

export default DocumentsPage
