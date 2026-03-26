import { useEffect, useState, useCallback } from 'react'
import {
  type AppConfig,
  type ProviderInfo,
  getConfig,
  updateConfig,
  listProviders,
} from '../api'
import { toast } from '../components/Toast'

export function SettingsPage() {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedModel, setSelectedModel] = useState('')

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [cfg, prov] = await Promise.all([getConfig(), listProviders()])
      setConfig(cfg)
      setProviders(prov.all || [])
      setSelectedModel(cfg.model || '')
    } catch {
      toast('加载配置失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleModelChange = useCallback(
    async (model: string) => {
      setSelectedModel(model)
      try {
        setSaving(true)
        await updateConfig({ model })
        setConfig((prev) => (prev ? { ...prev, model } : prev))
        toast('默认模型已更新', 'success')
      } catch {
        toast('更新失败')
        setSelectedModel(config?.model || '')
      } finally {
        setSaving(false)
      }
    },
    [config],
  )

  // Build flat model list from providers
  const allModels: { providerID: string; providerName: string; modelID: string; modelName: string; value: string }[] = []
  for (const provider of providers) {
    if (!provider.models) continue
    for (const [modelID, model] of Object.entries(provider.models)) {
      allModels.push({
        providerID: provider.id,
        providerName: provider.name,
        modelID,
        modelName: model.name || modelID,
        value: `${provider.id}/${modelID}`,
      })
    }
  }

  // Group by provider
  const grouped = new Map<string, typeof allModels>()
  for (const m of allModels) {
    const list = grouped.get(m.providerName) || []
    list.push(m)
    grouped.set(m.providerName, list)
  }

  if (loading) {
    return (
      <section className="settings-page">
        <div className="settings-loading">
          <div className="spinner" />
          <p>正在加载配置...</p>
        </div>
      </section>
    )
  }

  return (
    <section className="settings-page">
      <header className="settings-page__header">
        <div>
          <p className="skills-page__eyebrow">Configuration</p>
          <h1>Settings</h1>
          <p className="settings-page__subtitle">管理模型配置和系统设置</p>
        </div>
      </header>

      <div className="settings-grid">
        {/* Default Model */}
        <div className="settings-card">
          <h3>默认模型</h3>
          <p className="settings-card__desc">
            选择 Agent 使用的默认 LLM 模型
          </p>
          <select
            className="settings-select"
            value={selectedModel}
            onChange={(e) => handleModelChange(e.target.value)}
            disabled={saving}
          >
            <option value="">未设置</option>
            {[...grouped.entries()].map(([providerName, models]) => (
              <optgroup key={providerName} label={providerName}>
                {models.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.modelName}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {config?.model && (
            <p className="settings-card__current">
              当前: {config.model}
            </p>
          )}
        </div>

        {/* Provider Status */}
        <div className="settings-card">
          <h3>Provider 状态</h3>
          <p className="settings-card__desc">
            已连接的 LLM 提供商及可用模型数
          </p>
          <div className="settings-provider-list">
            {providers.length === 0 ? (
              <p className="settings-card__empty">暂无可用 Provider</p>
            ) : (
              providers.map((p) => {
                const modelCount = p.models ? Object.keys(p.models).length : 0
                return (
                  <div key={p.id} className="settings-provider-item">
                    <div className="settings-provider-info">
                      <span className="settings-provider-name">{p.name}</span>
                      <span className="settings-provider-id">{p.id}</span>
                    </div>
                    <span className="settings-provider-count">
                      {modelCount} 模型
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Current Config Summary */}
        <div className="settings-card">
          <h3>配置概览</h3>
          <p className="settings-card__desc">当前系统配置摘要</p>
          <dl className="settings-config-list">
            <div className="settings-config-row">
              <dt>默认模型</dt>
              <dd>{config?.model || '未设置'}</dd>
            </div>
            <div className="settings-config-row">
              <dt>小模型</dt>
              <dd>{config?.small_model || '未设置'}</dd>
            </div>
            <div className="settings-config-row">
              <dt>Provider 数</dt>
              <dd>{providers.length}</dd>
            </div>
            <div className="settings-config-row">
              <dt>总模型数</dt>
              <dd>{allModels.length}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  )
}

export default SettingsPage
