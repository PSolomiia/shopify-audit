import * as cheerio from 'cheerio'

export interface ScanResult {
  title: string
  metaDescription: string
  h1Tags: string[]
  h2Tags: string[]
  images: { src: string; alt: string; hasAlt: boolean }[]
  links: { href: string; text: string }[]
  hasSearchBar: boolean
  hasCart: boolean
  hasTrustBadges: boolean
  hasReviews: boolean
  hasNewsletterForm: boolean
  navItems: string[]
  pageLoadable: boolean
  error?: string
  // Shopify-specific
  shopifyMeta?: {
    currency?: string
    shop?: string
    theme?: string
  }
  collectionLinks: string[]
  productLinks: string[]
}

export async function scanWebsite(url: string): Promise<ScanResult> {
  const base: ScanResult = {
    title: '', metaDescription: '', h1Tags: [], h2Tags: [],
    images: [], links: [], hasSearchBar: false, hasCart: false,
    hasTrustBadges: false, hasReviews: false, hasNewsletterForm: false,
    navItems: [], pageLoadable: false, collectionLinks: [], productLinks: [],
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ShopifyAuditBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    })
    clearTimeout(timeout)

    if (!res.ok) {
      return { ...base, error: `HTTP ${res.status}` }
    }

    const html = await res.text()
    const $ = cheerio.load(html)

    base.pageLoadable = true
    base.title = $('title').first().text().trim()
    base.metaDescription = $('meta[name="description"]').attr('content')?.trim() || ''

    $('h1').each((_, el) => { base.h1Tags.push($(el).text().trim()) })
    $('h2').each((_, el) => { base.h2Tags.push($(el).text().trim().slice(0, 80)) })

    $('img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || ''
      const alt = $(el).attr('alt') || ''
      if (src) base.images.push({ src, alt, hasAlt: alt.trim().length > 0 })
    })

    $('a').each((_, el) => {
      const href = $(el).attr('href') || ''
      const text = $(el).text().trim()
      if (href && text) base.links.push({ href, text: text.slice(0, 60) })
      if (href.includes('/collections/')) base.collectionLinks.push(href)
      if (href.includes('/products/')) base.productLinks.push(href)
    })

    // nav items
    $('nav a, header a').each((_, el) => {
      const t = $(el).text().trim()
      if (t && t.length < 40) base.navItems.push(t)
    })
    base.navItems = [...new Set(base.navItems)].slice(0, 15)

    // feature detection
    const htmlLow = html.toLowerCase()
    base.hasSearchBar = htmlLow.includes('type="search"') || htmlLow.includes('input[type=search]') || htmlLow.includes('search-form')
    base.hasCart = htmlLow.includes('cart') || htmlLow.includes('кошик')
    base.hasTrustBadges = /visa|mastercard|paypal|ssl|secure|guarantee|гарантія|безпечн/i.test(html)
    base.hasReviews = /review|відгук|rating|оцінка|stars|★/i.test(html)
    base.hasNewsletterForm = /newsletter|subscribe|підписат|email.*form/i.test(html)

    // Shopify meta
    const shopifyJson = html.match(/Shopify\.shop\s*=\s*["']([^"']+)["']/)
    const currency = html.match(/Shopify\.currency\s*=\s*\{[^}]*"active"\s*:\s*"([^"]+)"/)
    if (shopifyJson || currency) {
      base.shopifyMeta = {
        shop: shopifyJson?.[1],
        currency: currency?.[1],
      }
    }

    // deduplicate
    base.collectionLinks = [...new Set(base.collectionLinks)].slice(0, 20)
    base.productLinks = [...new Set(base.productLinks)].slice(0, 20)

    return base
  } catch (err: any) {
    return { ...base, error: err.message || 'Не вдалось завантажити сторінку' }
  }
}

export async function scanShopifyApi(storeHandle: string, apiKey: string) {
  const base = `https://${storeHandle}.myshopify.com/admin/api/2024-04`
  const headers = {
    'X-Shopify-Access-Token': apiKey,
    'Content-Type': 'application/json',
  }

  const [productsRes, collectionsRes, pagesRes] = await Promise.allSettled([
    fetch(`${base}/products.json?limit=50&fields=id,title,images,handle,status`, { headers }),
    fetch(`${base}/custom_collections.json?limit=50&fields=id,title,handle,image`, { headers }),
    fetch(`${base}/pages.json?limit=20&fields=id,title,body_html`, { headers }),
  ])

  const products = productsRes.status === 'fulfilled' && productsRes.value.ok
    ? (await productsRes.value.json()).products : []
  const collections = collectionsRes.status === 'fulfilled' && collectionsRes.value.ok
    ? (await collectionsRes.value.json()).custom_collections : []
  const pages = pagesRes.status === 'fulfilled' && pagesRes.value.ok
    ? (await pagesRes.value.json()).pages : []

  return {
    productCount: products.length,
    productsWithoutImages: products.filter((p: any) => !p.images?.length).length,
    collectionCount: collections.length,
    collectionsWithoutImage: collections.filter((c: any) => !c.image).length,
    pageCount: pages.length,
    sampleProducts: products.slice(0, 5).map((p: any) => ({
      title: p.title,
      handle: p.handle,
      status: p.status,
      imageCount: p.images?.length || 0,
    })),
  }
}
