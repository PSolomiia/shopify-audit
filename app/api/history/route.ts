import { NextResponse } from 'next/server'
import { getAudits, getAuditById } from '@/lib/db'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (id) {
    const audit = getAuditById(Number(id))
    if (!audit) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({
      ...audit,
      scores: JSON.parse(audit.scores),
      recommendations: JSON.parse(audit.recommendations),
    })
  }

  const audits = getAudits(100).map(a => ({
    id: a.id,
    created_at: a.created_at,
    store_url: a.store_url,
    store_name: a.store_name,
    email: a.email,
    mode: a.mode,
    report_sent: a.report_sent,
    scores: JSON.parse(a.scores),
  }))

  return NextResponse.json(audits)
}
