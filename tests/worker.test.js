import test from "node:test";
import assert from "node:assert/strict";
import worker, { __workerTestables } from "../worker.js";

class FakeKV {
  constructor() {
    this.records = new Map();
  }

  async get(key) {
    return this.records.get(key) || null;
  }

  async put(key, value) {
    this.records.set(key, String(value));
  }

  async delete(key) {
    this.records.delete(key);
  }

  async list({ prefix = "" } = {}) {
    return {
      keys: [...this.records.keys()].filter((name) => name.startsWith(prefix)).map((name) => ({ name })),
      list_complete: true,
    };
  }
}

function buildEnv(userId, kv = new FakeKV()) {
  return {
    DEV_TELEGRAM_USER_ID: String(userId),
    EXPENSES_KV: kv,
  };
}

async function readJson(response) {
  return response.json();
}

test("sanitizeExpense preserves strict expense schema and trusts normalized total amount", () => {
  const expense = __workerTestables.sanitizeExpense(
    {
      date: "2026-04-26",
      amount: 12.5,
      quantity: 3,
      description_raw: "кофе для себя",
      for_whom: "alien",
    },
    42,
    {
      date: "2026-04-26",
      amount: 12.5,
      quantity: 3,
      description_raw: "кофе для себя",
    },
  );

  assert.deepEqual(Object.keys(expense), [
    "id",
    "date",
    "amount",
    "quantity",
    "currency",
    "description_raw",
    "product_name",
    "category",
    "sub_category",
    "sub_sub_category",
    "for_whom",
    "notes",
    "ai_hint",
  ]);
  assert.equal(expense.id, 42);
  assert.equal(expense.amount, 12.5);
  assert.equal(expense.quantity, 3);
  assert.equal(expense.currency, "UAH");
  assert.equal(expense.product_name, "кофе");
  assert.equal(expense.category, "еда");
  assert.equal(expense.sub_category, "напитки");
  assert.equal(expense.for_whom, "myself");
});

test("calculateTotalAmount multiplies unit amount by quantity for input payloads", () => {
  assert.equal(__workerTestables.calculateTotalAmount(12.5, 3), 37.5);
});

test("fallbackNormalize infers beneficiary and category from description plus AI hint", () => {
  const expense = __workerTestables.fallbackNormalize(
    {
      date: "2026-04-26",
      amount: 100,
      quantity: 2,
      description_raw: "чипсы",
      ai_hint: "для Марка",
      notes: "две пачки",
    },
    7,
  );

  assert.equal(expense.id, 7);
  assert.equal(expense.amount, 200);
  assert.equal(expense.category, "еда");
  assert.equal(expense.sub_category, "вкусняшки");
  assert.equal(expense.sub_sub_category, "чипсы");
  assert.equal(expense.for_whom, "friend");
});

test("recurring period keys are stable for monthly and weekly expenses", () => {
  assert.equal(__workerTestables.getRecurringPeriodKey("monthly", "2026-04-26"), "2026-04");
  assert.equal(__workerTestables.getRecurringPeriodKey("weekly", "2026-04-26"), "2026-04-20");
  assert.equal(
    __workerTestables.isRecurringDue({ start_date: "2026-04-01" }, "2026-04-26"),
    true,
  );
  assert.equal(
    __workerTestables.isRecurringDue({ start_date: "2026-05-01" }, "2026-04-26"),
    false,
  );
});

test("worker stores records under separate Telegram user KV prefixes", async () => {
  const kv = new FakeKV();
  const userOneEnv = buildEnv(1001, kv);
  const userTwoEnv = buildEnv(2002, kv);
  const payload = {
    id: 1,
    date: "2026-04-26",
    amount: 50,
    quantity: 1,
    description_raw: "такси",
  };

  const addResponse = await worker.fetch(
    new Request("https://spendsoul.test/api/add-expense", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
    userOneEnv,
  );
  assert.equal(addResponse.status, 201);

  const userOneExpenses = await readJson(await worker.fetch(new Request("https://spendsoul.test/api/expenses"), userOneEnv));
  const userTwoExpenses = await readJson(await worker.fetch(new Request("https://spendsoul.test/api/expenses"), userTwoEnv));

  assert.equal(userOneExpenses.length, 1);
  assert.equal(userOneExpenses[0].description_raw, "такси");
  assert.deepEqual(userTwoExpenses, []);
  assert.ok(kv.records.has("users:1001:expenses:1"));
  assert.equal(kv.records.has("users:2002:expenses:1"), false);
});

test("settings endpoint sanitizes and scopes user preferences", async () => {
  const kv = new FakeKV();
  const env = buildEnv(3003, kv);
  const saveResponse = await worker.fetch(
    new Request("https://spendsoul.test/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        daily_limit: "700",
        monthly_limit: "21000",
        default_currency: "usd",
        display_currency: "eur",
        category_catalog: ["Еда", "еда", " транспорт ", ""],
      }),
    }),
    env,
  );

  assert.equal(saveResponse.status, 200);
  assert.deepEqual(await saveResponse.json(), {
    daily_limit: 700,
    monthly_limit: 21000,
    default_currency: "USD",
    display_currency: "EUR",
    category_catalog: ["еда", "транспорт"],
  });

  const loadResponse = await worker.fetch(new Request("https://spendsoul.test/api/settings"), env);
  assert.deepEqual(await loadResponse.json(), {
    daily_limit: 700,
    monthly_limit: 21000,
    default_currency: "USD",
    display_currency: "EUR",
    category_catalog: ["еда", "транспорт"],
  });
  assert.ok(kv.records.has("users:3003:settings"));
});

test("reset-history clears only the authorized user's records and preserves settings", async () => {
  const kv = new FakeKV();
  const env = buildEnv(5005, kv);
  const otherEnv = buildEnv(6006, kv);

  await worker.fetch(
    new Request("https://spendsoul.test/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        daily_limit: 700,
        category_catalog: ["еда", "транспорт"],
      }),
    }),
    env,
  );
  await worker.fetch(
    new Request("https://spendsoul.test/api/add-expense", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: 1,
        date: "2026-04-26",
        amount: 80,
        quantity: 1,
        description_raw: "кофе",
      }),
    }),
    env,
  );
  await worker.fetch(
    new Request("https://spendsoul.test/api/add-expense", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: 1,
        date: "2026-04-26",
        amount: 50,
        quantity: 1,
        description_raw: "такси",
      }),
    }),
    otherEnv,
  );

  const resetResponse = await worker.fetch(
    new Request("https://spendsoul.test/api/reset-history", { method: "POST" }),
    env,
  );
  assert.equal(resetResponse.status, 200);

  assert.deepEqual(await readJson(await worker.fetch(new Request("https://spendsoul.test/api/expenses"), env)), []);
  assert.equal((await readJson(await worker.fetch(new Request("https://spendsoul.test/api/expenses"), otherEnv))).length, 1);
  assert.deepEqual(await readJson(await worker.fetch(new Request("https://spendsoul.test/api/settings"), env)), {
    daily_limit: 700,
    monthly_limit: 0,
    default_currency: "UAH",
    display_currency: "USD",
    category_catalog: ["еда", "транспорт"],
  });
});

test("health endpoint exposes supported API features without auth", async () => {
  const response = await worker.fetch(new Request("https://spendsoul.test/api/health"), {});
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.ok(data.features.includes("exchange-rates"));
  assert.ok(data.features.includes("multi-currency"));
});

test("Telegram quick text parser extracts amount and description", () => {
  const payload = __workerTestables.parseQuickExpenseText("такси домой 240 грн");
  assert.equal(payload.amount, 240);
  assert.equal(payload.currency, "UAH");
  assert.equal(payload.quantity, 1);
  assert.equal(payload.description_raw, "такси домой");
});

test("Telegram quick text parser detects explicit dollars", () => {
  const payload = __workerTestables.parseQuickExpenseText("figma 15$ подписка");
  assert.equal(payload.amount, 15);
  assert.equal(payload.currency, "USD");
});

test("Telegram quick text parser detects explicit rubles", () => {
  const payload = __workerTestables.parseQuickExpenseText("кофе 300₽");
  assert.equal(payload.amount, 300);
  assert.equal(payload.currency, "RUB");
});

test("Telegram expense message waits for inline confirmation before saving", async () => {
  const kv = new FakeKV();
  const env = buildEnv(4004, kv);
  const messageUpdate = {
    message: {
      message_id: 10,
      text: "кофе 80",
      chat: { id: 4004 },
      from: { id: 4004, first_name: "Max" },
    },
  };

  const messageResponse = await worker.fetch(
    new Request("https://spendsoul.test/telegram-webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(messageUpdate),
    }),
    env,
  );
  assert.equal(messageResponse.status, 200);
  assert.deepEqual(await readJson(await worker.fetch(new Request("https://spendsoul.test/api/expenses"), env)), []);

  const pendingKey = [...kv.records.keys()].find((key) => key.startsWith("telegram_expense_confirm:"));
  assert.ok(pendingKey);
  const nonce = pendingKey.replace("telegram_expense_confirm:", "");

  const confirmResponse = await worker.fetch(
    new Request("https://spendsoul.test/telegram-webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query: {
          id: "callback-1",
          data: `expense:yes:${nonce}`,
          from: { id: 4004, first_name: "Max" },
          message: {
            message_id: 11,
            chat: { id: 4004 },
          },
        },
      }),
    }),
    env,
  );
  assert.equal(confirmResponse.status, 200);

  const expenses = await readJson(await worker.fetch(new Request("https://spendsoul.test/api/expenses"), env));
  assert.equal(expenses.length, 1);
  assert.equal(expenses[0].description_raw, "кофе");
  assert.equal(kv.records.has(pendingKey), false);
});

test("recent learning examples preserve user-corrected taxonomy for AI prompts", () => {
  const examples = __workerTestables.buildRecentLearningExamples([
    {
      id: 1,
      description_raw: "чатгпт подписка",
      product_name: "chatgpt",
      category: "подписки",
      sub_category: "ai-сервисы",
      sub_sub_category: "chatgpt",
      for_whom: "myself",
    },
  ]);

  assert.deepEqual(examples, [
    {
      description_raw: "чатгпт подписка",
      product_name: "chatgpt",
      category: "подписки",
      sub_category: "ai-сервисы",
      sub_sub_category: "chatgpt",
      for_whom: "myself",
    },
  ]);
});
