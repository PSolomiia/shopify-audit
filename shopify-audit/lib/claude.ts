import Anthropic from '@anthropic-ai/sdk'
import type { ScanResult } from './scraper'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface AuditScores {
  seo: number
  speed: number
  ux: number
  catalog: number
  conversion: number
}

export interface Recommendation {
  priority: 'high' | 'mid' | 'low'
  category: 'seo' | 'speed' | 'ux' | 'catalog' | 'conversion'
  title: string
  description: string
  howToFix: string
  effort: 'easy' | 'medium' | 'hard'
  impact: 'high' | 'medium' | 'low'
}

export interface AuditResult {
  storeName: string
  scores: AuditScores
  summary: string
  recommendations: Recommendation[]
}

export async function analyzeWithClaude(
  url: string,
  scan: ScanResult,
  shopifyData?: object
): Promise<AuditResult> {
  const imagesTotal = scan.images.length
  const imagesWithoutAlt = scan.images.filter(i => !i.hasAlt).length
  const altCoverage = imagesTotal > 0 ? Math.round((1 - imagesWithoutAlt / imagesTotal) * 100) : 0

  const context = `
ДАНІ РЕАЛЬНОГО СКАНУВАННЯ САЙТУ: ${url}

=== ОСНОВНА ІНФОРМАЦІЯ ===
Title: "${scan.title}"
Meta Description: "${scan.metaDescription || 'ВІДСУТНЯ'}"
H1 теги (${scan.h1Tags.length}): ${scan.h1Tags.slice(0, 3).join(' | ') || 'ВІДСУТНІ'}
H2 теги (перші 5): ${scan.h2Tags.slice(0, 5).join(' | ') || 'відсутні'}

=== ЗОБРАЖЕННЯ ===
Всього зображень: ${imagesTotal}
Без alt-тегу: ${imagesWithoutAlt} (${100 - altCoverage}%)

=== НАВІГАЦІЯ ===
Пунктів у меню: ${scan.navItems.length}
Пункти: ${scan.navItems.join(', ') || 'не визначено'}
Є пошук: ${scan.hasSearchBar ? 'ТАК' : 'НІ'}
Є кошик: ${scan.hasCart ? 'ТАК' : 'НІ'}

=== КОНВЕРСІЙНІ ЕЛЕМЕНТИ ===
Trust badges (Visa/SSL/гарантія): ${scan.hasTrustBadges ? 'ТАК' : 'НІ'}
Відгуки/рейтинги: ${scan.hasReviews ? 'ТАК' : 'НІ'}
Форма підписки на email: ${scan.hasNewsletterForm ? 'ТАК' : 'НІ'}

=== КАТАЛОГ ===
Посилань на колекції: ${scan.collectionLinks.length}
Посилань на продукти: ${scan.productLinks.length}
${scan.shopifyMeta ? `Shopify магазин підтверджено. Валюта: ${scan.shopifyMeta.currency}` : ''}

${shopifyData ? `=== ДАНІ SHOPIFY API ===\n${JSON.stringify(shopifyData, null, 2)}` : ''}
${scan.error ? `\nПОМИЛКА СКАНУВАННЯ: ${scan.error}` : ''}
`.trim()

  const prompt = `Ти — провідний Shopify CRO консультант. Проаналізуй РЕАЛЬНІ дані сканування магазину і дай конкретні, actionable рекомендації.

${context}

Дай чесні оцінки (не завищуй — типовий магазин 45-70 балів). Спирайся виключно на надані дані.

Поверни ТІЛЬКИ валідний JSON:
{
  "storeName": "назва або домен",
  "scores": {
    "seo": число 0-100,
    "speed": число 0-100,
    "ux": число 0-100,
    "catalog": число 0-100,
    "conversion": число 0-100
  },
  "summary": "2-3 речення загального висновку про магазин",
  "recommendations": [
    {
      "priority": "high|mid|low",
      "category": "seo|speed|ux|catalog|conversion",
      "title": "назва проблеми (до 70 символів)",
      "description": "що саме не так і чому це важливо (2-3 речення)",
      "howToFix": "конкретні кроки як виправити (2-4 речення з конкретними діями)",
      "effort": "easy|medium|hard",
      "impact": "high|medium|low"
    }
  ]
}

Правила:
- Мінімум 10, максимум 15 рекомендацій
- Спирайся на реальні дані — якщо alt-теги відсутні, вкажи точну кількість
- Якщо meta description відсутня — це high priority
- Пиши українською, конкретно і по-діловому
- howToFix має бути з конкретними кроками (де натиснути в Shopify Admin)`

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3000,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = msg.content
    .filter(b => b.type === 'text')
    .map(b => (b as any).text)
    .join('')
    .replace(/```json|```/g, '')
    .trim()

  return JSON.parse(raw) as AuditResult
}
