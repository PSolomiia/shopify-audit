import { NextRequest, NextResponse } from 'next/server'
import { scanWebsite, scanShopifyApi } from '@/lib/scraper'
import { analyzeWithClaude } from '@/lib/claude'
import { saveAudit, markReportSent } from '@/lib/db'
import { sendAuditReport } from '@/lib/email'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { url, mode, shopifyHandle, shopifyApiKey, email } = body

    if (!url) {
      return NextResponse.json({ error: 'URL обов\'язковий' }, { status: 400 })
    }

    // 1. Scan the website
    console.log(`[Audit] Scanning: ${url}`)
    const scan = await scanWebsite(url)

    // 2. Optionally fetch Shopify API data
    let shopifyData: object | undefined
    if (mode === 'api' && shopifyHandle && shopifyApiKey) {
      console.log(`[Audit] Fetching Shopify API for: ${shopifyHandle}`)
      try {
        shopifyData = await scanShopifyApi(shopifyHandle, shopifyApiKey)
      } catch (e) {
        console.warn('[Audit] Shopify API error (continuing without):', e)
      }
    }

    // 3. Analyze with Claude
    console.log(`[Audit] Running Claude analysis`)
    const result = await analyzeWithClaude(url, scan, shopifyData)

    // 4. Save to database
    const auditId = saveAudit({
      store_url: url,
      store_name: result.storeName,
      email: email || null,
      mode: mode || 'url',
      scores: result.scores,
      recommendations: result.recommendations,
      raw_scan: { scan, shopifyData },
    })
    console.log(`[Audit] Saved audit #${auditId}`)

    // 5. Send email if provided
    let emailSent = false
    if (email && email.includes('@')) {
      emailSent = await sendAuditReport(email, url, result)
      if (emailSent) markReportSent(auditId)
      console.log(`[Audit] Email ${emailSent ? 'sent' : 'failed'} to ${email}`)
    }

    return NextResponse.json({
      auditId,
      emailSent,
      scan: {
        pageLoadable: scan.pageLoadable,
        imagesTotal: scan.images.length,
        imagesWithoutAlt: scan.images.filter(i => !i.hasAlt).length,
        hasMetaDescription: scan.metaDescription.length > 0,
        navItemCount: scan.navItems.length,
        collectionCount: scan.collectionLinks.length,
        productCount: scan.productLinks.length,
        features: {
          search: scan.hasSearchBar,
          cart: scan.hasCart,
          trustBadges: scan.hasTrustBadges,
          reviews: scan.hasReviews,
          newsletter: scan.hasNewsletterForm,
        },
      },
      result,
    })
  } catch (err: any) {
    console.error('[Audit] Error:', err)
    return NextResponse.json(
      { error: err.message || 'Помилка аудиту' },
      { status: 500 }
    )
  }
}
