import { useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { API_BASE_URL, type Skill } from '../api'
import { toast } from '../components/Toast'
import { authHeaders } from '../api'

interface SkillDetail {
  name: string
  description: string
  location: string
  content: string
}

type SkillCardProps = {
  skill: Skill
  onToggle: (skillId: string) => void
  onDetail: (name: string) => void
}

function SkillCard({ skill, onToggle, onDetail }: SkillCardProps) {
  return (
    <article className="skills-card" onClick={() => onDetail(skill.name)}>
      <div className="skills-card__header">
        <div>
          <div className="skills-card__status-row">
            <span className={`skills-card__status ${skill.enabled ? 'is-enabled' : 'is-disabled'}`}>
              {skill.enabled ? '已启用' : '已禁用'}
            </span>
          </div>
          <h3>{skill.name}</h3>
        </div>

        <label className="skills-switch" aria-label={`切换 ${skill.name} 的启用状态`} onClick={(e) => e.stopPropagation()}>
          <input
            checked={skill.enabled}
            onChange={() => onToggle(skill.id)}
            type="checkbox"
          />
          <span className="skills-switch__track" />
        </label>
      </div>

      <p className="skills-card__description">{skill.description}</p>

      <div className="skills-card__tags">
        {skill.tags.length > 0 ? (
          skill.tags.map((tag) => (
            <span className="skills-tag" key={tag}>
              {tag}
            </span>
          ))
        ) : (
          <span className="skills-card__empty-tag">无标签</span>
        )}
      </div>
    </article>
  )
}

function SkillDetailModal({ name, onClose }: { name: string; onClose: () => void }) {
  const [detail, setDetail] = useState<SkillDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`${API_BASE_URL}/skill/${encodeURIComponent(name)}`, {
      headers: authHeaders(),
    })
      .then((r) => r.json())
      .then((data) => setDetail(data as SkillDetail))
      .catch(() => toast('加载 Skill 详情失败'))
      .finally(() => setLoading(false))
  }, [name])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{name}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {loading ? (
          <div className="modal-loading"><div className="spinner" /></div>
        ) : detail ? (
          <div className="modal-body">
            <p className="modal-location">{detail.location}</p>
            <div className="modal-markdown">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {detail.content}
              </ReactMarkdown>
            </div>
          </div>
        ) : (
          <p className="modal-error">Skill not found</p>
        )}
      </div>
    </div>
  )
}

export function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detailName, setDetailName] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function loadSkills() {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`${API_BASE_URL}/skill?all=true`, {
          headers: authHeaders(),
        })

        if (!response.ok) {
          const text = await response.text()
          throw new Error(`API ${response.status}: ${text}`)
        }

        const data = (await response.json()) as Skill[]

        if (active) {
          setSkills(data)
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : '加载 Skill 列表失败')
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadSkills()

    return () => {
      active = false
    }
  }, [])

  const filteredSkills = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    if (!keyword) {
      return skills
    }

    return skills.filter((skill) => {
      const haystack = [skill.name, skill.description, ...skill.tags].join(' ').toLowerCase()
      return haystack.includes(keyword)
    })
  }, [search, skills])

  async function handleToggle(skillId: string) {
    const skill = skills.find((s) => s.id === skillId)
    if (!skill) return
    const newEnabled = !skill.enabled
    setSkills((currentSkills) =>
      currentSkills.map((s) =>
        s.id === skillId ? { ...s, enabled: newEnabled } : s,
      ),
    )
    try {
      await fetch(`${API_BASE_URL}/skill/${encodeURIComponent(skill.name)}/toggle`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ enabled: newEnabled }),
      })
    } catch {
      setSkills((currentSkills) =>
        currentSkills.map((s) =>
          s.id === skillId ? { ...s, enabled: !newEnabled } : s,
        ),
      )
      toast('切换 Skill 状态失败')
    }
  }

  return (
    <section className="skills-page">
      <header className="skills-page__hero">
        <div>
          <p className="skills-page__eyebrow">Skill Management</p>
          <h1>Skills</h1>
          <p className="skills-page__subtitle">搜索并管理当前可用的 Skill。点击卡片查看详情。</p>
        </div>

        <div className="skills-page__summary">
          <strong>{skills.length}</strong>
          <span>总技能数</span>
        </div>
      </header>

      <div className="skills-toolbar">
        <input
          className="skills-search"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="搜索 name、description 或 tags"
          type="search"
          value={search}
        />
        <div className="skills-toolbar__meta">
          <span>{filteredSkills.length} 个结果</span>
          <span>{skills.filter((skill) => skill.enabled).length} 已启用</span>
        </div>
      </div>

      {loading ? (
        <div className="skills-state-card">
          <div className="spinner" />
          <p>正在加载 Skill 列表...</p>
        </div>
      ) : error ? (
        <div className="skills-state-card is-error">
          <p>加载失败</p>
          <span>{error}</span>
        </div>
      ) : filteredSkills.length === 0 ? (
        <div className="skills-state-card">
          <p>没有匹配的 Skill</p>
          <span>尝试更换关键词，或清空搜索条件。</span>
        </div>
      ) : (
        <div className="skills-grid">
          {filteredSkills.map((skill) => (
            <SkillCard key={skill.id} onToggle={handleToggle} onDetail={setDetailName} skill={skill} />
          ))}
        </div>
      )}

      {detailName && (
        <SkillDetailModal name={detailName} onClose={() => setDetailName(null)} />
      )}
    </section>
  )
}

export default SkillsPage
