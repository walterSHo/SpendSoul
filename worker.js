const ALLOWED_FOR_WHOM = new Set([
  "myself",
  "friend",
  "gift",
  "loan",
  "household",
  "other",
]);

const DEFAULT_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

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
      if (request.method === "GET" && url.pathname === "/api/expenses") {
        const expenses = await loadExpenses(env);
        return jsonResponse(expenses);
      }

      if (request.method === "POST" && url.pathname === "/api/add-expense") {
        const body = await request.json();
        validateIncomingPayload(body);

        const nextId = await getNextExpenseId(env);
        const normalizedExpense = await normalizeExpenseWithOpenAI(body, nextId, env);
        const sanitizedExpense = sanitizeExpense(normalizedExpense, nextId, body);

        await saveExpense(env, sanitizedExpense);
        return jsonResponse(sanitizedExpense, 201);
      }

      return jsonResponse({ error: "Not found" }, 404);
    } catch (error) {
      return jsonResponse(
        {
          error: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  },
};

function validateIncomingPayload(body) {
  if (!body || typeof body !== "object") {
    throw new Error("Body must be a JSON object.");
  }

  if (!body.date || !body.description_raw) {
    throw new Error("date and description_raw are required.");
  }

  if (typeof body.amount !== "number" || Number.isNaN(body.amount)) {
    throw new Error("amount must be a number.");
  }
}

async function loadExpenses(env) {
  if (!env.EXPENSES_KV) {
    return [];
  }

  const raw = await env.EXPENSES_KV.get("expenses");
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

async function saveExpense(env, expense) {
  if (!env.EXPENSES_KV) {
    return;
  }

  const currentExpenses = await loadExpenses(env);
  currentExpenses.push(expense);
  await env.EXPENSES_KV.put("expenses", JSON.stringify(currentExpenses));
}

async function getNextExpenseId(env) {
  const expenses = await loadExpenses(env);
  const maxId = expenses.reduce((max, item) => {
    const numericId = Number(item.id) || 0;
    return Math.max(max, numericId);
  }, 0);

  return maxId + 1;
}

async function normalizeExpenseWithOpenAI(payload, nextId, env) {
  if (!env.OPENAI_API_KEY) {
    return fallbackNormalize(payload, nextId);
  }

  const systemPrompt = buildSystemPrompt();
  const prompt = buildNormalizationPrompt(payload, nextId);
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
    "Use exactly these fields: id, date, amount, currency, description_raw, product_name, category, sub_category, sub_sub_category, for_whom, notes.",
    "Do not add, remove, or rename fields.",
    "Keep amount as number and all other non-numeric values as strings.",
    "Allowed for_whom values only: myself, friend, gift, loan, household, other.",
    "Interpret who benefited from the purchase:",
    "myself = for the user personally; friend = for a friend; gift = bought as a gift; loan = money lent or debt-related; household = shared home/family expense; other = unclear.",
    "Use specific Russian or Ukrainian category labels when clear, for example: еда, транспорт, дом, здоровье, подарки, развлечения, покупки, дети, животные, подписки, техника, кафе.",
    "Use sub_category and sub_sub_category with increasing specificity when clear.",
    "If the text mentions chips/snacks/sweets/drinks, prefer category еда.",
    "If the text mentions taxi/metro/bus/fuel, prefer category транспорт.",
    "If the text mentions rent/utilities/cleaning/home goods, prefer category дом or household-related structure.",
    "If unsure, keep category values as other but still infer product_name and for_whom as best as possible.",
  ].join(" ");
}

function buildNormalizationPrompt(payload, nextId) {
  return [
    "Normalize the following expense into the exact JSON schema.",
    "Allowed for_whom values: myself, friend, gift, loan, household, other.",
    "Do not add fields. Do not omit fields. Return valid JSON only.",
    "Infer category, sub_category, sub_sub_category, product_name, and for_whom from the raw description.",
    "If the description says the item is for self, use for_whom=myself.",
    "If the description says it is for a named person/friend, use for_whom=friend unless it is clearly a gift.",
    "If it is a shared home expense, use for_whom=household.",
    "",
    JSON.stringify(
      {
        id: nextId,
        date: payload.date,
        amount: payload.amount,
        currency: "UAH",
        description_raw: payload.description_raw,
      },
      null,
      2,
    ),
  ].join("\n");
}

function fallbackNormalize(payload, nextId) {
  const description = String(payload.description_raw || "").trim();
  const normalizedProduct = inferProductName(description);
  const inferredForWhom = inferForWhom(description);
  const inferredCategories = inferCategories(description);

  return {
    id: nextId,
    date: payload.date,
    amount: payload.amount,
    currency: "UAH",
    description_raw: description,
    product_name: normalizedProduct,
    category: inferredCategories.category,
    sub_category: inferredCategories.sub_category,
    sub_sub_category: inferredCategories.sub_sub_category,
    for_whom: inferredForWhom,
    notes: "",
  };
}

function sanitizeExpense(expense, nextId, payload) {
  const safeForWhom = ALLOWED_FOR_WHOM.has(expense?.for_whom) ? expense.for_whom : "other";

  return {
    id: Number(expense?.id) || nextId,
    date: String(expense?.date || payload.date || ""),
    amount: Number(expense?.amount ?? payload.amount ?? 0),
    currency: String(expense?.currency || "UAH"),
    description_raw: String(expense?.description_raw || payload.description_raw || ""),
    product_name: String(expense?.product_name || ""),
    category: String(expense?.category || "other"),
    sub_category: String(expense?.sub_category || "other"),
    sub_sub_category: String(expense?.sub_sub_category || "other"),
    for_whom: safeForWhom,
    notes: String(expense?.notes || ""),
  };
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

  if (lowered.includes("такси")) {
    return "такси";
  }

  if (lowered.includes("бенз")) {
    return "бензин";
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

  if (/(для марк|для друга|другу|подруге|маме|папе|брату|сестре)/i.test(lowered)) {
    return "friend";
  }

  return "other";
}

function inferCategories(description) {
  const lowered = description.toLowerCase();

  if (/(чипс|снек|печень|конфет|шоколад|принглс|еда|обед|ужин|завтрак|кофе|чай|пицц|суши)/i.test(lowered)) {
    return {
      category: "еда",
      sub_category: "вкусняшки",
      sub_sub_category: /(чипс|принглс)/i.test(lowered) ? "чипсы" : "другое",
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
