const STORAGE_KEY = "spendsoul-expenses";
const WORKER_BASE_URL = "https://spendsoul-api.waltershcroder.workers.dev";
const ALLOWED_FOR_WHOM = new Set([
  "myself",
  "friend",
  "gift",
  "loan",
  "household",
  "other",
]);

const form = document.querySelector("#expenseForm");
const dateInput = document.querySelector("#date");
const amountInput = document.querySelector("#amount");
const descriptionInput = document.querySelector("#description_raw");
const submitButton = document.querySelector("#submitButton");
const clearLocalButton = document.querySelector("#clearLocalButton");
const statusMessage = document.querySelector("#statusMessage");
const tableBody = document.querySelector("#expensesTableBody");
const totalAmountNode = document.querySelector("#totalAmount");
const expenseCountNode = document.querySelector("#expenseCount");

let categoryChart;
let forWhomChart;
let expenses = loadExpenses();

dateInput.value = new Date().toISOString().slice(0, 10);
render();

form.addEventListener("submit", handleSubmit);
clearLocalButton.addEventListener("click", handleClearLocalStorage);

async function handleSubmit(event) {
  event.preventDefault();

  const payload = {
    date: dateInput.value,
    amount: Number(amountInput.value),
    description_raw: descriptionInput.value.trim(),
  };

  if (!payload.date || !payload.description_raw || Number.isNaN(payload.amount)) {
    setStatus("Заполните дату, сумму и описание.", true);
    return;
  }

  setLoading(true);
  setStatus("Сохраняю и нормализую трату...");

  try {
    const normalizedExpense = await createExpense(payload);
    expenses = upsertExpense(expenses, normalizedExpense);
    persistExpenses(expenses);
    render();
    form.reset();
    dateInput.value = new Date().toISOString().slice(0, 10);
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
  render();
  setStatus("localStorage очищен.");
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

function sanitizeExpense(expense) {
  return {
    id: Number(expense.id) || Date.now(),
    date: String(expense.date || ""),
    amount: Number(expense.amount) || 0,
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
  renderSummary();
  renderTable();
  renderCharts();
}

function renderSummary() {
  const total = expenses.reduce((sum, item) => sum + item.amount, 0);
  totalAmountNode.textContent = `${total.toFixed(2)} UAH`;
  expenseCountNode.textContent = `${expenses.length} записей`;
}

function renderTable() {
  tableBody.innerHTML = "";

  if (expenses.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 10;
    cell.textContent = "Пока нет расходов.";
    row.appendChild(cell);
    tableBody.appendChild(row);
    return;
  }

  for (const expense of expenses) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(String(expense.id))}</td>
      <td>${escapeHtml(expense.date)}</td>
      <td>${escapeHtml(expense.amount.toFixed(2))} ${escapeHtml(expense.currency)}</td>
      <td>${escapeHtml(expense.description_raw)}</td>
      <td>${escapeHtml(expense.product_name)}</td>
      <td>${escapeHtml(expense.category)}</td>
      <td>${escapeHtml(expense.sub_category)}</td>
      <td>${escapeHtml(expense.sub_sub_category)}</td>
      <td>${escapeHtml(expense.for_whom)}</td>
      <td>${escapeHtml(expense.notes)}</td>
    `;
    tableBody.appendChild(row);
  }
}

function renderCharts() {
  const categoryData = aggregateBy("category");
  const forWhomData = aggregateBy("for_whom");

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
}

function aggregateBy(field) {
  const totals = new Map();

  for (const expense of expenses) {
    const key = expense[field] || "other";
    totals.set(key, (totals.get(key) || 0) + expense.amount);
  }

  const labels = [...totals.keys()];
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

function setLoading(isLoading) {
  submitButton.disabled = isLoading;
  submitButton.textContent = isLoading ? "Сохраняю..." : "Сохранить";
}

function setStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle("error", isError);
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
