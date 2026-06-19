import nodemailer from 'nodemailer'
import type { AuditResult } from './claude'

const catLabel: Record<string, string> = {
  seo: 'SEO', speed: 'Швидкість', ux: 'UX', catalog: 'Каталог', conversion: 'Конверсія'
}
const effortLabel: Record<string, string> = {
  easy: 'Легко', medium: 'Середньо', hard: 'Складно'
}
const priorityLabel: Record<string, string> = {
  high: '🔴 Високий', mid: '🟡 Середній', low: '🟢 Низький'
}

function getTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

export async function sendAuditReport(
  to: string,
  storeUrl: string,
  result: AuditResult
): Promise<boolean> {
  try {
    const transport = getTransport()

    const scores = result.scores
    const overall = Math.round(
      Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length
    )

    const scoreRows = Object.entries(scores)
      .map(([k, v]) => `<tr><td style="padding:6px 12px;color:#666">${catLabel[k] || k}</td><td style="padding:6px 12px;font-weight:600;color:${v >= 70 ? '#3b8f1e' : v >= 50 ? '#b86e00' : '#c0392b'}">${v}/100</td></tr>`)
      .join('')

    const recRows = result.recommendations
      .sort((a, b) => ({ high: 0, mid: 1, low: 2 }[a.priority] || 1) - ({ high: 0, mid: 1, low: 2 }[b.priority] || 1))
      .map((r, i) => `
        <div style="border:1px solid #e5e5e5;border-left:4px solid ${r.priority === 'high' ? '#e74c3c' : r.priority === 'mid' ? '#f39c12' : '#27ae60'};border-radius:6px;padding:16px;margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px">
            <strong style="font-size:15px">${i + 1}. ${r.title}</strong>
            <span style="font-size:12px;color:#888">${priorityLabel[r.priority]}</span>
          </div>
          <p style="margin:0 0 8px;color:#444;font-size:14px">${r.description}</p>
          <div style="background:#f8f9fa;border-radius:4px;padding:10px;font-size:13px;color:#333">
            <strong>Як виправити:</strong> ${r.howToFix}
          </div>
          <div style="margin-top:8px;font-size:12px;color:#888">
            Категорія: ${catLabel[r.category]} · Зусилля: ${effortLabel[r.effort]}
          </div>
        </div>`)
      .join('')

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<div style="max-width:640px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">

  <div style="background:#0d0d0d;padding:28px 32px">
    <div style="color:#7fff6e;font-size:13px;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:8px">Shopify Store Audit</div>
    <h1 style="color:#fff;font-size:22px;margin:0 0 4px">${result.storeName}</h1>
    <div style="color:#888;font-size:13px">${storeUrl}</div>
  </div>

  <div style="padding:28px 32px">
    <div style="text-align:center;margin-bottom:28px">
      <div style="font-size:56px;font-weight:700;color:${overall >= 70 ? '#27ae60' : overall >= 50 ? '#e67e22' : '#e74c3c'};line-height:1">${overall}</div>
      <div style="color:#888;font-size:14px;margin-top:4px">Загальний бал / 100</div>
      <p style="color:#444;font-size:15px;margin:16px 0 0;line-height:1.6">${result.summary}</p>
    </div>

    <h2 style="font-size:16px;font-weight:600;margin:0 0 12px;border-bottom:1px solid #eee;padding-bottom:8px">Оцінки по категоріях</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      ${scoreRows}
    </table>

    <h2 style="font-size:16px;font-weight:600;margin:0 0 16px;border-bottom:1px solid #eee;padding-bottom:8px">Рекомендації (${result.recommendations.length})</h2>
    ${recRows}

    <div style="text-align:center;margin-top:28px;padding-top:20px;border-top:1px solid #eee;color:#aaa;font-size:12px">
      Звіт згенеровано ShopifyAudit · ${new Date().toLocaleDateString('uk-UA')}
    </div>
  </div>
</div>
</body>
</html>`

    await transport.sendMail({
      from: process.env.EMAIL_FROM || 'ShopifyAudit <noreply@example.com>',
      to,
      subject: `Аудит магазину ${result.storeName} — ${overall}/100 балів`,
      html,
    })
    return true
  } catch (err) {
    console.error('Email send error:', err)
    return false
  }
}
