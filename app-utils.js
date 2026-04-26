export const ALLOWED_FOR_WHOM = new Set([
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

export const FOR_WHOM_LABELS = {
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

export const SUPPORTED_CURRENCIES = new Set(["UAH", "USD", "EUR", "PLN", "RUB"]);

export const CURRENCY_LABELS = {
  UAH: "UAH · гривна",
  USD: "USD · доллар",
  EUR: "EUR · евро",
  PLN: "PLN · злотый",
  RUB: "RUB · рубль",
};

export function sanitizeExpense(expense) {
  const safeExpense = expense || {};

  return {
    id: Number(safeExpense.id) || Date.now(),
    date: String(safeExpense.date || ""),
    amount: Number(safeExpense.amount) || 0,
    quantity: normalizeQuantityValue(safeExpense.quantity),
    currency: normalizeCurrency(safeExpense.currency),
    description_raw: String(safeExpense.description_raw || ""),
    product_name: String(safeExpense.product_name || ""),
    category: String(safeExpense.category || "other"),
    sub_category: String(safeExpense.sub_category || "other"),
    sub_sub_category: String(safeExpense.sub_sub_category || "other"),
    for_whom: ALLOWED_FOR_WHOM.has(safeExpense.for_whom) ? safeExpense.for_whom : "other",
    notes: String(safeExpense.notes || ""),
    ai_hint: String(safeExpense.ai_hint || ""),
  };
}

export function sanitizeIncome(income) {
  const safeIncome = income || {};

  return {
    id: Number(safeIncome.id) || Date.now(),
    date: String(safeIncome.date || ""),
    amount: Number(safeIncome.amount) || 0,
    currency: normalizeCurrency(safeIncome.currency),
    source: String(safeIncome.source || ""),
    notes: String(safeIncome.notes || ""),
  };
}

export function sanitizeCryptoAsset(cryptoAsset) {
  const safeCryptoAsset = cryptoAsset || {};

  return {
    id: Number(safeCryptoAsset.id) || Date.now(),
    name: String(safeCryptoAsset.name || ""),
    symbol: String(safeCryptoAsset.symbol || "").toUpperCase(),
    coingecko_id: String(safeCryptoAsset.coingecko_id || "").toLowerCase(),
    amount_held: Number(safeCryptoAsset.amount_held) || 0,
    invested_amount: Number(safeCryptoAsset.invested_amount) || 0,
    currency: normalizeCurrency(safeCryptoAsset.currency),
    notes: String(safeCryptoAsset.notes || ""),
    updated_at: String(safeCryptoAsset.updated_at || ""),
  };
}

export function sanitizeRecurringExpense(recurringExpense) {
  const safeRecurringExpense = recurringExpense || {};
  const frequency = String(safeRecurringExpense.frequency || "monthly");

  return {
    id: Number(safeRecurringExpense.id) || Date.now(),
    start_date: String(safeRecurringExpense.start_date || new Date().toISOString().slice(0, 10)),
    amount: Number((Number(safeRecurringExpense.amount) || 0).toFixed(2)),
    currency: normalizeCurrency(safeRecurringExpense.currency),
    description_raw: String(safeRecurringExpense.description_raw || "").trim(),
    category: String(safeRecurringExpense.category || "подписки").trim(),
    sub_category: String(safeRecurringExpense.sub_category || "подписки").trim(),
    for_whom: ALLOWED_FOR_WHOM.has(String(safeRecurringExpense.for_whom || "")) ? String(safeRecurringExpense.for_whom) : "myself",
    frequency: frequency === "weekly" ? "weekly" : "monthly",
    notes: String(safeRecurringExpense.notes || ""),
    active: safeRecurringExpense.active !== false,
    last_materialized_at: String(safeRecurringExpense.last_materialized_at || ""),
  };
}

export function sanitizeDecision(decision) {
  const details = Array.isArray(decision?.details)
    ? decision.details.map((item) => ({
        field: String(item?.field || ""),
        label: String(item?.label || ""),
        value: String(item?.value || ""),
        action: String(item?.action || "fallback"),
        message: String(item?.message || ""),
      }))
    : [];

  return {
    summary: String(decision?.summary || "ИИ определил категорию и получателя для этой траты."),
    details,
  };
}

export function normalizeCurrency(value, fallbackValue = "UAH") {
  const normalized = String(value || "").trim().toUpperCase();
  const fallback = String(fallbackValue || "UAH").trim().toUpperCase();
  if (SUPPORTED_CURRENCIES.has(normalized)) {
    return normalized;
  }

  return SUPPORTED_CURRENCIES.has(fallback) ? fallback : "UAH";
}

export function formatForWhomLabel(value) {
  return FOR_WHOM_LABELS[value] || "Другое";
}

export function formatCategoryLabel(value) {
  if (!value || value === "other") {
    return "Другое";
  }

  return toDisplayCase(value);
}

export function toDisplayCase(value) {
  const normalized = String(value || "").trim();

  if (!normalized) {
    return "";
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function normalizeQuantityValue(value) {
  return Math.max(1, Math.trunc(Number(value) || 1));
}

export function shortenText(value, maxLength) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}…`;
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
