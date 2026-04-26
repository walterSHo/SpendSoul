const ALLOWED_FOR_WHOM = new Set([
  "myself",
  "friend",
  "girlfriend",
  "family",
  "pet",
  "gift",
  "loan",
  "household",
  "other",
]);

const DEFAULT_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Telegram-Init-Data,X-Telegram-Auth-Data",
};
const BOT_LOGIN_PREFIX = "bot_login:";
const BOT_LOGIN_TTL_SECONDS = 300;
const DEFAULT_SITE_URL = "https://waltersho.github.io/SpendSoul/";
const TELEGRAM_BOT_USERNAME = "spendsoul_bot";

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: DEFAULT_CORS_HEADERS,
      });
    }

    const url = new URL(request.url);

    try {
      const authContext = url.pathname.startsWith("/api/") && !isPublicApiPath(url.pathname) ? await getAuthContext(request, env) : null;

      if (request.method === "POST" && url.pathname === "/api/bot-login-token") {
        const loginToken = await createBotLoginToken(env);
        return jsonResponse(loginToken, 201);
      }

      if (request.method === "GET" && url.pathname === "/api/bot-login-status") {
        const loginStatus = await getBotLoginStatus(env, url);
        return jsonResponse(loginStatus);
      }

      if (request.method === "POST" && url.pathname === "/telegram-webhook") {
        const update = await request.json();
        await handleTelegramWebhook(update, env);
        return jsonResponse({ ok: true });
      }

      if (request.method === "GET" && url.pathname === "/api/expenses") {
        const expenses = await loadExpenses(env, authContext);
        return jsonResponse(expenses);
      }

      if (request.method === "GET" && url.pathname === "/api/incomes") {
        const incomes = await loadIncomes(env, authContext);
        return jsonResponse(incomes);
      }

      if (request.method === "GET" && url.pathname === "/api/crypto-assets") {
        const cryptoAssets = await loadCryptoAssets(env, authContext);
        return jsonResponse(cryptoAssets);
      }

      if (request.method === "GET" && url.pathname === "/api/recurring-expenses") {
        const recurringExpenses = await loadRecurringExpenses(env, authContext);
        return jsonResponse(recurringExpenses);
      }

      if (request.method === "GET" && url.pathname === "/api/crypto-prices") {
        const ids = parseCryptoPriceIds(url);
        const prices = await fetchCryptoPrices(ids, env);
        return jsonResponse(prices);
      }

      if (request.method === "POST" && url.pathname === "/api/normalize-expense") {
        const body = await request.json();
        validateIncomingPayload(body);

        const nextId = await getNextExpenseId(env, authContext);
        const existingExpenses = await loadExpenses(env, authContext);
        const normalizedExpense = await normalizeExpenseWithOpenAI(body, nextId, env, existingExpenses);
        const sanitizedExpense = sanitizeExpense(normalizedExpense, nextId, body);
        const decision = buildNormalizationDecision(sanitizedExpense, existingExpenses);

        return jsonResponse({
          expense: sanitizedExpense,
          decision,
        });
      }

      if (request.method === "POST" && url.pathname === "/api/add-expense") {
        const body = await request.json();
        validateIncomingPayload(body);

        const nextId = Number(body?.id) || (await getNextExpenseId(env, authContext));
        const sanitizedExpense = sanitizeExpense(body, nextId, body);

        await saveExpense(env, authContext, sanitizedExpense);
        return jsonResponse(sanitizedExpense, 201);
      }

      if (request.method === "POST" && url.pathname === "/api/add-income") {
        const body = await request.json();
        validateIncomePayload(body);

        const nextId = Number(body?.id) || (await getNextIncomeId(env, authContext));
        const sanitizedIncome = sanitizeIncome(body, nextId);

        await saveIncome(env, authContext, sanitizedIncome);
        return jsonResponse(sanitizedIncome, 201);
      }

      if (request.method === "POST" && url.pathname === "/api/add-crypto-asset") {
        const body = await request.json();
        validateCryptoAssetPayload(body);

        const nextId = Number(body?.id) || (await getNextCryptoAssetId(env, authContext));
        const sanitizedCryptoAsset = sanitizeCryptoAsset(body, nextId);

        await saveCryptoAsset(env, authContext, sanitizedCryptoAsset);
        return jsonResponse(sanitizedCryptoAsset, 201);
      }

      if (request.method === "POST" && url.pathname === "/api/add-recurring-expense") {
        const body = await request.json();
        validateRecurringExpensePayload(body);

        const nextId = Number(body?.id) || (await getNextRecurringExpenseId(env, authContext));
        const sanitizedRecurringExpense = sanitizeRecurringExpense(body, nextId);

        await saveRecurringExpense(env, authContext, sanitizedRecurringExpense);
        return jsonResponse(sanitizedRecurringExpense, 201);
      }

      if (request.method === "POST" && url.pathname === "/api/materialize-recurring-expenses") {
        const body = await request.json();
        const generatedExpenses = await materializeRecurringExpenses(env, authContext, body);
        return jsonResponse(generatedExpenses, 201);
      }

      if (request.method === "DELETE" && url.pathname.startsWith("/api/expenses/")) {
        const id = parsePathId(url.pathname, "/api/expenses/");
        await deleteExpense(env, authContext, id);
        return jsonResponse({ ok: true, id });
      }

      if (request.method === "DELETE" && url.pathname.startsWith("/api/incomes/")) {
        const id = parsePathId(url.pathname, "/api/incomes/");
        await deleteIncome(env, authContext, id);
        return jsonResponse({ ok: true, id });
      }

      if (request.method === "DELETE" && url.pathname.startsWith("/api/crypto-assets/")) {
        const id = parsePathId(url.pathname, "/api/crypto-assets/");
        await deleteCryptoAsset(env, authContext, id);
        return jsonResponse({ ok: true, id });
      }

      if (request.method === "DELETE" && url.pathname.startsWith("/api/recurring-expenses/")) {
        const id = parsePathId(url.pathname, "/api/recurring-expenses/");
        await deleteRecurringExpense(env, authContext, id);
        return jsonResponse({ ok: true, id });
      }

      if (request.method === "POST" && url.pathname === "/api/reset-data") {
        await resetAllData(env, authContext);
        return jsonResponse({ ok: true });
      }

      return jsonResponse({ error: "Not found" }, 404);
    } catch (error) {
      const status = getErrorStatus(error);

      return jsonResponse(
        {
          error: error instanceof Error ? error.message : "Unknown error",
        },
        status,
      );
    }
  },
};

class RequestValidationError extends Error {}
class AuthorizationError extends Error {}
class ConfigurationError extends Error {}

function getErrorStatus(error) {
  if (error instanceof AuthorizationError) {
    return 401;
  }

  if (error instanceof RequestValidationError || error instanceof SyntaxError) {
    return 400;
  }

  if (error instanceof ConfigurationError) {
    return 500;
  }

  return 500;
}

function isPublicApiPath(pathname) {
  return pathname === "/api/bot-login-token" || pathname === "/api/bot-login-status";
}

async function getAuthContext(request, env) {
  const initData = request.headers.get("X-Telegram-Init-Data") || "";
  if (initData) {
    return validateTelegramInitData(initData, env);
  }

  const loginAuthData = request.headers.get("X-Telegram-Auth-Data") || "";
  if (loginAuthData) {
    return validateTelegramLoginAuthData(loginAuthData, env);
  }

  if (env.DEV_TELEGRAM_USER_ID) {
    return {
      userId: String(env.DEV_TELEGRAM_USER_ID),
      user: {
        id: Number(env.DEV_TELEGRAM_USER_ID),
        first_name: "Dev",
      },
    };
  }

  throw new AuthorizationError("Open SpendSoul from Telegram to authorize.");
}

async function validateTelegramLoginAuthData(authData, env) {
  if (!env.TELEGRAM_BOT_TOKEN) {
    throw new ConfigurationError("TELEGRAM_BOT_TOKEN is not configured.");
  }

  let payload;
  try {
    payload = JSON.parse(authData);
  } catch {
    throw new AuthorizationError("Telegram login data is invalid.");
  }

  const receivedHash = String(payload.hash || "");
  if (!receivedHash) {
    throw new AuthorizationError("Telegram login hash is missing.");
  }

  const authDate = Number(payload.auth_date || 0);
  const maxAgeSeconds = Number(env.TELEGRAM_AUTH_MAX_AGE_SECONDS || 86400);
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSeconds) {
    throw new AuthorizationError("Telegram login is expired.");
  }

  const dataCheckString = Object.entries(payload)
    .filter(([key, value]) => key !== "hash" && value !== undefined && value !== null)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = await sha256Bytes(env.TELEGRAM_BOT_TOKEN);
  const calculatedHash = bytesToHex(await hmacSha256Bytes(secretKey, dataCheckString));
  if (!constantTimeEqual(calculatedHash, receivedHash)) {
    throw new AuthorizationError("Telegram login is invalid.");
  }

  if (!payload.id) {
    throw new AuthorizationError("Telegram login user is missing.");
  }

  return {
    userId: String(payload.id),
    user: {
      id: Number(payload.id),
      first_name: String(payload.first_name || ""),
      last_name: String(payload.last_name || ""),
      username: String(payload.username || ""),
      photo_url: String(payload.photo_url || ""),
    },
  };
}

async function validateTelegramInitData(initData, env) {
  if (!env.TELEGRAM_BOT_TOKEN) {
    throw new ConfigurationError("TELEGRAM_BOT_TOKEN is not configured.");
  }

  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash") || "";
  params.delete("hash");

  if (!receivedHash) {
    throw new AuthorizationError("Telegram authorization hash is missing.");
  }

  const authDate = Number(params.get("auth_date") || 0);
  const maxAgeSeconds = Number(env.TELEGRAM_AUTH_MAX_AGE_SECONDS || 86400);
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSeconds) {
    throw new AuthorizationError("Telegram authorization is expired.");
  }

  const dataCheckString = [...params.entries()]
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = await hmacSha256Bytes("WebAppData", env.TELEGRAM_BOT_TOKEN);
  const calculatedHash = bytesToHex(await hmacSha256Bytes(secretKey, dataCheckString));
  if (!constantTimeEqual(calculatedHash, receivedHash)) {
    throw new AuthorizationError("Telegram authorization is invalid.");
  }

  const user = parseTelegramUser(params.get("user"));
  return {
    userId: String(user.id),
    user,
  };
}

function parseTelegramUser(value) {
  if (!value) {
    throw new AuthorizationError("Telegram user is missing.");
  }

  try {
    const user = JSON.parse(value);
    if (!user?.id) {
      throw new Error("Missing user id.");
    }

    return user;
  } catch {
    throw new AuthorizationError("Telegram user is invalid.");
  }
}

async function createBotLoginToken(env) {
  if (!env.EXPENSES_KV) {
    throw new ConfigurationError("EXPENSES_KV is not configured.");
  }

  const nonce = crypto.randomUUID().replaceAll("-", "");
  const now = Math.floor(Date.now() / 1000);
  await env.EXPENSES_KV.put(
    getBotLoginKey(nonce),
    JSON.stringify({
      status: "pending",
      created_at: now,
      expires_at: now + BOT_LOGIN_TTL_SECONDS,
    }),
    { expirationTtl: BOT_LOGIN_TTL_SECONDS },
  );

  return {
    nonce,
    expires_at: now + BOT_LOGIN_TTL_SECONDS,
    bot_url: `https://t.me/${TELEGRAM_BOT_USERNAME}?start=login_${nonce}`,
  };
}

async function getBotLoginStatus(env, url) {
  if (!env.EXPENSES_KV) {
    throw new ConfigurationError("EXPENSES_KV is not configured.");
  }

  const nonce = sanitizeLoginNonce(url.searchParams.get("nonce"));
  if (!nonce) {
    throw new RequestValidationError("nonce is required.");
  }

  const raw = await env.EXPENSES_KV.get(getBotLoginKey(nonce));
  if (!raw) {
    return { status: "expired" };
  }

  const loginState = JSON.parse(raw);
  if (loginState.status !== "authorized" || !loginState.user) {
    return { status: "pending" };
  }

  return {
    status: "authorized",
    auth_data: await signTelegramLoginPayload(loginState.user, env),
  };
}

async function handleTelegramWebhook(update, env) {
  const message = update?.message;
  const text = String(message?.text || "");
  const from = message?.from;
  const chatId = message?.chat?.id;
  const nonce = extractLoginNonce(text);

  if (!nonce || !from?.id || !chatId || !env.EXPENSES_KV) {
    return;
  }

  const raw = await env.EXPENSES_KV.get(getBotLoginKey(nonce));
  if (!raw) {
    await sendTelegramMessage(env, chatId, "Сессия входа устарела. Откройте SpendSoul и нажмите вход через Telegram еще раз.");
    return;
  }

  const loginState = JSON.parse(raw);
  await env.EXPENSES_KV.put(
    getBotLoginKey(nonce),
    JSON.stringify({
      ...loginState,
      status: "authorized",
      authorized_at: Math.floor(Date.now() / 1000),
      user: {
        id: from.id,
        first_name: String(from.first_name || ""),
        last_name: String(from.last_name || ""),
        username: String(from.username || ""),
        photo_url: "",
      },
    }),
    { expirationTtl: BOT_LOGIN_TTL_SECONDS },
  );

  await sendTelegramMessage(
    env,
    chatId,
    `Готово, вход подтвержден. Вернитесь на SpendSoul: ${String(env.SITE_URL || DEFAULT_SITE_URL)}`,
  );
}

function extractLoginNonce(text) {
  const match = text.match(/^\/start\s+login_([a-f0-9]{32})$/i);
  return match ? sanitizeLoginNonce(match[1]) : "";
}

function sanitizeLoginNonce(value) {
  return String(value || "").match(/^[a-f0-9]{32}$/i) ? String(value).toLowerCase() : "";
}

function getBotLoginKey(nonce) {
  return `${BOT_LOGIN_PREFIX}${nonce}`;
}

async function signTelegramLoginPayload(user, env) {
  if (!env.TELEGRAM_BOT_TOKEN) {
    throw new ConfigurationError("TELEGRAM_BOT_TOKEN is not configured.");
  }

  const payload = {
    id: String(user.id),
    auth_date: String(Math.floor(Date.now() / 1000)),
  };

  if (user.first_name) {
    payload.first_name = String(user.first_name);
  }

  if (user.last_name) {
    payload.last_name = String(user.last_name);
  }

  if (user.username) {
    payload.username = String(user.username);
  }

  const dataCheckString = Object.entries(payload)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = await sha256Bytes(env.TELEGRAM_BOT_TOKEN);
  payload.hash = bytesToHex(await hmacSha256Bytes(secretKey, dataCheckString));
  return JSON.stringify(payload);
}

async function sendTelegramMessage(env, chatId, text) {
  if (!env.TELEGRAM_BOT_TOKEN) {
    return;
  }

  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });
}

async function hmacSha256Bytes(key, value) {
  const rawKey = typeof key === "string" ? new TextEncoder().encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey("raw", rawKey, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(String(value)));
  return new Uint8Array(signature);
}

async function sha256Bytes(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value)));
  return new Uint8Array(digest);
}

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}

function validateIncomingPayload(body) {
  if (!body || typeof body !== "object") {
    throw new RequestValidationError("Body must be a JSON object.");
  }

  if (!body.date || !body.description_raw) {
    throw new RequestValidationError("date and description_raw are required.");
  }

  if (typeof body.amount !== "number" || Number.isNaN(body.amount)) {
    throw new RequestValidationError("amount must be a number.");
  }

  if (body.quantity !== undefined && (!Number.isInteger(body.quantity) || body.quantity < 1)) {
    throw new RequestValidationError("quantity must be a positive integer.");
  }
}

function validateIncomePayload(body) {
  if (!body || typeof body !== "object") {
    throw new RequestValidationError("Body must be a JSON object.");
  }

  if (!body.date || !body.source) {
    throw new RequestValidationError("date and source are required.");
  }

  if (typeof body.amount !== "number" || Number.isNaN(body.amount) || body.amount <= 0) {
    throw new RequestValidationError("amount must be a positive number.");
  }
}

function validateCryptoAssetPayload(body) {
  if (!body || typeof body !== "object") {
    throw new RequestValidationError("Body must be a JSON object.");
  }

  if (!body.name || !body.symbol || !body.coingecko_id) {
    throw new RequestValidationError("name, symbol, and coingecko_id are required.");
  }

  if (typeof body.amount_held !== "number" || Number.isNaN(body.amount_held) || body.amount_held <= 0) {
    throw new RequestValidationError("amount_held must be a positive number.");
  }

  if (typeof body.invested_amount !== "number" || Number.isNaN(body.invested_amount) || body.invested_amount < 0) {
    throw new RequestValidationError("invested_amount must be a non-negative number.");
  }
}

function validateRecurringExpensePayload(body) {
  if (!body || typeof body !== "object") {
    throw new RequestValidationError("Body must be a JSON object.");
  }

  if (!body.description_raw || !body.start_date) {
    throw new RequestValidationError("description_raw and start_date are required.");
  }

  if (typeof body.amount !== "number" || Number.isNaN(body.amount) || body.amount <= 0) {
    throw new RequestValidationError("amount must be a positive number.");
  }

  if (!["monthly", "weekly"].includes(String(body.frequency || "monthly"))) {
    throw new RequestValidationError("frequency must be monthly or weekly.");
  }
}

async function loadExpenses(env, authContext) {
  return loadJsonRecords(env, authContext, "expenses", "expenses:");
}

async function loadIncomes(env, authContext) {
  return loadJsonRecords(env, authContext, "incomes", "incomes:");
}

async function loadCryptoAssets(env, authContext) {
  return loadJsonRecords(env, authContext, "crypto_assets", "crypto_assets:");
}

async function loadRecurringExpenses(env, authContext) {
  return loadJsonRecords(env, authContext, "recurring_expenses", "recurring_expenses:");
}

async function loadJsonRecords(env, authContext, legacyKey, recordPrefix) {
  if (!env.EXPENSES_KV) {
    return [];
  }

  const merged = new Map();
  for (const item of await loadLegacyJsonArray(env, authContext, legacyKey)) {
    if (item?.id !== undefined) {
      merged.set(Number(item.id), item);
    }
  }

  const scopedRecordPrefix = getUserKeyPrefix(authContext, recordPrefix);
  let cursor;
  do {
    const listed = await env.EXPENSES_KV.list({ prefix: scopedRecordPrefix, cursor });
    for (const key of listed.keys) {
      const raw = await env.EXPENSES_KV.get(key.name);
      if (!raw) {
        continue;
      }

      try {
        const parsed = JSON.parse(raw);
        if (parsed?.id !== undefined) {
          merged.set(Number(parsed.id), parsed);
        }
      } catch {}
    }
    cursor = listed.list_complete ? undefined : listed.cursor;
  } while (cursor);

  return [...merged.values()];
}

async function loadLegacyJsonArray(env, authContext, key) {
  if (env.LEGACY_DATA_OWNER_TELEGRAM_ID && String(env.LEGACY_DATA_OWNER_TELEGRAM_ID) === authContext.userId) {
    return loadJsonArrayByKey(env, key);
  }

  return loadJsonArrayByKey(env, getUserKeyPrefix(authContext, key));
}

async function loadJsonArrayByKey(env, key) {
  const raw = await env.EXPENSES_KV.get(key);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveExpense(env, authContext, expense) {
  await putJsonRecord(env, authContext, "expenses:", expense);
}

async function saveIncome(env, authContext, income) {
  await putJsonRecord(env, authContext, "incomes:", income);
}

async function saveCryptoAsset(env, authContext, cryptoAsset) {
  await putJsonRecord(env, authContext, "crypto_assets:", cryptoAsset);
}

async function saveRecurringExpense(env, authContext, recurringExpense) {
  await putJsonRecord(env, authContext, "recurring_expenses:", recurringExpense);
}

async function deleteExpense(env, authContext, id) {
  await deleteJsonRecord(env, authContext, "expenses", "expenses:", id);
}

async function deleteIncome(env, authContext, id) {
  await deleteJsonRecord(env, authContext, "incomes", "incomes:", id);
}

async function deleteCryptoAsset(env, authContext, id) {
  await deleteJsonRecord(env, authContext, "crypto_assets", "crypto_assets:", id);
}

async function deleteRecurringExpense(env, authContext, id) {
  await deleteJsonRecord(env, authContext, "recurring_expenses", "recurring_expenses:", id);
}

async function putJsonRecord(env, authContext, prefix, value) {
  if (!env.EXPENSES_KV) {
    return;
  }

  await env.EXPENSES_KV.put(getUserKeyPrefix(authContext, `${prefix}${Number(value?.id)}`), JSON.stringify(value));
}

async function deleteJsonRecord(env, authContext, legacyKey, prefix, id) {
  if (!env.EXPENSES_KV) {
    return;
  }

  await env.EXPENSES_KV.delete(getUserKeyPrefix(authContext, `${prefix}${Number(id)}`));
  const legacyItems = await loadLegacyJsonArray(env, authContext, legacyKey);
  if (legacyItems.length) {
    const nextLegacyItems = legacyItems.filter((item) => Number(item?.id) !== Number(id));
    await env.EXPENSES_KV.put(getUserKeyPrefix(authContext, legacyKey), JSON.stringify(nextLegacyItems));
  }
}

async function clearJsonRecords(env, authContext, legacyKey, prefix) {
  if (!env.EXPENSES_KV) {
    return;
  }

  await env.EXPENSES_KV.put(getUserKeyPrefix(authContext, legacyKey), JSON.stringify([]));
  if (env.LEGACY_DATA_OWNER_TELEGRAM_ID && String(env.LEGACY_DATA_OWNER_TELEGRAM_ID) === authContext.userId) {
    await env.EXPENSES_KV.put(legacyKey, JSON.stringify([]));
  }

  const scopedPrefix = getUserKeyPrefix(authContext, prefix);
  let cursor;
  do {
    const listed = await env.EXPENSES_KV.list({ prefix: scopedPrefix, cursor });
    await Promise.all(listed.keys.map((key) => env.EXPENSES_KV.delete(key.name)));
    cursor = listed.list_complete ? undefined : listed.cursor;
  } while (cursor);
}

function getUserKeyPrefix(authContext, key) {
  return `users:${authContext.userId}:${key}`;
}

async function getNextExpenseId(env, authContext) {
  const expenses = await loadExpenses(env, authContext);
  const maxId = expenses.reduce((max, item) => {
    const numericId = Number(item.id) || 0;
    return Math.max(max, numericId);
  }, 0);

  return getNextRecordId(maxId);
}

async function getNextIncomeId(env, authContext) {
  const incomes = await loadIncomes(env, authContext);
  const maxId = incomes.reduce((max, item) => {
    const numericId = Number(item.id) || 0;
    return Math.max(max, numericId);
  }, 0);

  return getNextRecordId(maxId);
}

async function getNextCryptoAssetId(env, authContext) {
  const cryptoAssets = await loadCryptoAssets(env, authContext);
  const maxId = cryptoAssets.reduce((max, item) => {
    const numericId = Number(item.id) || 0;
    return Math.max(max, numericId);
  }, 0);

  return getNextRecordId(maxId);
}

async function getNextRecurringExpenseId(env, authContext) {
  const recurringExpenses = await loadRecurringExpenses(env, authContext);
  const maxId = recurringExpenses.reduce((max, item) => {
    const numericId = Number(item.id) || 0;
    return Math.max(max, numericId);
  }, 0);

  return getNextRecordId(maxId);
}

function getNextRecordId(maxId) {
  const timeId = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  return Math.max(maxId + 1, timeId);
}

async function normalizeExpenseWithOpenAI(payload, nextId, env, existingExpenses = []) {
  if (!env.OPENAI_API_KEY) {
    return fallbackNormalize(payload, nextId);
  }

  const systemPrompt = buildSystemPrompt();
  const prompt = buildNormalizationPrompt(payload, nextId, existingExpenses);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: systemPrompt,
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: prompt,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    console.error("OpenAI request failed", response.status, await response.text());
    return fallbackNormalize(payload, nextId);
  }

  const data = await response.json();
  const rawText = extractResponseText(data);

  if (!rawText) {
    return fallbackNormalize(payload, nextId);
  }

  try {
    return JSON.parse(rawText);
  } catch {
    return fallbackNormalize(payload, nextId);
  }
}

function extractResponseText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return cleanJsonText(data.output_text);
  }

  const outputs = Array.isArray(data?.output) ? data.output : [];
  for (const outputItem of outputs) {
    const contents = Array.isArray(outputItem?.content) ? outputItem.content : [];
    for (const contentItem of contents) {
      if (contentItem?.type === "output_text" && typeof contentItem.text === "string") {
        return cleanJsonText(contentItem.text);
      }
    }
  }

  return "";
}

function buildSystemPrompt() {
  return [
    "You normalize personal expense records into one strict JSON object.",
    "Return JSON only with no markdown and no explanation.",
    "Use exactly these fields: id, date, amount, quantity, currency, description_raw, product_name, category, sub_category, sub_sub_category, for_whom, notes, ai_hint.",
    "Do not add, remove, or rename fields.",
    "Keep amount as number, quantity as integer, and all other non-numeric values as strings.",
    "Allowed for_whom values only: myself, friend, girlfriend, family, pet, gift, loan, household, other.",
    "Interpret who benefited from the purchase:",
    "myself = for the user personally; friend = for a friend or other person; girlfriend = specifically for girlfriend, wife, or female partner; family = for parents or family members; pet = for a pet or animal; gift = bought as a gift; loan = money lent or debt-related; household = shared home/family expense; other = unclear.",
    "If beneficiary is not explicitly stated, default to myself.",
    "Use concise Russian category labels and infer them by meaning even if they were not seen before.",
    "Reuse existing category, sub_category, and sub_sub_category values from the provided catalog whenever they semantically fit.",
    "If no existing value fits, you may create a new one, but keep it short, natural, and specific.",
    "Use sub_category and sub_sub_category with increasing specificity when clear.",
    "If the text mentions chips/snacks/sweets/drinks, prefer category еда.",
    "If the text mentions coffee/tea/drinks, prefer category еда, sub_category напитки, and a specific sub_sub_category such as кофе.",
    "If the text mentions taxi/metro/bus/fuel, prefer category транспорт.",
    "If the text mentions a car purchase, prefer category транспорт with auto-related subcategories, not household.",
    "If the text mentions rent/utilities/cleaning/home goods, prefer category дом or household-related structure.",
    "If the text mentions subscription, подписка, premium, plus, pro, streaming, SaaS, paid app, or recurring service, prefer category подписки.",
    "Avoid using other for category fields unless the meaning is truly impossible to infer.",
    "Keep product_name short and useful.",
    "Use ai_hint as a strong steering hint when it is provided by the user.",
    "Prefer semantic consistency with the user's existing data over inventing unnecessary near-duplicate labels.",
    "If a suitable existing label does not exist, create a new short Russian label instead of falling back to other.",
    "Be decisive. For meaningful descriptions, category, sub_category, sub_sub_category, and for_whom should usually not remain other.",
  ].join(" ");
}

function buildNormalizationPrompt(payload, nextId, existingExpenses) {
  const catalogs = buildExistingCatalogs(existingExpenses);

  return [
    "Normalize the following expense into the exact JSON schema.",
    "Allowed for_whom values: myself, friend, girlfriend, family, pet, gift, loan, household, other.",
    "Do not add fields. Do not omit fields. Return valid JSON only.",
    "Infer category, sub_category, sub_sub_category, product_name, and for_whom from the raw description.",
    "If the description says the item is for self, use for_whom=myself.",
    "If the description says it is for a girlfriend, wife, or female partner, use for_whom=girlfriend.",
    "If the description says it is for mom, dad, parents, brother, sister, or family, use for_whom=family unless it is clearly a gift.",
    "If the description says it is for a pet, cat, dog, kitten, puppy, or animal, use for_whom=pet.",
    "If the description says it is for a named person, boyfriend, husband, or friend, use for_whom=friend unless it is clearly a gift.",
    "If it is a shared home expense, use for_whom=household.",
    "If there is no explicit beneficiary, use for_whom=myself.",
    "For coffee, tea, and drinks prefer sub_category=напитки and a specific sub_sub_category.",
    "For chips, cookies, sweets, and snacks prefer sub_category=вкусняшки.",
    "For car purchases or car expenses prefer category=транспорт, not дом.",
    "For subscriptions, paid apps, streaming, SaaS, or premium services prefer category=подписки.",
    "If quantity is not explicitly mentioned, set quantity=1.",
    "amount must be the total expense for the whole record, not the per-item price, so total amount = unit price multiplied by quantity.",
    "If ai_hint is present, follow it unless it conflicts with the fixed schema.",
    "When a matching value already exists in the catalog, reuse it.",
    "If nothing suitable exists in the catalog, create a new concise Russian label.",
    "Avoid returning other for category, sub_category, sub_sub_category, and for_whom when the description contains enough meaning to infer something better.",
    "",
    "Existing category catalog:",
    JSON.stringify(catalogs, null, 2),
    "",
    JSON.stringify(
      {
        id: nextId,
        date: payload.date,
        amount: calculateTotalAmount(payload.amount, payload.quantity || 1),
        quantity: payload.quantity || 1,
        currency: "UAH",
        description_raw: payload.description_raw,
        notes: payload.notes || "",
        ai_hint: payload.ai_hint || "",
      },
      null,
      2,
    ),
  ].join("\n");
}

function fallbackNormalize(payload, nextId) {
  const description = String(payload.description_raw || "").trim();
  const hint = String(payload.ai_hint || "").trim();
  const inferenceText = combineInferenceText(description, hint);
  const normalizedProduct = inferProductName(inferenceText);
  const inferredForWhom = inferForWhom(inferenceText);
  const inferredCategories = inferCategories(inferenceText);
  const quantity = normalizeQuantity(payload.quantity);

  return {
    id: nextId,
    date: payload.date,
    amount: calculateTotalAmount(payload.amount, quantity),
    quantity,
    currency: "UAH",
    description_raw: description,
    product_name: normalizedProduct,
    category: inferredCategories.category,
    sub_category: inferredCategories.sub_category,
    sub_sub_category: inferredCategories.sub_sub_category,
    for_whom: inferredForWhom,
    notes: String(payload.notes || ""),
    ai_hint: String(payload.ai_hint || ""),
  };
}

function sanitizeExpense(expense, nextId, payload) {
  const description = String(expense?.description_raw || payload.description_raw || "");
  const hint = String(expense?.ai_hint || payload.ai_hint || "");
  const inferenceText = combineInferenceText(description, hint);
  const inferredForWhom = inferForWhom(inferenceText);
  const inferredCategories = inferCategories(inferenceText);
  const inferredProductName = inferProductName(inferenceText);
  const quantity = normalizeQuantity(expense?.quantity ?? payload.quantity);
  const rawForWhom = String(expense?.for_whom || "").trim();
  const safeForWhom = ALLOWED_FOR_WHOM.has(rawForWhom) ? rawForWhom : inferredForWhom;
  const safeCategory = normalizeCategoryField(expense?.category, inferredCategories.category);
  const safeSubCategory = normalizeCategoryField(expense?.sub_category, inferredCategories.sub_category);
  const safeSubSubCategory = normalizeCategoryField(expense?.sub_sub_category, inferredCategories.sub_sub_category);
  const safeProductName = normalizeTextField(expense?.product_name, inferredProductName);
  const safeAmount = normalizeStoredAmount(expense?.amount, payload.amount, quantity);

  return {
    id: Number(expense?.id) || nextId,
    date: String(expense?.date || payload.date || ""),
    amount: safeAmount,
    quantity,
    currency: String(expense?.currency || "UAH"),
    description_raw: description,
    product_name: safeProductName,
    category: safeCategory,
    sub_category: safeSubCategory,
    sub_sub_category: safeSubSubCategory,
    for_whom: safeForWhom,
    notes: String(expense?.notes || payload.notes || ""),
    ai_hint: String(expense?.ai_hint || payload.ai_hint || ""),
  };
}

function sanitizeIncome(income, nextId) {
  return {
    id: Number(income?.id) || nextId,
    date: String(income?.date || ""),
    amount: Number((Number(income?.amount) || 0).toFixed(2)),
    currency: String(income?.currency || "UAH"),
    source: String(income?.source || "").trim(),
    notes: String(income?.notes || ""),
  };
}

function sanitizeCryptoAsset(cryptoAsset, nextId) {
  return {
    id: Number(cryptoAsset?.id) || nextId,
    name: String(cryptoAsset?.name || "").trim(),
    symbol: String(cryptoAsset?.symbol || "").trim().toUpperCase(),
    coingecko_id: String(cryptoAsset?.coingecko_id || "").trim().toLowerCase(),
    amount_held: Number((Number(cryptoAsset?.amount_held) || 0).toFixed(10)),
    invested_amount: Number((Number(cryptoAsset?.invested_amount) || 0).toFixed(2)),
    currency: String(cryptoAsset?.currency || "UAH"),
    notes: String(cryptoAsset?.notes || ""),
    updated_at: String(cryptoAsset?.updated_at || new Date().toISOString()),
  };
}

function sanitizeRecurringExpense(recurringExpense, nextId) {
  const frequency = String(recurringExpense?.frequency || "monthly").trim();

  return {
    id: Number(recurringExpense?.id) || nextId,
    start_date: String(recurringExpense?.start_date || ""),
    amount: Number((Number(recurringExpense?.amount) || 0).toFixed(2)),
    currency: String(recurringExpense?.currency || "UAH"),
    description_raw: String(recurringExpense?.description_raw || "").trim(),
    category: String(recurringExpense?.category || "подписки").trim(),
    sub_category: String(recurringExpense?.sub_category || "подписки").trim(),
    for_whom: ALLOWED_FOR_WHOM.has(String(recurringExpense?.for_whom || "")) ? String(recurringExpense?.for_whom) : "myself",
    frequency: frequency === "weekly" ? "weekly" : "monthly",
    notes: String(recurringExpense?.notes || ""),
    active: recurringExpense?.active !== false,
    last_materialized_at: String(recurringExpense?.last_materialized_at || ""),
  };
}

async function materializeRecurringExpenses(env, authContext, body) {
  const targetDate = String(body?.date || new Date().toISOString().slice(0, 10));
  const recurringExpenses = (await loadRecurringExpenses(env, authContext)).map((item) => sanitizeRecurringExpense(item, item?.id));
  const currentExpenses = await loadExpenses(env, authContext);
  let nextId = await getNextExpenseId(env, authContext);
  const generatedExpenses = [];
  const updatedRecurringExpenses = [];

  for (const recurringExpense of recurringExpenses) {
    if (!recurringExpense.active || !isRecurringDue(recurringExpense, targetDate)) {
      updatedRecurringExpenses.push(recurringExpense);
      continue;
    }

    const periodKey = getRecurringPeriodKey(recurringExpense.frequency, targetDate);
    const alreadyExists = currentExpenses.some((expense) => expense?.recurring_id === recurringExpense.id && expense?.recurring_period === periodKey);

    if (!alreadyExists) {
      const generatedExpense = sanitizeExpense(
        {
          id: nextId,
          date: targetDate,
          amount: recurringExpense.amount,
          quantity: 1,
          currency: recurringExpense.currency,
          description_raw: recurringExpense.description_raw,
          product_name: recurringExpense.description_raw,
          category: recurringExpense.category,
          sub_category: recurringExpense.sub_category,
          sub_sub_category: "подписка",
          for_whom: recurringExpense.for_whom,
          notes: recurringExpense.notes,
          ai_hint: "Автоматически создано из подписки",
          recurring_id: recurringExpense.id,
          recurring_period: periodKey,
        },
        nextId,
        {
          date: targetDate,
          amount: recurringExpense.amount,
          quantity: 1,
          description_raw: recurringExpense.description_raw,
          notes: recurringExpense.notes,
          ai_hint: "Автоматически создано из подписки",
        },
      );

      generatedExpense.recurring_id = recurringExpense.id;
      generatedExpense.recurring_period = periodKey;
      generatedExpenses.push(generatedExpense);
      currentExpenses.push(generatedExpense);
      nextId += 1;
    }

    updatedRecurringExpenses.push({
      ...recurringExpense,
      last_materialized_at: new Date().toISOString(),
    });
  }

  if (generatedExpenses.length) {
    await Promise.all(generatedExpenses.map((expense) => saveExpense(env, authContext, expense)));
  }
  await Promise.all(updatedRecurringExpenses.map((recurringExpense) => saveRecurringExpense(env, authContext, recurringExpense)));

  return generatedExpenses;
}

function isRecurringDue(recurringExpense, targetDate) {
  if (!recurringExpense.start_date || recurringExpense.start_date > targetDate) {
    return false;
  }

  return true;
}

function getRecurringPeriodKey(frequency, dateValue) {
  if (frequency === "weekly") {
    const date = new Date(`${dateValue}T00:00:00`);
    const start = new Date(date);
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
    return start.toISOString().slice(0, 10);
  }

  return String(dateValue).slice(0, 7);
}

function parseCryptoPriceIds(url) {
  const rawIds = String(url.searchParams.get("ids") || "");
  const ids = rawIds
    .split(",")
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean);

  if (!ids.length) {
    throw new RequestValidationError("ids query parameter is required.");
  }

  return [...new Set(ids)].slice(0, 50);
}

async function fetchCryptoPrices(ids, env) {
  const priceUrl = new URL("https://api.coingecko.com/api/v3/simple/price");
  priceUrl.searchParams.set("ids", ids.join(","));
  priceUrl.searchParams.set("vs_currencies", "uah,usd");
  priceUrl.searchParams.set("include_24hr_change", "true");
  priceUrl.searchParams.set("include_last_updated_at", "true");

  const headers = {};
  if (env.COINGECKO_API_KEY) {
    headers["x-cg-demo-api-key"] = env.COINGECKO_API_KEY;
  }

  const response = await fetch(priceUrl.toString(), { headers });

  if (!response.ok) {
    throw new Error(`Crypto price request failed with status ${response.status}.`);
  }

  return response.json();
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...DEFAULT_CORS_HEADERS,
    },
  });
}

function parsePathId(pathname, prefix) {
  const id = Number(String(pathname).slice(prefix.length));
  if (!Number.isInteger(id) || id < 1) {
    throw new RequestValidationError("Valid id is required.");
  }

  return id;
}

async function resetAllData(env, authContext) {
  await Promise.all([
    clearJsonRecords(env, authContext, "expenses", "expenses:"),
    clearJsonRecords(env, authContext, "incomes", "incomes:"),
    clearJsonRecords(env, authContext, "crypto_assets", "crypto_assets:"),
    clearJsonRecords(env, authContext, "recurring_expenses", "recurring_expenses:"),
  ]);
}

function cleanJsonText(value) {
  return String(value)
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

function inferProductName(description) {
  const cleanDescription = description
    .replace(/[.,!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleanDescription) {
    return "other";
  }

  const lowered = cleanDescription.toLowerCase();

  if (lowered.includes("чипс")) {
    return "чипсы";
  }

  if (lowered.includes("кофе")) {
    return "кофе";
  }

  if (lowered.includes("чай")) {
    return "чай";
  }

  if (lowered.includes("такси")) {
    return "такси";
  }

  if (lowered.includes("бенз")) {
    return "бензин";
  }

  if (/(автомоб|машин|тойота|toyota|bmw|mers|mercedes|audi|kia|hyundai)/i.test(lowered)) {
    return "автомобиль";
  }

  return cleanDescription.split(" ")[0];
}

function inferForWhom(description) {
  const lowered = description.toLowerCase();

  if (/(себе|для себя|myself)/i.test(lowered)) {
    return "myself";
  }

  if (/(подарок|на подарок)/i.test(lowered)) {
    return "gift";
  }

  if (/(в долг|одолжил|займ|loan)/i.test(lowered)) {
    return "loan";
  }

  if (/(домой|для дома|дом|семья|семье|коммунал|быт)/i.test(lowered)) {
    return "household";
  }

  if (/(кошк|кота|коту|котенк|котёнк|собак|псу|щенк|животн|питомц)/i.test(lowered)) {
    return "pet";
  }

  if (/(родител|маме|мама|бате|батя|папе|папа|матери|отцу|семье|семья|брату|сестре|сыну|дочк)/i.test(lowered)) {
    return "family";
  }

  if (/(девушк|жене|жена|любимой|любимая|невест|партнерш|партнёрш)/i.test(lowered)) {
    return "girlfriend";
  }

  if (/(парню|парень|мужу|муж|партнер|партнёр|насте|настя|марк|друг[ауе]?|подруг[аеу]?)/i.test(lowered)) {
    return "friend";
  }

  return "myself";
}

function inferCategories(description) {
  const lowered = description.toLowerCase();

  if (/(трус|белье|бельё|лиф|бюстгальтер|носк)/i.test(lowered)) {
    return {
      category: "одежда",
      sub_category: "белье",
      sub_sub_category: /(трус)/i.test(lowered) ? "трусы" : "другое",
    };
  }

  if (/(шапк).*(кошк|кота|кот|собак|псу|щенк)|((кошк|кота|кот|собак|псу|щенк).*(шапк))/i.test(lowered)) {
    return {
      category: "животные",
      sub_category: "одежда",
      sub_sub_category: "шапка",
    };
  }

  if (/(тапк|кроссов|ботин|туфл|сандал|обув)/i.test(lowered)) {
    return {
      category: "одежда",
      sub_category: "обувь",
      sub_sub_category: /(тапк)/i.test(lowered) ? "тапки" : "другое",
    };
  }

  if (/(коляск|самокат|велосипед|игрушк|детск)/i.test(lowered)) {
    return {
      category: "дети",
      sub_category: /(игрушк)/i.test(lowered) ? "игрушки" : "товары для детей",
      sub_sub_category: /(коляск)/i.test(lowered) ? "коляска" : "другое",
    };
  }

  if (/(собак|корм|кот|кошк|ветеринар|наполнитель)/i.test(lowered)) {
    return {
      category: "животные",
      sub_category: /(ветеринар)/i.test(lowered) ? "ветеринария" : "уход",
      sub_sub_category: /(корм)/i.test(lowered) ? "корм" : "другое",
    };
  }

  if (/(кофе|чай|латте|капучино|эспрессо|американо|какао|сок|кола|напит)/i.test(lowered)) {
    return {
      category: "еда",
      sub_category: "напитки",
      sub_sub_category: lowered.includes("чай") ? "чай" : "кофе",
    };
  }

  if (/(чипс|снек|печень|конфет|шоколад|принглс|батончик|вкусняш)/i.test(lowered)) {
    return {
      category: "еда",
      sub_category: "вкусняшки",
      sub_sub_category: /(чипс|принглс)/i.test(lowered) ? "чипсы" : "другое",
    };
  }

  if (/(еда|обед|ужин|завтрак|пицц|суши|бургер|кафе|ресторан|доставка)/i.test(lowered)) {
    return {
      category: "еда",
      sub_category: "готовая еда",
      sub_sub_category: /(пицц)/i.test(lowered)
        ? "пицца"
        : /(суши)/i.test(lowered)
          ? "суши"
          : "другое",
    };
  }

  if (/(автомоб|машин|тойота|toyota|bmw|mers|mercedes|audi|kia|hyundai)/i.test(lowered)) {
    return {
      category: "транспорт",
      sub_category: "автомобиль",
      sub_sub_category: "покупка авто",
    };
  }

  if (/(такси|метро|автобус|транспорт|бенз|заправк)/i.test(lowered)) {
    return {
      category: "транспорт",
      sub_category: /(бенз|заправк)/i.test(lowered) ? "топливо" : "поездки",
      sub_sub_category: /(такси)/i.test(lowered) ? "такси" : "другое",
    };
  }

  if (/(аренда|квартир|коммунал|дом|уборк|порошок|быт)/i.test(lowered)) {
    return {
      category: "дом",
      sub_category: "быт",
      sub_sub_category: "другое",
    };
  }

  if (/(аптек|лекар|врач|анализ)/i.test(lowered)) {
    return {
      category: "здоровье",
      sub_category: "лечение",
      sub_sub_category: "другое",
    };
  }

  return {
    category: "other",
    sub_category: "other",
    sub_sub_category: "other",
  };
}

function normalizeCategoryField(value, fallbackValue) {
  const normalized = String(value || "").trim();

  if (!normalized || normalized.toLowerCase() === "other") {
    return fallbackValue;
  }

  return normalized;
}

function normalizeTextField(value, fallbackValue) {
  const normalized = String(value || "").trim();
  return normalized || fallbackValue;
}

function normalizeQuantity(value) {
  return Math.max(1, Math.trunc(Number(value) || 1));
}

function normalizeStoredAmount(expenseAmount, payloadAmount, quantity) {
  if (expenseAmount !== undefined && expenseAmount !== null) {
    return Number((Number(expenseAmount) || 0).toFixed(2));
  }

  return calculateTotalAmount(payloadAmount, quantity);
}

function calculateTotalAmount(amount, quantity) {
  const unitAmount = Number(amount) || 0;
  const safeQuantity = normalizeQuantity(quantity);
  return Number((unitAmount * safeQuantity).toFixed(2));
}

function combineInferenceText(description, hint) {
  return `${description} ${hint}`.trim();
}

function buildExistingCatalogs(expenses) {
  return {
    category: uniqueNonEmpty(expenses.map((expense) => expense.category)).filter((value) => value !== "other"),
    sub_category: uniqueNonEmpty(expenses.map((expense) => expense.sub_category)).filter((value) => value !== "other"),
    sub_sub_category: uniqueNonEmpty(expenses.map((expense) => expense.sub_sub_category)).filter((value) => value !== "other"),
    for_whom: uniqueNonEmpty(expenses.map((expense) => expense.for_whom)).filter((value) => value !== "other"),
  };
}

function uniqueNonEmpty(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))].sort();
}

function buildNormalizationDecision(expense, existingExpenses) {
  const catalogs = buildExistingCatalogs(existingExpenses);
  const fields = [
    { key: "category", label: "Категория", value: expense.category },
    { key: "sub_category", label: "Подкатегория", value: expense.sub_category },
    { key: "for_whom", label: "Для кого", value: expense.for_whom },
  ];

  const details = fields.map(({ key, label, value }) => {
    const normalizedValue = String(value || "").trim();
    const catalogValues = catalogs[key] || [];
    const exists = normalizedValue && catalogValues.includes(normalizedValue);

    if (!normalizedValue || normalizedValue === "other") {
      return {
        field: key,
        label,
        value: normalizedValue || "other",
        action: "fallback",
        message: `${label}: оставил "Другое"`,
      };
    }

    if (exists) {
      return {
        field: key,
        label,
        value: normalizedValue,
        action: "reused",
        message: `${label}: добавляю в существующее "${formatDecisionValue(key, normalizedValue)}"`,
      };
    }

    return {
      field: key,
      label,
      value: normalizedValue,
      action: "created",
      message: `${label}: создаю новое "${formatDecisionValue(key, normalizedValue)}"`,
    };
  });

  return {
    summary: details.map((detail) => detail.message).join(". "),
    details,
  };
}

function formatDecisionValue(field, value) {
  if (field === "for_whom") {
    return formatForWhomDecisionLabel(value);
  }

  return value === "other" ? "Другое" : value;
}

function formatForWhomDecisionLabel(value) {
  const labels = {
    myself: "Я",
    friend: "Друзья",
    girlfriend: "Девушка",
    family: "Семья",
    pet: "Животные",
    gift: "Подарок",
    loan: "Долг",
    household: "Дом",
    other: "Другое",
  };

  return labels[value] || value;
}
