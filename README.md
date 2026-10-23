# 📦 Sales Analytics Bot for Wildberries Sellers

**English** · [Русский](README.ru.md)

A Telegram bot that sends a marketplace seller a morning summary of yesterday: orders, purchases, returns, best sellers and products that are about to run out. Buttons show stock levels with a forecast and the top products of the week.

Built on the official [Wildberries](https://www.wildberries.ru) seller API (the largest marketplace in Russia and CIS). Without an API token it runs on demo data.

> The same approach works for any marketplace with a seller API — Amazon SP-API, Etsy, Shopify, Ozon.

<img src="docs/report.png" width="380" alt="Daily report in Telegram: orders, purchases, best sellers, low stock"> <img src="docs/stocks.png" width="380" alt="Stock levels with traffic-light forecast">

## Features

- **Daily report** at a set time (09:00 Moscow time by default): orders and revenue, change vs. the previous day, purchases and payout amount, returns and cancellations, orders per day for the last week
- **Best sellers of the day** — top 3 products by revenue
- **Stock forecast**: how many days each product will last at the current order rate, with a warning below 7 days (configurable)
- **Commands and buttons**: `/report` — yesterday, `/today` — today so far, `/stocks` — all stock with 🔴🟡🟢 status, `/top` — top 10 for 7 days
- **Private access**: the bot only answers the owner and the users listed in the settings

## How it works

- Orders and sales — `statistics-api.wildberries.ru` (`/api/v1/supplier/orders`, `/api/v1/supplier/sales`) with pagination beyond 80,000 rows
- Stock — the `warehouse_remains` report from `seller-analytics-api.wildberries.ru` in three steps: create a task → wait until ready → download
- The API allows 1 request per minute per method and data updates every 30 minutes, so responses are cached for 30 minutes
- Clear error messages for invalid tokens, missing permissions and rate limits
- 9 automated tests: calculations, forecast, API client with a mocked `fetch`, scheduling

## Tech stack

Node.js 24 · TypeScript · grammY · `fetch` · `node:test`. No database, minimal dependencies.

## Structure

```
src/
├── index.ts          # starts the bot and the daily schedule
├── bot.ts            # commands, buttons, access control
├── report.ts         # report texts
├── analytics.ts      # daily summary, top products, stock forecast
├── scheduler.ts      # runs a task every day at a set time
├── print-report.ts   # prints a report to the console, no Telegram needed
└── wb/
    ├── client.ts     # Wildberries API client
    ├── demo.ts       # demo store for running without a token
    └── types.ts      # API response fields
```

## Running

Requires **Node.js 24+**.

```bash
npm install
npm run report           # yesterday's report in the console (demo data)
npm run report stocks    # stock levels
```

With Telegram: create a bot with [@BotFather](https://t.me/BotFather), copy `.env.example` to `.env`, set `BOT_TOKEN`, run `npm start`, send `/myid` to the bot and put the ID into `ADMIN_IDS`. For a real store, add a seller API token with "Statistics" and "Analytics" access to `WB_TOKEN`.

**Possible extensions:** other marketplaces, several stores in one bot, Google Sheets export, chart images, advertising reports, new review alerts.
