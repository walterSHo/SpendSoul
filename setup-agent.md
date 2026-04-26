# SpendSoul Setup Notes

## Current State

SpendSoul is an existing personal finance tracker, not an empty starter project.

Repository contents:

- `index.html`: static application shell
- `style.css`: UI styling
- `app.js`: browser app, local cache, charts, forms, API client
- `config.js`: frontend Worker URL
- `worker.js`: Cloudflare Worker API
- `wrangler.toml`: Worker deployment config
- `.dev.vars.example`: local secret template for Wrangler
- `README.md`: setup, auth, API, and deploy instructions

## Runtime Requirements

- Cloudflare Workers
- Cloudflare KV namespace bound as `EXPENSES_KV`
- Worker secrets:
  - `TELEGRAM_BOT_TOKEN`
  - `OPENAI_API_KEY`
  - optional `TELEGRAM_AUTH_MAX_AGE_SECONDS`
  - optional `DEV_TELEGRAM_USER_ID` for local development
  - optional `LEGACY_DATA_OWNER_TELEGRAM_ID` for old unscoped KV data
  - optional `COINGECKO_API_KEY`

## Development Checklist

1. Copy `.dev.vars.example` to `.dev.vars`.
2. Fill local secrets.
3. Replace `REPLACE_WITH_KV_NAMESPACE_ID` in `wrangler.toml` with a real KV namespace id.
4. Check `config.js` points to the correct Worker URL.
5. Run syntax checks:

```sh
node --check worker.js
node --check app.js
```

6. Deploy with Wrangler when ready:

```sh
wrangler deploy
```

## Current Architecture Notes

- All `/api/*` endpoints require Telegram auth: Mini App init data or Login Widget signed data.
- New KV records are stored as individual keys by Telegram user id and collection prefix.
- Legacy array keys are only read for `LEGACY_DATA_OWNER_TELEGRAM_ID`, so users do not see each other's data.
- The browser does not prompt for API tokens; it either sends `window.Telegram.WebApp.initData` or shows Telegram Login for `@spendsoul_bot`.
- Offline mode is read-only; local cache can be viewed, but server writes are blocked until sync is restored.
