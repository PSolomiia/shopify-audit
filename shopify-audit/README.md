# ShopifyAudit — AI агент аудиту Shopify магазинів

Повноцінний веб-агент: реальне сканування сайту + Shopify API + Claude AI аналіз.

## Що робить агент

- **Сканує сайт** — заголовки, мета-теги, зображення, alt-теги, навігацію, trust badges, відгуки
- **Shopify API** (опціонально) — кількість продуктів/колекцій, відсутні зображення
- **Claude AI** — аналізує реальні дані і дає 10-15 конкретних рекомендацій з пріоритетами
- **Зберігає** всі аудити в SQLite базу даних (вкладка "Історія")
- **Email** — автоматично відправляє HTML звіт клієнту після аудиту

## Структура проєкту

```
shopify-audit/
├── app/
│   ├── layout.tsx          ← HTML оболонка
│   ├── page.tsx            ← Головна сторінка (UI)
│   └── api/
│       ├── audit/route.ts  ← Головний агент (POST /api/audit)
│       └── history/route.ts← Історія аудитів (GET /api/history)
├── lib/
│   ├── scraper.ts          ← Реальне сканування сайту (cheerio)
│   ├── claude.ts           ← Claude AI аналіз
│   ├── email.ts            ← Відправка email звіту (nodemailer)
│   └── db.ts               ← SQLite база даних (better-sqlite3)
├── .env.example            ← Шаблон змінних середовища
├── next.config.js
├── package.json
└── tsconfig.json
```

## Деплой на Vercel (рекомендовано)

### Крок 1 — Підготовка

```bash
# Встановити залежності
npm install

# Скопіювати .env
cp .env.example .env.local
# Заповнити ANTHROPIC_API_KEY та SMTP дані
```

### Крок 2 — Деплой

**Варіант A: GitHub + Vercel (найпростіше)**
1. Завантаж папку на GitHub (новий репозиторій)
2. Зайди на vercel.com → "New Project" → вибери репозиторій
3. У "Environment Variables" додай:
   - `ANTHROPIC_API_KEY` = твій ключ з console.anthropic.com
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`
4. Deploy → готово!

**Варіант B: Vercel CLI**
```bash
npm i -g vercel
vercel
# Слідуй інструкціям, додай env variables
```

> ⚠️ На Vercel SQLite зберігається тимчасово (файлова система). Для постійної бази даних:
> - **Vercel KV** або **PlanetScale** (MySQL) — безкоштовні tier є
> - Або просто деплой на **Railway.app** / **Render.com** — там є persistent disk

### Крок 3 — Локальний запуск

```bash
npm run dev
# Відкрий http://localhost:3000
```

## Налаштування Email (Gmail)

1. Зайди в Google Account → Security → 2-Step Verification (увімкни)
2. Search "App passwords" → Create → вибери "Mail"
3. Скопіюй 16-значний пароль
4. `.env.local`:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your@gmail.com
   SMTP_PASS=abcd efgh ijkl mnop   # пароль без пробілів
   EMAIL_FROM="ShopifyAudit <your@gmail.com>"
   ```

## API Endpoints

### POST /api/audit
Запускає аудит магазину.

**Body:**
```json
{
  "url": "https://example.myshopify.com",
  "mode": "url",
  "email": "client@example.com",
  "shopifyHandle": "example",
  "shopifyApiKey": "shpat_..."
}
```

**Response:**
```json
{
  "auditId": 42,
  "emailSent": true,
  "scan": { "imagesTotal": 87, "imagesWithoutAlt": 34, ... },
  "result": {
    "storeName": "Example Store",
    "scores": { "seo": 61, "speed": 54, "ux": 70, ... },
    "summary": "...",
    "recommendations": [...]
  }
}
```

### GET /api/history
Повертає список всіх аудитів.

### GET /api/history?id=42
Повертає конкретний аудит з рекомендаціями.

## Як продавати

- **Разовий аудит** — давай клієнту посилання, він вводить URL
- **Підписка** — додай авторизацію (NextAuth.js) + Stripe billing
- **Білий ярлик** — зміни лого і кольори під свій бренд

## Технологічний стек

| Шар | Технологія |
|-----|------------|
| Frontend | Next.js 14 (App Router) + чистий CSS |
| Backend | Next.js API Routes (serverless) |
| AI | Claude claude-sonnet-4-6 (Anthropic) |
| Сканування | cheerio (HTML парсинг) |
| База даних | SQLite (better-sqlite3) |
| Email | nodemailer |
| Деплой | Vercel |
