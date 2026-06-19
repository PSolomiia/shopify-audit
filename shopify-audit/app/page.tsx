'use client'
import { useState } from 'react'

const CAT_LABEL: Record<string, string> = {
  seo: 'SEO', speed: 'Швидкість', ux: 'UX', catalog: 'Каталог', conversion: 'Конверсія'
}
const EFFORT_LABEL: Record<string, string> = { easy: 'Легко', medium: 'Середньо', hard: 'Складно' }
const IMPACT_LABEL: Record<string, string> = { high: 'Великий вплив', medium: 'Середній вплив', low: 'Малий вплив' }

const STEPS = [
  { id: 'scan', label: 'Сканую сайт...' },
  { id: 'api', label: 'Завантажую дані Shopify...' },
  { id: 'ai', label: 'Аналізую з Claude AI...' },
  { id: 'save', label: 'Зберігаю результат...' },
  { id: 'email', label: 'Відправляю звіт...' },
]

function scoreColor(n: number) {
  return n >= 70 ? '#5fd150' : n >= 50 ? '#f5a623' : '#ff5c5c'
}

function ProgressBar({ pct, label, step }: { pct: number; label: string; step: string }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: '#999' }}>{label}</span>
        <span style={{ fontSize: 13, color: '#7fff6e', fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
      </div>
      <div style={{ height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: '#7fff6e', borderRadius: 2, transition: 'width 0.5s ease' }} />
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' as const }}>
        {STEPS.map(s => (
          <span key={s.id} style={{
            fontSize: 11, padding: '3px 10px', borderRadius: 99,
            border: `0.5px solid ${s.id === step ? 'rgba(127,255,110,0.4)' : 'rgba(255,255,255,0.08)'}`,
            color: s.id === step ? '#7fff6e' : '#555',
            background: s.id === step ? 'rgba(127,255,110,0.06)' : 'transparent',
          }}>
            {s.label.replace('...', '')}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function Home() {
  const [tab, setTab] = useState<'audit' | 'history'>('audit')
  const [mode, setMode] = useState<'url' | 'api'>('url')
  const [url, setUrl] = useState('')
  const [shopifyHandle, setShopifyHandle] = useState('')
  const [shopifyKey, setShopifyKey] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState('')
  const [pct, setPct] = useState(0)
  const [stepLabel, setStepLabel] = useState('')
  const [result, setResult] = useState<any>(null)
  const [scanMeta, setScanMeta] = useState<any>(null)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<any[]>([])
  const [historyLoaded, setHistoryLoaded] = useState(false)

  async function startAudit() {
    if (!url) { setError('Введіть URL магазину'); return }
    setError('')
    setLoading(true)
    setResult(null)
    setScanMeta(null)

    const steps = mode === 'api'
      ? [{ id: 'scan', pct: 20 }, { id: 'api', pct: 40 }, { id: 'ai', pct: 75 }, { id: 'save', pct: 90 }, { id: 'email', pct: 100 }]
      : [{ id: 'scan', pct: 25 }, { id: 'ai', pct: 80 }, { id: 'save', pct: 95 }, { id: 'email', pct: 100 }]

    for (const s of steps.slice(0, -2)) {
      setStep(s.id)
      setStepLabel(STEPS.find(x => x.id === s.id)?.label || '')
      setPct(s.pct)
      await new Promise(r => setTimeout(r, 400))
    }

    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, mode, shopifyHandle, shopifyApiKey: shopifyKey, email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Помилка сервера')

      setStep('email')
      setStepLabel('Готово!')
      setPct(100)
      await new Promise(r => setTimeout(r, 300))

      setResult(data.result)
      setScanMeta(data.scan)
    } catch (e: any) {
      setError(e.message || 'Щось пішло не так')
    } finally {
      setLoading(false)
    }
  }

  async function loadHistory() {
    const res = await fetch('/api/history')
    const data = await res.json()
    setHistory(data)
    setHistoryLoaded(true)
  }

  function handleTabHistory() {
    setTab('history')
    if (!historyLoaded) loadHistory()
  }

  function buildReportText() {
    if (!result) return ''
    const scores = result.scores
    const overall = Math.round(Object.values(scores as Record<string, number>).reduce((a, b) => a + b, 0) / Object.keys(scores).length)
    return [
      `SHOPIFY STORE AUDIT REPORT`,
      `Магазин: ${url}`,
      `Дата: ${new Date().toLocaleDateString('uk-UA')}`,
      `Загальний бал: ${overall}/100`,
      '',
      result.summary,
      '',
      'ОЦІНКИ:',
      ...Object.entries(scores as Record<string, number>).map(([k, v]) => `  ${CAT_LABEL[k] || k}: ${v}/100`),
      '',
      'РЕКОМЕНДАЦІЇ:',
      ...result.recommendations.map((r: any, i: number) =>
        `\n${i + 1}. [${r.priority.toUpperCase()}] ${r.title}\n   ${r.description}\n   Як виправити: ${r.howToFix}\n   Категорія: ${CAT_LABEL[r.category]} | Зусилля: ${EFFORT_LABEL[r.effort]}`
      ),
    ].join('\n')
  }

  function downloadReport() {
    const blob = new Blob([buildReportText()], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `shopify-audit-${Date.now()}.txt`
    a.click()
  }

  const s = result?.scores
  const overall = s ? Math.round(Object.values(s as Record<string, number>).reduce((a, b) => a + b, 0) / Object.keys(s).length) : 0

  return (
    <div style={{ background: '#0d0d0d', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", sans-serif', color: '#f0f0f0' }}>

      {/* NAV */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2rem', height: 56, borderBottom: '0.5px solid rgba(255,255,255,0.08)', position: 'sticky', top: 0, background: 'rgba(13,13,13,0.95)', backdropFilter: 'blur(12px)', zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 15 }}>
          <div style={{ width: 8, height: 8, background: '#7fff6e', borderRadius: '50%' }} />
          ShopifyAudit
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['audit', 'history'] as const).map(t => (
            <button key={t} onClick={() => t === 'history' ? handleTabHistory() : setTab(t)} style={{
              padding: '6px 14px', fontSize: 13, borderRadius: 8,
              border: `0.5px solid ${tab === t ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'}`,
              background: tab === t ? 'rgba(255,255,255,0.06)' : 'transparent',
              color: tab === t ? '#f0f0f0' : '#666', cursor: 'pointer', fontFamily: 'inherit',
            }}>
              {t === 'audit' ? 'Аудит' : 'Історія'}
            </button>
          ))}
        </div>
      </nav>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 1rem 4rem' }}>

        {/* ── AUDIT TAB ── */}
        {tab === 'audit' && (
          <>
            <div style={{ textAlign: 'center', padding: '4rem 0 2.5rem' }}>
              <div style={{ display: 'inline-block', fontSize: 12, color: '#7fff6e', border: '0.5px solid rgba(127,255,110,0.3)', borderRadius: 99, padding: '4px 14px', marginBottom: 16, letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>AI аудит магазину</div>
              <h1 style={{ fontSize: 'clamp(1.8rem, 5vw, 2.8rem)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.15, marginBottom: '1rem' }}>
                Знайди що заважає<br /><span style={{ color: '#7fff6e' }}>продавати більше</span>
              </h1>
              <p style={{ fontSize: 15, color: '#888', maxWidth: 440, margin: '0 auto' }}>
                Реальне сканування сайту + Shopify API + Claude AI = конкретні рекомендації з пріоритетами
              </p>
            </div>

            {/* Input card */}
            {!loading && !result && (
              <div style={{ background: '#161616', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '1.5rem' }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#444', marginBottom: 14 }}>Режим аудиту</div>

                <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
                  {(['url', 'api'] as const).map(m => (
                    <button key={m} onClick={() => setMode(m)} style={{
                      flex: 1, padding: '9px 12px', border: `0.5px solid ${mode === m ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: 10, background: mode === m ? '#1f1f1f' : 'transparent',
                      fontSize: 13, cursor: 'pointer', color: mode === m ? '#f0f0f0' : '#666', fontFamily: 'inherit',
                    }}>
                      {m === 'url' ? '🌐 Тільки URL' : '🔑 URL + Shopify API'}
                    </button>
                  ))}
                </div>

                <Field label="URL магазину" value={url} onChange={setUrl} placeholder="https://your-store.myshopify.com" hint="Публічний домен або myshopify.com адреса" />

                {mode === 'api' && (
                  <>
                    <Field label="Shopify Store Handle" value={shopifyHandle} onChange={setShopifyHandle} placeholder="your-store" hint="Частина URL: your-store.myshopify.com" />
                    <Field label="Shopify Admin API ключ" value={shopifyKey} onChange={setShopifyKey} placeholder="shpat_xxxxxx" type="password" hint="Settings → Apps → Develop apps → API access token" />
                  </>
                )}

                <Field label="Email для отримання звіту (необов'язково)" value={email} onChange={setEmail} placeholder="client@example.com" hint="Звіт буде відправлений після аудиту" type="email" />

                {error && <div style={{ background: 'rgba(255,92,92,0.08)', border: '0.5px solid rgba(255,92,92,0.25)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#ff5c5c', marginBottom: 14 }}>{error}</div>}

                <div style={{ height: '0.5px', background: 'rgba(255,255,255,0.08)', margin: '16px 0' }} />

                <button onClick={startAudit} style={{ width: '100%', padding: 13, background: '#7fff6e', color: '#0d0d0d', fontSize: 15, fontWeight: 700, fontFamily: 'inherit', border: 'none', borderRadius: 10, cursor: 'pointer' }}>
                  ⚡ Запустити аудит
                </button>
                <div style={{ textAlign: 'center', fontSize: 12, color: '#444', marginTop: 10 }}>Реальне сканування · ~30 сек · PDF звіт</div>
              </div>
            )}

            {/* Progress */}
            {loading && (
              <div style={{ background: '#161616', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '1.5rem' }}>
                <ProgressBar pct={pct} label={stepLabel} step={step} />
              </div>
            )}

            {/* Results */}
            {result && !loading && (
              <div>
                {/* Score summary */}
                <div style={{ background: '#161616', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '1.5rem', marginBottom: 12 }}>
                  <div style={{ textAlign: 'center', marginBottom: 20 }}>
                    <div style={{ fontSize: 60, fontWeight: 700, color: scoreColor(overall), lineHeight: 1 }}>{overall}</div>
                    <div style={{ color: '#555', fontSize: 13, marginTop: 4 }}>Загальний бал / 100</div>
                    {result.summary && <p style={{ color: '#888', fontSize: 14, marginTop: 12, lineHeight: 1.6, maxWidth: 480, margin: '12px auto 0' }}>{result.summary}</p>}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8 }}>
                    {Object.entries(result.scores as Record<string, number>).map(([k, v]) => (
                      <div key={k} style={{ background: '#1f1f1f', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '12px 10px', textAlign: 'center' }}>
                        <div style={{ fontSize: 24, fontWeight: 700, color: scoreColor(v) }}>{v}</div>
                        <div style={{ fontSize: 11, color: '#444', marginTop: 3, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>{CAT_LABEL[k] || k}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Scan meta */}
                {scanMeta && (
                  <div style={{ background: '#161616', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '1rem 1.5rem', marginBottom: 12 }}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#444', marginBottom: 10 }}>Дані сканування</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8 }}>
                      {[
                        [`🖼 Зображень`, scanMeta.imagesTotal],
                        [`⚠️ Без alt`, scanMeta.imagesWithoutAlt],
                        [`🔗 Колекцій`, scanMeta.collectionCount],
                        [`📦 Продуктів`, scanMeta.productCount],
                        [`🔍 Пошук`, scanMeta.features.search ? '✓' : '✗'],
                        [`🛡 Trust badges`, scanMeta.features.trustBadges ? '✓' : '✗'],
                        [`⭐ Відгуки`, scanMeta.features.reviews ? '✓' : '✗'],
                      ].map(([label, val]) => (
                        <div key={label as string} style={{ background: '#1f1f1f', borderRadius: 8, padding: '6px 12px', fontSize: 13 }}>
                          <span style={{ color: '#888' }}>{label}: </span>
                          <span style={{ color: '#f0f0f0', fontWeight: 500 }}>{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                <div style={{ background: '#161616', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '1.5rem', marginBottom: 12 }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#444', marginBottom: 14 }}>
                    Рекомендації ({result.recommendations.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
                    {[...result.recommendations]
                      .sort((a: any, b: any) => ({ high: 0, mid: 1, low: 2 }[a.priority as string] || 1) - ({ high: 0, mid: 1, low: 2 }[b.priority as string] || 1))
                      .map((r: any, i: number) => (
                        <div key={i} style={{
                          background: '#0d0d0d', borderRadius: '0 10px 10px 0',
                          borderLeft: `2.5px solid ${r.priority === 'high' ? '#ff5c5c' : r.priority === 'mid' ? '#f5a623' : '#5fd150'}`,
                          border: '0.5px solid rgba(255,255,255,0.06)',
                          borderLeftColor: r.priority === 'high' ? '#ff5c5c' : r.priority === 'mid' ? '#f5a623' : '#5fd150',
                          borderLeftWidth: 2.5,
                          padding: '14px 16px',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap' as const, gap: 4 }}>
                            <strong style={{ fontSize: 14, color: '#f0f0f0' }}>{i + 1}. {r.title}</strong>
                            <span style={{ fontSize: 11, color: '#555', borderRadius: 99, border: '0.5px solid rgba(255,255,255,0.08)', padding: '2px 8px' }}>
                              {CAT_LABEL[r.category]} · {EFFORT_LABEL[r.effort]}
                            </span>
                          </div>
                          <p style={{ fontSize: 13, color: '#888', marginBottom: 8, lineHeight: 1.55 }}>{r.description}</p>
                          <div style={{ background: '#161616', borderRadius: 6, padding: '10px 12px', fontSize: 13, color: '#aaa' }}>
                            <span style={{ color: '#7fff6e', fontWeight: 500 }}>→ </span>{r.howToFix}
                          </div>
                          {r.impact && (
                            <div style={{ marginTop: 6, fontSize: 11, color: '#444' }}>{IMPACT_LABEL[r.impact]}</div>
                          )}
                        </div>
                      ))}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={downloadReport} style={{ flex: 1, padding: 11, fontSize: 13, fontFamily: 'inherit', border: '0.5px solid rgba(255,255,255,0.14)', borderRadius: 10, background: 'transparent', color: '#888', cursor: 'pointer' }}>
                    📄 Скачати звіт
                  </button>
                  <button onClick={() => { setResult(null); setScanMeta(null); setUrl('') }} style={{ flex: 1, padding: 11, fontSize: 13, fontFamily: 'inherit', border: '0.5px solid rgba(255,255,255,0.14)', borderRadius: 10, background: 'transparent', color: '#888', cursor: 'pointer' }}>
                    ↺ Новий аудит
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── HISTORY TAB ── */}
        {tab === 'history' && (
          <div style={{ paddingTop: '2rem' }}>
            <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 16 }}>Історія аудитів</h2>
            {history.length === 0 && historyLoaded && (
              <div style={{ textAlign: 'center', color: '#444', padding: '3rem 0' }}>Аудитів поки немає</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
              {history.map((h: any) => {
                const sc = h.scores as Record<string, number>
                const avg = Math.round(Object.values(sc).reduce((a, b) => a + b, 0) / Object.keys(sc).length)
                return (
                  <div key={h.id} style={{ background: '#161616', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 3 }}>{h.store_name || h.store_url}</div>
                      <div style={{ fontSize: 12, color: '#555' }}>
                        {new Date(h.created_at).toLocaleDateString('uk-UA')} · {h.mode === 'api' ? 'API режим' : 'URL режим'}
                        {h.report_sent ? ' · 📧 відправлено' : ''}
                      </div>
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: scoreColor(avg) }}>{avg}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, hint, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder: string; hint?: string; type?: string
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, color: '#666', marginBottom: 6 }}>{label}</label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: '100%', padding: '10px 14px', background: '#1f1f1f', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#f0f0f0', fontSize: 14, fontFamily: 'inherit', outline: 'none' }}
      />
      {hint && <div style={{ fontSize: 11, color: '#444', marginTop: 5 }}>{hint}</div>}
    </div>
  )
}
