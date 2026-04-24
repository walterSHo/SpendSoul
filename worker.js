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
              text: "Normalize expense data strictly into the required JSON schema. Return JSON only.",
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
    return data.output_text.trim();
  }

  const outputs = Array.isArray(data?.output) ? data.output : [];
  for (const outputItem of outputs) {
    const contents = Array.isArray(outputItem?.content) ? outputItem.content : [];
    for (const contentItem of contents) {
      if (contentItem?.type === "output_text" && typeof contentItem.text === "string") {
        return contentItem.text.trim();
      }
    }
  }

  return "";
}

function buildNormalizationPrompt(payload, nextId) {
  return [
    "Normalize the following expense into the exact JSON schema.",
    "Allowed for_whom values: myself, friend, gift, loan, household, other.",
    "Do not add fields. Do not omit fields. Return valid JSON only.",
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
  const normalizedProduct = description.split(" ")[0] || "other";

  return {
    id: nextId,
    date: payload.date,
    amount: payload.amount,
    currency: "UAH",
    description_raw: description,
    product_name: normalizedProduct,
    category: "other",
    sub_category: "other",
    sub_sub_category: "other",
    for_whom: "other",
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
