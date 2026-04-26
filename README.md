# SpendSoul

Personal finance tracker with a static frontend and a Cloudflare Worker API.

## Stack

- Frontend: static `index.html`, `style.css`, `app.js`
- Backend: Cloudflare Worker in `worker.js`
- Storage: Cloudflare KV plus browser `localStorage` cache
- AI normalization: OpenAI Responses API
- Crypto prices: CoinGecko simple price API

## Local Setup

1. Create local Worker secrets:

```sh
cp .dev.vars.example .dev.vars
```

2. Fill `.dev.vars`:

- `TELEGRAM_BOT_TOKEN`: bot token used to validate Telegram Mini App init data
- `TELEGRAM_AUTH_MAX_AGE_SECONDS`: optional init data lifetime, default `86400`
- `DEV_TELEGRAM_USER_ID`: optional local development fallback user id
- `LEGACY_DATA_OWNER_TELEGRAM_ID`: optional Telegram user id that can see old unscoped KV data
- `OPENAI_API_KEY`: OpenAI API key for expense normalization
- `COINGECKO_API_KEY`: optional CoinGecko demo API key

3. Run the Worker locally if Wrangler is installed:

```sh
wrangler dev
```

4. For local frontend testing, create an ignored local override:

```sh
cp config.local.example.js config.local.js
```

This points the browser to `http://localhost:8787` and uses `DEV_TELEGRAM_USER_ID` from the local Worker. Telegram Login Widget does not work on `localhost`.

5. Open `index.html` through GitHub Pages or as a Telegram Mini App. On a normal website, SpendSoul shows Telegram Login for `@spendsoul_bot`; inside Telegram, it uses Mini App `initData` automatically.

## Telegram Setup

1. Create or open `@spendsoul_bot` in BotFather.
2. Configure the Login Widget domain with BotFather `/setdomain`: use `waltersho.github.io`, not the full `/SpendSoul/` URL.
3. Optionally configure the Mini App / Web App URL to the deployed GitHub Pages URL.
4. Set the bot token in Cloudflare:

```sh
wrangler secret put TELEGRAM_BOT_TOKEN
```

Each Telegram user gets separate KV records under `users:<telegram_user_id>:...`. If Maxim logs in, he sees only his records; if his girlfriend logs in, she gets her own independent records.

## Frontend Config

The Worker URL lives in `config.js`:

```js
window.SPENDSOUL_CONFIG = {
  workerBaseUrl: "https://spendsoul-api.waltershcroder.workers.dev",
  telegramBotUsername: "spendsoul_bot",
};
```

Use `config.example.js` as a template when moving the frontend to another Worker URL. If `workerBaseUrl` is empty, the app calls same-origin `/api/*` paths. Local cache keys include the Telegram user id after Telegram Login or Mini App auth.

## Cloudflare Setup

Create a KV namespace:

```sh
wrangler kv namespace create EXPENSES_KV
```

Copy the returned namespace `id` into `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "EXPENSES_KV"
id = "your_namespace_id"
```

Set production secrets:

```sh
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put OPENAI_API_KEY
wrangler secret put COINGECKO_API_KEY
wrangler secret put LEGACY_DATA_OWNER_TELEGRAM_ID
```

Deploy the Worker:

```sh
wrangler deploy
```

## API Auth

All `/api/*` endpoints require Telegram Mini App auth:

```http
X-Telegram-Init-Data: <window.Telegram.WebApp.initData>
```

or Telegram Login Widget auth:

```http
X-Telegram-Auth-Data: <signed Telegram login JSON>
```

The Worker validates the Telegram signature with `TELEGRAM_BOT_TOKEN` and stores data under `users:<telegram_user_id>:...`, so different Telegram users do not share expense data.

## Current API

- `GET /api/expenses`
- `GET /api/incomes`
- `GET /api/crypto-assets`
- `GET /api/recurring-expenses`
- `GET /api/crypto-prices?ids=bitcoin,ethereum`
- `POST /api/normalize-expense`
- `POST /api/add-expense`
- `POST /api/add-income`
- `POST /api/add-crypto-asset`
- `POST /api/add-recurring-expense`
- `POST /api/materialize-recurring-expenses`
- `POST /api/reset-data`
- `DELETE /api/expenses/:id`
- `DELETE /api/incomes/:id`
- `DELETE /api/crypto-assets/:id`
- `DELETE /api/recurring-expenses/:id`
