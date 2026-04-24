const STORAGE_KEY = "spendsoul-expenses";
const WORKER_BASE_URL = "https://spendsoul-api.waltershcroder.workers.dev";
const ALLOWED_FOR_WHOM = new Set([
  "myself",
  "friend",
  "girlfriend",
  "gift",
  "loan",
  "household",
  "other",
]);
const FOR_WHOM_LABELS = {
  myself: "Я",
  friend: "Друзья",
  girlfriend: "Девушка",
  gift: "Подарок",
  loan: "Долг",
  household: "Дом",
  other: "Другое",
};

const form = document.querySelector("#expenseForm");
const dateInput = document.querySelector("#date");
const amountInput = document.querySelector("#amount");
const quantityInput = document.querySelector("#quantity");
const descriptionInput = document.querySelector("#description_raw");
const notesInput = document.querySelector("#notes");
const submitButton = document.querySelector("#submitButton");
const clearLocalButton = document.querySelector("#clearLocalButton");
const statusMessage = document.querySelector("#statusMessage");
const tableBody = document.querySelector("#expensesTableBody");
const totalAmountNode = document.querySelector("#totalAmount");
const expenseCountNode = document.querySelector("#expenseCount");
const categoryFilter = document.querySelector("#categoryFilter");
const forWhomFilter = document.querySelector("#forWhomFilter");
const dateFromFilter = document.querySelector("#dateFromFilter");
const dateToFilter = document.querySelector("#dateToFilter");

let categoryChart;
let forWhomChart;
let timelineChart;
let expenses = loadExpenses();
let filteredExpenses = [...expenses];

dateInput.value = new Date().toISOString().slice(0, 10);
syncExpensesOnLoad();
render();

form.addEventListener("submit", handleSubmit);
clearLocalButton.addEventListener("click", handleClearLocalStorage);
categoryFilter.addEventListener("change", handleFiltersChange);
forWhomFilter.addEventListener("change", handleFiltersChange);
dateFromFilter.addEventListener("change", handleFiltersChange);
dateToFilter.addEventListener("change", handleFiltersChange);

async function handleSubmit(event) {
  event.preventDefault();

  const payload = {
    date: dateInput.value,
    amount: Number(amountInput.value),
    description_raw: descriptionInput.value.trim(),
    quantity: Number(quantityInput.value || 1),
    notes: notesInput.value.trim(),
  };

  if (
    !payload.date ||
    !payload.description_raw ||
    Number.isNaN(payload.amount) ||
    Number.isNaN(payload.quantity) ||
    payload.quantity < 1
  ) {
    setStatus("Заполните дату, сумму, количество и описание.", true);
    return;
  }

  setLoading(true);
  setStatus("Сохраняю и нормализую трату...");

  try {
    const normalizedExpense = await createExpense(payload);
    expenses = upsertExpense(expenses, normalizedExpense);
    persistExpenses(expenses);
    syncFilterOptions();
    render();
    form.reset();
    dateInput.value = new Date().toISOString().slice(0, 10);
    quantityInput.value = "1";
    setStatus("Трата сохранена.");
  } catch (error) {
    setStatus(error.message || "Не удалось сохранить трату.", true);
  } finally {
    setLoading(false);
  }
}

function handleClearLocalStorage() {
  localStorage.removeItem(STORAGE_KEY);
  expenses = [];
  syncFilterOptions();
  render();
  setStatus("localStorage очищен.");
}

function handleFiltersChange() {
  render();
}

async function createExpense(payload) {
  const response = await fetch(`${WORKER_BASE_URL}/api/add-expense`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("Сервер вернул некорректный ответ.");
  }

  if (!response.ok) {
    throw new Error(data?.error || "Ошибка Cloudflare Worker.");
  }

  return sanitizeExpense(data);
}

async function fetchExpenses() {
  const response = await fetch(`${WORKER_BASE_URL}/api/expenses`);

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("Не удалось прочитать список трат с сервера.");
  }

  if (!response.ok || !Array.isArray(data)) {
    throw new Error(data?.error || "Не удалось загрузить траты с сервера.");
  }

  return data.map(sanitizeExpense).sort(sortByDateDesc);
}

async function syncExpensesOnLoad() {
  setStatus("Загружаю данные с сервера...");

  try {
    const serverExpenses = await fetchExpenses();
    if (serverExpenses.length > 0 || expenses.length === 0) {
      expenses = mergeExpenses(serverExpenses, expenses);
      persistExpenses(expenses);
    }
    syncFilterOptions();
    render();
    setStatus("Данные синхронизированы.");
  } catch (error) {
    syncFilterOptions();
    render();
    setStatus(error.message || "Не удалось синхронизировать данные, использую localStorage.", true);
  }
}

function loadExpenses() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map(sanitizeExpense).sort(sortByDateDesc);
  } catch {
    return [];
  }
}

function persistExpenses(nextExpenses) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextExpenses));
}

function upsertExpense(currentExpenses, incomingExpense) {
  const withoutCurrent = currentExpenses.filter((item) => item.id !== incomingExpense.id);
  return [...withoutCurrent, incomingExpense].sort(sortByDateDesc);
}

function mergeExpenses(primaryExpenses, fallbackExpenses) {
  const merged = new Map();

  for (const expense of [...fallbackExpenses, ...primaryExpenses]) {
    const safeExpense = sanitizeExpense(expense);
    merged.set(safeExpense.id, safeExpense);
  }

  return [...merged.values()].sort(sortByDateDesc);
}

function sanitizeExpense(expense) {
  return {
    id: Number(expense.id) || Date.now(),
    date: String(expense.date || ""),
    amount: Number(expense.amount) || 0,
    quantity: Math.max(1, Number(expense.quantity) || 1),
    currency: String(expense.currency || "UAH"),
    description_raw: String(expense.description_raw || ""),
    product_name: String(expense.product_name || ""),
    category: String(expense.category || "other"),
    sub_category: String(expense.sub_category || "other"),
    sub_sub_category: String(expense.sub_sub_category || "other"),
    for_whom: ALLOWED_FOR_WHOM.has(expense.for_whom) ? expense.for_whom : "other",
    notes: String(expense.notes || ""),
  };
}

function sortByDateDesc(left, right) {
  return new Date(right.date).getTime() - new Date(left.date).getTime();
}

function render() {
  filteredExpenses = applyFilters(expenses);
  renderSummary();
  renderTable();
  renderCharts();
}

function renderSummary() {
  const total = filteredExpenses.reduce((sum, item) => sum + item.amount, 0);
  totalAmountNode.textContent = `${total.toFixed(2)} UAH`;
  expenseCountNode.textContent = `${filteredExpenses.length} записей`;
}

function renderTable() {
  tableBody.innerHTML = "";

  if (filteredExpenses.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 11;
    cell.textContent = "Пока нет расходов.";
    row.appendChild(cell);
    tableBody.appendChild(row);
    return;
  }

  for (const expense of filteredExpenses) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(String(expense.id))}</td>
      <td>${escapeHtml(expense.date)}</td>
      <td>${escapeHtml(expense.amount.toFixed(2))} ${escapeHtml(expense.currency)}</td>
      <td>${escapeHtml(String(expense.quantity))}</td>
      <td>${escapeHtml(expense.description_raw)}</td>
      <td>${escapeHtml(shortenText(expense.product_name, 20))}</td>
      <td>${escapeHtml(formatCategoryLabel(expense.category))}</td>
      <td>${escapeHtml(formatCategoryLabel(expense.sub_category))}</td>
      <td>${escapeHtml(formatCategoryLabel(expense.sub_sub_category))}</td>
      <td>${escapeHtml(formatForWhomLabel(expense.for_whom))}</td>
      <td>${escapeHtml(expense.notes || "—")}</td>
    `;
    tableBody.appendChild(row);
  }
}

function renderCharts() {
  const categoryData = aggregateBy("category");
  const forWhomData = aggregateBy("for_whom");
  const timelineData = aggregateByDate();

  categoryChart = renderPieChart(categoryChart, "#categoryChart", categoryData, [
    "#0f766e",
    "#f59e0b",
    "#3b82f6",
    "#ef4444",
    "#8b5cf6",
    "#10b981",
  ]);

  forWhomChart = renderPieChart(forWhomChart, "#forWhomChart", forWhomData, [
    "#115e59",
    "#d97706",
    "#1d4ed8",
    "#be123c",
    "#7c3aed",
    "#047857",
  ]);

  timelineChart = renderBarChart(timelineChart, "#timelineChart", timelineData, "#0f766e");
}

function aggregateBy(field) {
  const totals = new Map();

  for (const expense of filteredExpenses) {
    const key = expense[field] || "other";
    totals.set(key, (totals.get(key) || 0) + expense.amount);
  }

  const labels = [...totals.keys()];
  const values = labels.map((label) => totals.get(label));

  return { labels: labels.map(formatAggregateLabel), values };
}

function aggregateByDate() {
  const totals = new Map();

  for (const expense of filteredExpenses) {
    const key = expense.date || "Без даты";
    totals.set(key, (totals.get(key) || 0) + expense.amount);
  }

  const labels = [...totals.keys()].sort();
  const values = labels.map((label) => totals.get(label));

  return { labels, values };
}

function renderPieChart(existingChart, selector, dataset, colors) {
  const canvas = document.querySelector(selector);

  if (existingChart) {
    existingChart.destroy();
  }

  return new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: dataset.labels.length ? dataset.labels : ["Нет данных"],
      datasets: [
        {
          data: dataset.values.length ? dataset.values : [1],
          backgroundColor: colors,
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
        },
      },
    },
  });
}

function renderBarChart(existingChart, selector, dataset, color) {
  const canvas = document.querySelector(selector);

  if (existingChart) {
    existingChart.destroy();
  }

  return new Chart(canvas, {
    type: "bar",
    data: {
      labels: dataset.labels.length ? dataset.labels : ["Нет данных"],
      datasets: [
        {
          label: "Сумма",
          data: dataset.values.length ? dataset.values : [0],
          backgroundColor: color,
          borderRadius: 12,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
        },
      },
    },
  });
}

function syncFilterOptions() {
  syncSelectOptions(categoryFilter, expenses.map((expense) => expense.category));
  syncSelectOptions(forWhomFilter, expenses.map((expense) => expense.for_whom));
}

function syncSelectOptions(selectNode, values) {
  const currentValue = selectNode.value || "all";
  const uniqueValues = [...new Set(values.filter(Boolean))].sort();

  selectNode.innerHTML = '<option value="all">Все</option>';

  for (const value of uniqueValues) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = formatFilterLabel(selectNode, value);
    selectNode.appendChild(option);
  }

  selectNode.value = uniqueValues.includes(currentValue) || currentValue === "all" ? currentValue : "all";
}

function applyFilters(sourceExpenses) {
  return sourceExpenses.filter((expense) => {
    if (categoryFilter.value !== "all" && expense.category !== categoryFilter.value) {
      return false;
    }

    if (forWhomFilter.value !== "all" && expense.for_whom !== forWhomFilter.value) {
      return false;
    }

    if (dateFromFilter.value && expense.date < dateFromFilter.value) {
      return false;
    }

    if (dateToFilter.value && expense.date > dateToFilter.value) {
      return false;
    }

    return true;
  });
}

function setLoading(isLoading) {
  submitButton.disabled = isLoading;
  submitButton.textContent = isLoading ? "Сохраняю..." : "Сохранить";
}

function setStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle("error", isError);
}

function formatAggregateLabel(value) {
  if (FOR_WHOM_LABELS[value]) {
    return FOR_WHOM_LABELS[value];
  }

  return formatCategoryLabel(value);
}

function formatFilterLabel(selectNode, value) {
  if (selectNode === forWhomFilter) {
    return formatForWhomLabel(value);
  }

  return formatCategoryLabel(value);
}

function formatForWhomLabel(value) {
  return FOR_WHOM_LABELS[value] || "Другое";
}

function formatCategoryLabel(value) {
  if (!value || value === "other") {
    return "Другое";
  }

  return value;
}

function shortenText(value, maxLength) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}…`;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
