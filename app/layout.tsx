import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ShopifyAudit — AI аудит магазину',
  description: 'Реальне сканування + Shopify API + Claude AI. SEO, швидкість, UX, конверсія.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk">
      <body style={{ margin: 0, padding: 0, background: '#0d0d0d' }}>
        {children}
      </body>
    </html>
  )
}
