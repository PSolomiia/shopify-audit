import fs from 'fs'
import path from 'path'

// На Vercel використовуємо /tmp для запису (єдина папка з доступом)
const DB_PATH = process.env.DATABASE_PATH || path.join('/tmp', 'audits.json')

export interface AuditRow {
  id: number
  created_at: string
  store_url: string
  store_name: string | null
  email: string | null
  mode: string
  scores: string
  recommendations: string
  raw_scan: string | null
  report_sent: number
}

function readDb(): AuditRow[] {
  try {
    if (!fs.existsSync(DB_PATH)) return []
    const raw = fs.readFileSync(DB_PATH, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return []
  }
}

function writeDb(rows: AuditRow[]) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(rows, null, 2), 'utf-8')
  } catch (e) {
    console.error('DB write error:', e)
  }
}

export function saveAudit(data: {
  store_url: string
  store_name?: string
  email?: string
  mode: string
  scores: object
  recommendations: object[]
  raw_scan?: object
}): number {
  const rows = readDb()
  const id = rows.length > 0 ? Math.max(...rows.map(r => r.id)) + 1 : 1
  const newRow: AuditRow = {
    id,
    created_at: new Date().toISOString(),
    store_url: data.store_url,
    store_name: data.store_name || null,
    email: data.email || null,
    mode: data.mode,
    scores: JSON.stringify(data.scores),
    recommendations: JSON.stringify(data.recommendations),
    raw_scan: data.raw_scan ? JSON.stringify(data.raw_scan) : null,
    report_sent: 0,
  }
  rows.unshift(newRow)
  // Зберігаємо тільки останні 200 аудитів
  writeDb(rows.slice(0, 200))
  return id
}

export function getAudits(limit = 50): AuditRow[] {
  return readDb().slice(0, limit)
}

export function getAuditById(id: number): AuditRow | null {
  return readDb().find(r => r.id === id) || null
}

export function markReportSent(id: number) {
  const rows = readDb()
  const row = rows.find(r => r.id === id)
  if (row) { row.report_sent = 1; writeDb(rows) }
}
