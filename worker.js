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

      if (request.method === "POST" && url.pathname === "/api/normalize-expense") {
        const body = await request.json();
        validateIncomingPayload(body);

        const nextId = await getNextExpenseId(env);
        const existingExpenses = await loadExpenses(env);
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
        const nextId = Number(body?.id) || (await getNextExpenseId(env));
        const sanitizedExpense = sanitizeExpense(body, nextId, body);

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

  if (body.quantity !== undefined && (!Number.isInteger(body.quantity) || body.quantity < 1)) {
    throw new Error("quantity must be a positive integer.");
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
  const nextExpenses = currentExpenses.filter((item) => Number(item?.id) !== Number(expense?.id));
  nextExpenses.push(expense);
  await env.EXPENSES_KV.put("expenses", JSON.stringify(nextExpenses));
}

async function getNextExpenseId(env) {
  const expenses = await loadExpenses(env);
  const maxId = expenses.reduce((max, item) => {
    const numericId = Number(item.id) || 0;
    return Math.max(max, numericId);
  }, 0);

  return maxId + 1;
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

  return {
    id: Number(expense?.id) || nextId,
    date: String(expense?.date || payload.date || ""),
    amount: calculateTotalAmount(expense?.amount ?? payload.amount ?? 0, quantity),
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
  return Math.max(1, Number(value) || 1);
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
