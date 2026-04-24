const STORAGE_KEY = "spendsoul-expenses";
const WORKER_BASE_URL = "https://spendsoul-api.waltershcroder.workers.dev";
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
const FOR_WHOM_LABELS = {
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

const form = document.querySelector("#expenseForm");
const dateInput = document.querySelector("#date");
const amountInput = document.querySelector("#amount");
const quantityInput = document.querySelector("#quantity");
const quantityDownButton = document.querySelector("#quantityDownButton");
const quantityUpButton = document.querySelector("#quantityUpButton");
const descriptionInput = document.querySelector("#description_raw");
const notesInput = document.querySelector("#notes");
const aiHintInput = document.querySelector("#ai_hint");
const submitButton = document.querySelector("#submitButton");
const clearLocalButton = document.querySelector("#clearLocalButton");
const statusMessage = document.querySelector("#statusMessage");
const tableBody = document.querySelector("#expensesTableBody");
const totalAmountNode = document.querySelector("#totalAmount");
const expenseCountNode = document.querySelector("#expenseCount");
const monthlyWeekBreakdown = document.querySelector("#monthlyWeekBreakdown");
const monthlySparkline = document.querySelector("#monthlySparkline");
const monthLabel = document.querySelector("#monthLabel");
const prevMonthButton = document.querySelector("#prevMonthButton");
const nextMonthButton = document.querySelector("#nextMonthButton");
const categoryFilter = document.querySelector("#categoryFilter");
const forWhomFilter = document.querySelector("#forWhomFilter");
const dateFromFilter = document.querySelector("#dateFromFilter");
const dateToFilter = document.querySelector("#dateToFilter");
const tableSortButtons = [...document.querySelectorAll(".table-sort-button")];
const prevWeekButton = document.querySelector("#prevWeekButton");
const nextWeekButton = document.querySelector("#nextWeekButton");
const weekRangeLabel = document.querySelector("#weekRangeLabel");
const weekInsight = document.querySelector("#weekInsight");
const confirmModal = document.querySelector("#confirmModal");
const confirmEyebrow = document.querySelector("#confirmEyebrow");
const confirmTitle = document.querySelector("#confirmTitle");
const confirmCopy = document.querySelector("#confirmCopy");
const confirmDecision = document.querySelector("#confirmDecision");
const confirmPreview = document.querySelector("#confirmPreview");
const toggleConfirmEditButton = document.querySelector("#toggleConfirmEditButton");
const confirmSaveButton = document.querySelector("#confirmSaveButton");
const cancelConfirmButton = document.querySelector("#cancelConfirmButton");
const closeConfirmModal = document.querySelector("#closeConfirmModal");

let categoryChart;
let forWhomChart;
let timelineChart;
let expenses = loadExpenses();
let filteredExpenses = [...expenses];
let pendingExpense = null;
let pendingDecision = null;
let pendingMode = "create";
let confirmEditorOpen = false;
let currentSort = { key: "date", direction: "desc" };
let visibleWeekStart = getStartOfWeek(getLatestExpenseDate(expenses));
let visibleMonthDate = getStartOfMonth(getLatestExpenseDate(expenses));

dateInput.value = new Date().toISOString().slice(0, 10);
syncExpensesOnLoad();
render();

form.addEventListener("submit", handleSubmit);
clearLocalButton.addEventListener("click", handleClearLocalStorage);
quantityDownButton.addEventListener("click", () => adjustQuantity(-1));
quantityUpButton.addEventListener("click", () => adjustQuantity(1));
categoryFilter.addEventListener("change", handleFiltersChange);
forWhomFilter.addEventListener("change", handleFiltersChange);
dateFromFilter.addEventListener("change", handleFiltersChange);
dateToFilter.addEventListener("change", handleFiltersChange);
tableSortButtons.forEach((button) => button.addEventListener("click", handleSortChange));
tableBody.addEventListener("click", handleTableBodyClick);
prevWeekButton.addEventListener("click", () => shiftVisibleWeek(-1));
nextWeekButton.addEventListener("click", () => shiftVisibleWeek(1));
prevMonthButton.addEventListener("click", () => shiftVisibleMonth(-1));
nextMonthButton.addEventListener("click", () => shiftVisibleMonth(1));
confirmSaveButton.addEventListener("click", handleConfirmSave);
cancelConfirmButton.addEventListener("click", closeConfirmDialog);
closeConfirmModal.addEventListener("click", closeConfirmDialog);
toggleConfirmEditButton.addEventListener("click", toggleConfirmEditor);
confirmModal.addEventListener("click", handleConfirmBackdrop);

[dateInput, dateFromFilter, dateToFilter].forEach(bindNativeDatePicker);

async function handleSubmit(event) {
  event.preventDefault();

  const payload = {
    date: dateInput.value,
    amount: Number(amountInput.value),
    description_raw: descriptionInput.value.trim(),
    quantity: Number(quantityInput.value || 1),
    notes: notesInput.value.trim(),
    ai_hint: aiHintInput.value.trim(),
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
  setStatus("Нормализую трату...");

  try {
    const normalizedResult = await normalizeExpense(payload);
    pendingMode = "create";
    pendingExpense = normalizedResult.expense;
    pendingDecision = normalizedResult.decision;
    openConfirmDialog(normalizedResult.expense, normalizedResult.decision);
    setStatus("Проверьте нормализованную трату и подтвердите сохранение.");
  } catch (error) {
    setStatus(error.message || "Не удалось сохранить трату.", true);
  } finally {
    setLoading(false);
  }
}

function handleClearLocalStorage() {
  localStorage.removeItem(STORAGE_KEY);
  expenses = [];
  visibleWeekStart = getStartOfWeek(new Date());
  visibleMonthDate = getStartOfMonth(new Date());
  syncFilterOptions();
  render();
  setStatus("localStorage очищен.");
}

function adjustQuantity(delta) {
  const currentValue = Number(quantityInput.value) || 1;
  const nextValue = Math.max(1, currentValue + delta);
  quantityInput.value = String(nextValue);
}

function handleFiltersChange() {
  visibleWeekStart = getStartOfWeek(getLatestExpenseDate(applyFilters(expenses)));
  render();
}

function handleSortChange(event) {
  const nextKey = event.currentTarget.dataset.sortKey;
  if (!nextKey) {
    return;
  }

  if (currentSort.key === nextKey) {
    currentSort.direction = currentSort.direction === "asc" ? "desc" : "asc";
  } else {
    currentSort = {
      key: nextKey,
      direction: getDefaultSortDirection(nextKey),
    };
  }

  render();
}

function handleTableBodyClick(event) {
  const editButton = event.target.closest("[data-edit-expense-id]");
  if (!editButton) {
    return;
  }

  const expenseId = Number(editButton.dataset.editExpenseId);
  const expense = expenses.find((item) => item.id === expenseId);
  if (!expense) {
    setStatus("Не удалось найти запись для редактирования.", true);
    return;
  }

  pendingMode = "edit";
  pendingExpense = sanitizeExpense(expense);
  pendingDecision = buildEditDecision(expense);
  openConfirmDialog(pendingExpense, pendingDecision);
  setStatus("Открыл запись из истории для редактирования.");
}

function shiftVisibleWeek(offset) {
  visibleWeekStart = addDays(visibleWeekStart, offset * 7);
  renderCharts();
}

function shiftVisibleMonth(offset) {
  visibleMonthDate = addMonths(visibleMonthDate, offset);
  renderSummary();
}

function handleConfirmBackdrop(event) {
  if (event.target.dataset.closeModal === "true") {
    closeConfirmDialog();
  }
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

async function normalizeExpense(payload) {
  const response = await fetch(`${WORKER_BASE_URL}/api/normalize-expense`, {
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
    throw new Error(data?.error || "Ошибка нормализации.");
  }

  return {
    expense: sanitizeExpense(data?.expense || data),
    decision: sanitizeDecision(data?.decision),
  };
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
    visibleWeekStart = getStartOfWeek(getLatestExpenseDate(expenses));
    visibleMonthDate = getStartOfMonth(getLatestExpenseDate(expenses));
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
    ai_hint: String(expense.ai_hint || ""),
  };
}

function sortByDateDesc(left, right) {
  return compareByDateWithTieBreaker(left, right, "desc");
}

function render() {
  filteredExpenses = sortExpenses(applyFilters(expenses));
  renderSummary();
  renderTable();
  renderCharts();
  renderSortState();
}

function renderSummary() {
  const monthlySummary = buildMonthlySummary(expenses, visibleMonthDate);
  totalAmountNode.textContent = `${monthlySummary.total.toFixed(2)} UAH`;
  expenseCountNode.textContent = `${monthlySummary.count} записей за месяц`;
  monthLabel.textContent = formatMonthLabel(visibleMonthDate);
  monthlyWeekBreakdown.innerHTML = renderMonthlyWeeks(monthlySummary.weeks);
  renderMonthlySparkline(monthlySummary.dailyTotals);

  const latestMonth = getStartOfMonth(getLatestExpenseDate(expenses));
  nextMonthButton.disabled = visibleMonthDate.getTime() >= latestMonth.getTime();
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
      <td>${escapeHtml(toDisplayCase(expense.description_raw))}</td>
      <td>${escapeHtml(shortenText(toDisplayCase(expense.product_name), 20))}</td>
      <td>${escapeHtml(formatCategoryLabel(expense.category))}</td>
      <td>${escapeHtml(formatCategoryLabel(expense.sub_category))}</td>
      <td>${escapeHtml(formatForWhomLabel(expense.for_whom))}</td>
      <td>${escapeHtml(expense.notes ? toDisplayCase(expense.notes) : "—")}</td>
      <td class="table-actions-cell">
        <button type="button" class="table-edit-button" data-edit-expense-id="${escapeHtml(String(expense.id))}" aria-label="Редактировать запись">
          <span class="table-edit-icon" aria-hidden="true"></span>
        </button>
      </td>
    `;
    tableBody.appendChild(row);
  }
}

function renderCharts() {
  const categoryData = aggregateBy("category");
  const forWhomData = aggregateBy("for_whom");
  const timelineData = aggregateByVisibleWeek();

  categoryChart = renderPieChart(categoryChart, "#categoryChart", categoryData, [
    "#4285f4",
    "#ea4335",
    "#fbbc05",
    "#34a853",
    "#8ab4f8",
    "#aecbfa",
  ]);

  forWhomChart = renderPieChart(forWhomChart, "#forWhomChart", forWhomData, [
    "#4285f4",
    "#ea4335",
    "#fbbc05",
    "#34a853",
    "#8ab4f8",
    "#aecbfa",
  ]);

  timelineChart = renderBarChart(timelineChart, "#timelineChart", timelineData, "#4285f4");
  renderWeekInsight(timelineData);
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

function aggregateByVisibleWeek() {
  const start = getStartOfWeek(visibleWeekStart);
  const labels = [];
  const values = [];
  const counts = [];
  const dates = [];

  for (let index = 0; index < 7; index += 1) {
    const currentDay = addDays(start, index);
    const isoDate = formatIsoDate(currentDay);
    const dayExpenses = filteredExpenses.filter((expense) => expense.date === isoDate);
    const dayTotal = dayExpenses.reduce((sum, expense) => sum + expense.amount, 0);

    labels.push(formatWeekdayLabel(currentDay));
    values.push(Number(dayTotal.toFixed(2)));
    counts.push(dayExpenses.length);
    dates.push(new Date(currentDay));
  }

  updateWeekRangeLabel(start);

  return { labels, values, counts, dates };
}

function buildMonthlySummary(sourceExpenses, monthDate) {
  const startOfMonth = getStartOfMonth(monthDate);
  const endOfMonth = getEndOfMonth(startOfMonth);
  const monthlyExpenses = sourceExpenses.filter((expense) => {
    const expenseDate = new Date(expense.date || 0);
    return expenseDate >= startOfMonth && expenseDate <= endOfMonth;
  });
  const dailyTotals = [];
  let dayCursor = new Date(startOfMonth);

  const weeks = [];
  let cursor = new Date(startOfMonth);

  while (dayCursor <= endOfMonth) {
    const isoDate = formatIsoDate(dayCursor);
    const total = monthlyExpenses
      .filter((expense) => expense.date === isoDate)
      .reduce((sum, expense) => sum + expense.amount, 0);

    dailyTotals.push(Number(total.toFixed(2)));
    dayCursor = addDays(dayCursor, 1);
  }

  while (cursor <= endOfMonth) {
    const weekStart = new Date(cursor);
    const weekEnd = new Date(Math.min(addDays(weekStart, 6).getTime(), endOfMonth.getTime()));
    const total = monthlyExpenses
      .filter((expense) => {
        const expenseDate = new Date(expense.date || 0);
        return expenseDate >= weekStart && expenseDate <= weekEnd;
      })
      .reduce((sum, expense) => sum + expense.amount, 0);

    weeks.push({
      start: weekStart,
      end: weekEnd,
      total: Number(total.toFixed(2)),
    });

    cursor = addDays(weekEnd, 1);
  }

  return {
    total: Number(monthlyExpenses.reduce((sum, expense) => sum + expense.amount, 0).toFixed(2)),
    count: monthlyExpenses.length,
    weeks,
    dailyTotals,
  };
}

function renderMonthlyWeeks(weeks) {
  if (!weeks.length) {
    return '<p class="monthly-week-empty">Нет трат за выбранный месяц.</p>';
  }

  return weeks
    .map(
      (week) => `
        <div class="monthly-week-row">
          <span>${escapeHtml(formatWeekInterval(week.start, week.end))}</span>
          <strong>${escapeHtml(week.total.toFixed(2))} UAH</strong>
        </div>
      `,
    )
    .join("");
}

function renderMonthlySparkline(values) {
  if (!monthlySparkline) {
    return;
  }

  monthlySparkline.innerHTML = buildMonthlySparklineSvg(values);
}

function renderWeekInsight(dataset) {
  if (!weekInsight) {
    return;
  }

  const values = dataset.values || [];
  const counts = dataset.counts || [];
  const totalTransactions = counts.reduce((sum, value) => sum + value, 0);
  const averageTransactionsPerDay = totalTransactions / 7;
  const recommendation = buildWeekRecommendation(values, counts);

  weekInsight.innerHTML = `
    ${renderInsightMetric("Среднее трат в день", `${averageTransactionsPerDay.toFixed(1)}`, "week-insight-primary")}
    ${renderInsightMetric("Рекомендация", recommendation, "week-insight-wide")}
  `;
}

function buildWeekRecommendation(values, counts) {
  const weeklyTotal = values.reduce((sum, value) => sum + value, 0);
  const totalTransactions = counts.reduce((sum, value) => sum + value, 0);
  const activeDays = counts.filter((value) => value > 0).length;
  const peakValue = Math.max(...values, 0);
  const averagePerActiveDay = activeDays ? weeklyTotal / activeDays : 0;

  if (!weeklyTotal && !totalTransactions) {
    return "Неделя спокойная. Можно держать такой темп и дальше.";
  }

  if (totalTransactions >= 18) {
    return "Покупок много. Поможет лимит на мелкие ежедневные траты.";
  }

  if (peakValue > averagePerActiveDay * 1.8 && peakValue > 0) {
    return "Есть один выбивающийся день. Крупные траты лучше планировать заранее.";
  }

  if (activeDays <= 2) {
    return "Траты редкие, но точечные. Проверь, можно ли распределять их ровнее по неделе.";
  }

  return "Неделя выглядит ровно. Следи, чтобы спонтанные покупки не росли к выходным.";
}

function renderInsightMetric(label, value, extraClass = "") {
  const className = ["week-insight-item", extraClass].filter(Boolean).join(" ");
  return `
    <div class="${className}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function buildMonthlySparklineSvg(values) {
  const safeValues = values.length ? values : [0];
  const maxValue = Math.max(...safeValues, 1);
  const width = Math.max(180, safeValues.length * 12);
  const height = 80;
  const stepX = safeValues.length > 1 ? width / (safeValues.length - 1) : width;
  const points = safeValues.map((value, index) => {
    const scaledHeight = Math.max(value / maxValue, 0.08);
    const x = Number((index * stepX).toFixed(2));
    const y = Number((height - scaledHeight * (height - 10) - 4).toFixed(2));
    return { x, y };
  });

  const linePoints = points.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPath = [
    `M 0 ${height}`,
    ...points.map((point, index) => `${index === 0 ? "L" : "L"} ${point.x} ${point.y}`),
    `L ${width} ${height}`,
    "Z",
  ].join(" ");

  return `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="presentation">
      <path class="sparkline-area" d="${areaPath}"></path>
      <polyline class="sparkline-line" points="${linePoints}"></polyline>
    </svg>
  `;
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
      maintainAspectRatio: true,
      aspectRatio: 1,
      cutout: "68%",
      animation: {
        duration: 700,
      },
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: "rgba(243, 246, 242, 0.72)",
            padding: 16,
            font: {
              family: "Manrope",
              size: 12,
              weight: "700",
            },
          },
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
          borderRadius: 0,
          borderSkipped: false,
          maxBarThickness: 28,
          categoryPercentage: 0.62,
          barPercentage: 0.7,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 700,
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: "#0b1020",
          borderColor: "rgba(66, 133, 244, 0.24)",
          borderWidth: 1,
          titleColor: "#f3f6f2",
          bodyColor: "rgba(243, 246, 242, 0.82)",
        },
      },
      scales: {
        x: {
          ticks: {
            color: "rgba(243, 246, 242, 0.6)",
            maxRotation: 0,
            autoSkip: false,
            padding: 12,
            font: {
              family: "Manrope",
              size: 13,
              weight: "700",
              lineHeight: 1.2,
            },
          },
          grid: {
            color: "rgba(66, 133, 244, 0.08)",
          },
          border: {
            color: "rgba(66, 133, 244, 0.12)",
          },
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: "rgba(243, 246, 242, 0.6)",
            padding: 8,
            font: {
              family: "Manrope",
              size: 11,
              weight: "700",
            },
          },
          grid: {
            color: "rgba(66, 133, 244, 0.08)",
          },
          border: {
            color: "rgba(66, 133, 244, 0.12)",
          },
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

function sortExpenses(sourceExpenses) {
  const sortedExpenses = [...sourceExpenses];
  sortedExpenses.sort((left, right) => compareExpenses(left, right, currentSort));
  return sortedExpenses;
}

function compareExpenses(left, right, sortConfig) {
  const directionMultiplier = sortConfig.direction === "asc" ? 1 : -1;
  const key = sortConfig.key;

  if (key === "date") {
    return compareByDateWithTieBreaker(left, right, sortConfig.direction);
  }

  if (["id", "amount", "quantity"].includes(key)) {
    const leftValue = Number(left[key]) || 0;
    const rightValue = Number(right[key]) || 0;
    if (leftValue !== rightValue) {
      return (leftValue - rightValue) * directionMultiplier;
    }
    return compareByDateWithTieBreaker(left, right, "desc");
  }

  const leftValue = normalizeSortableText(getSortableTextValue(left, key));
  const rightValue = normalizeSortableText(getSortableTextValue(right, key));
  const textComparison = leftValue.localeCompare(rightValue, "ru", { sensitivity: "base" });
  if (textComparison !== 0) {
    return textComparison * directionMultiplier;
  }

  return compareByDateWithTieBreaker(left, right, "desc");
}

function compareByDateWithTieBreaker(left, right, direction) {
  const leftTime = new Date(left.date || 0).getTime();
  const rightTime = new Date(right.date || 0).getTime();

  if (leftTime !== rightTime) {
    return direction === "asc" ? leftTime - rightTime : rightTime - leftTime;
  }

  const leftId = Number(left.id) || 0;
  const rightId = Number(right.id) || 0;
  return direction === "asc" ? leftId - rightId : rightId - leftId;
}

function getSortableTextValue(expense, key) {
  if (key === "for_whom") {
    return formatForWhomLabel(expense.for_whom);
  }

  return expense[key] || "";
}

function normalizeSortableText(value) {
  return String(value || "").trim().toLowerCase();
}

function getDefaultSortDirection(key) {
  return ["id", "date", "amount", "quantity"].includes(key) ? "desc" : "asc";
}

function renderSortState() {
  tableSortButtons.forEach((button) => {
    const isActive = button.dataset.sortKey === currentSort.key;
    button.dataset.active = String(isActive);
    button.dataset.direction = isActive ? currentSort.direction : "";
  });
}

function updateWeekRangeLabel(startOfWeek) {
  const endOfWeek = addDays(startOfWeek, 6);
  weekRangeLabel.textContent = `${formatShortDate(startOfWeek)} - ${formatShortDate(endOfWeek)}`;

  const latestWeekStart = getStartOfWeek(getLatestExpenseDate(filteredExpenses));
  nextWeekButton.disabled = startOfWeek.getTime() >= latestWeekStart.getTime();
}

function bindNativeDatePicker(input) {
  if (!input || input.dataset.pickerBound === "true") {
    return;
  }

  const openPicker = () => {
    if (typeof input.showPicker === "function") {
      try {
        input.showPicker();
      } catch {
        return;
      }
    }
  };

  input.addEventListener("click", openPicker);
  input.addEventListener("focus", openPicker);
  input.dataset.pickerBound = "true";
}

function getLatestExpenseDate(sourceExpenses) {
  if (!sourceExpenses.length) {
    return new Date();
  }

  const latestExpense = [...sourceExpenses].sort((left, right) => compareByDateWithTieBreaker(left, right, "desc"))[0];
  return new Date(latestExpense?.date || Date.now());
}

function getStartOfWeek(date) {
  const safeDate = new Date(date);
  const currentDay = safeDate.getDay();
  const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
  safeDate.setDate(safeDate.getDate() + mondayOffset);
  safeDate.setHours(0, 0, 0, 0);
  return safeDate;
}

function getStartOfMonth(date) {
  const safeDate = new Date(date);
  safeDate.setDate(1);
  safeDate.setHours(0, 0, 0, 0);
  return safeDate;
}

function getEndOfMonth(date) {
  const safeDate = new Date(date);
  safeDate.setMonth(safeDate.getMonth() + 1, 0);
  safeDate.setHours(23, 59, 59, 999);
  return safeDate;
}

function addDays(date, amount) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + amount);
  return nextDate;
}

function addMonths(date, amount) {
  const nextDate = new Date(date);
  nextDate.setMonth(nextDate.getMonth() + amount, 1);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function formatIsoDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatShortDate(date) {
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(date) {
  return date.toLocaleDateString("ru-RU", {
    month: "long",
    year: "numeric",
  });
}

function formatWeekdayLabel(date) {
  const labels = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
  return [labels[date.getDay()], formatShortDate(date)];
}

function formatWeekInterval(start, end) {
  return `${formatShortDate(start)}-${formatShortDate(end)}`;
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

async function handleConfirmSave() {
  if (!pendingExpense) {
    return;
  }

  pendingExpense = readConfirmEditorValue();

  confirmSaveButton.disabled = true;
  confirmSaveButton.textContent = "Сохраняю...";

  try {
    const currentMode = pendingMode;
    const savedExpense = await createExpense(pendingExpense);
    expenses = upsertExpense(expenses, savedExpense);
    visibleWeekStart = getStartOfWeek(getLatestExpenseDate(expenses));
    visibleMonthDate = getStartOfMonth(getLatestExpenseDate(expenses));
    persistExpenses(expenses);
    syncFilterOptions();
    render();
    if (pendingMode === "create") {
      form.reset();
      dateInput.value = new Date().toISOString().slice(0, 10);
      quantityInput.value = "1";
    }
    pendingExpense = null;
    pendingDecision = null;
    pendingMode = "create";
    closeConfirmDialog();
    setStatus(currentMode === "edit" ? "Запись обновлена." : "Трата сохранена.");
  } catch (error) {
    setStatus(error.message || "Не удалось сохранить трату.", true);
  } finally {
    confirmSaveButton.disabled = false;
    confirmSaveButton.textContent = "Подтвердить";
  }
}

function openConfirmDialog(expense, decision) {
  confirmEditorOpen = false;
  confirmDecision.innerHTML = renderDecision(decision);
  renderConfirmPreview(expense);
  toggleConfirmEditButton.textContent = "Редактировать вручную";
  confirmEyebrow.textContent = pendingMode === "edit" ? "Редактирование Записи" : "Подтверждение Записи";
  confirmTitle.textContent = pendingMode === "edit" ? "Редактирование траты" : "Подтверждение траты";
  confirmCopy.textContent =
    pendingMode === "edit"
      ? "Обновляю существующую запись из истории. Проверь поля и сохрани изменения."
      : "Добавляю трату в категории ниже. Проверь данные и подтверди сохранение.";
  confirmModal.classList.remove("hidden");
  confirmModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeConfirmDialog() {
  confirmModal.classList.add("hidden");
  confirmModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  confirmEditorOpen = false;
  confirmEyebrow.textContent = "Подтверждение Записи";
  confirmTitle.textContent = "Подтверждение траты";
  confirmCopy.textContent = "Добавляю трату в категории ниже. Проверь данные и подтверди сохранение.";
}

function renderConfirmPreview(expense) {
  confirmPreview.innerHTML = `
    ${renderConfirmField("Сумма", "amount", String(expense.amount), { type: "number", step: "0.01", min: "0", suffix: expense.currency })}
    ${renderConfirmField("Количество", "quantity", String(expense.quantity), { type: "number", step: "1", min: "1" })}
    ${renderConfirmField("Товар", "product_name", expense.product_name)}
    ${renderConfirmField("Для кого", "for_whom", expense.for_whom, { type: "select" })}
    ${renderConfirmField("Категория", "category", expense.category)}
    ${renderConfirmField("Подкатегория", "sub_category", expense.sub_category)}
    ${renderConfirmField("Описание", "description_raw", expense.description_raw, { type: "textarea", wide: true, rows: "3" })}
    ${renderConfirmField("Заметки", "notes", expense.notes, { type: "textarea", wide: true, rows: "2", emptyText: "—" })}
  `;

  if (confirmEditorOpen) {
    confirmPreview.querySelectorAll('input[type="date"]').forEach(bindNativeDatePicker);
  }
}

function renderDecision(decision) {
  const safeDecision = sanitizeDecision(decision);
  const items = safeDecision.details
    .filter((item) => item.field !== "sub_sub_category")
    .map((item) => `<li>${escapeHtml(item.message)}</li>`)
    .join("");

  return `
    <h3>Что сейчас сделает ИИ</h3>
    <p>${escapeHtml(safeDecision.summary)}</p>
    <ul>${items}</ul>
  `;
}

function buildEditDecision(expense) {
  return {
    summary: `Редактируешь запись №${expense.id}. Изменения сохранятся поверх текущей версии без дубликатов.`,
    details: [
      {
        field: "edit",
        label: "Редактирование",
        value: String(expense.id),
        action: "update",
        message: "Можно поправить сумму, описание, категорию и получателя прямо здесь.",
      },
    ],
  };
}

function toggleConfirmEditor() {
  pendingExpense = readConfirmEditorValue();
  confirmEditorOpen = !confirmEditorOpen;
  toggleConfirmEditButton.textContent = confirmEditorOpen ? "Скрыть редактирование" : "Редактировать вручную";
  renderConfirmPreview(pendingExpense);
}

function renderConfirmField(label, name, value, options = {}) {
  const type = options.type || "text";
  const wideClass = options.wide ? " confirm-item-wide" : "";
  const safeValue = String(value || "");
  const displayValue = options.emptyText && !safeValue ? options.emptyText : safeValue;

  if (!confirmEditorOpen) {
    const formattedValue =
      name === "for_whom"
        ? formatForWhomLabel(safeValue)
        : name === "amount" && safeValue
          ? `${safeValue} ${options.suffix || ""}`.trim()
          : name === "description_raw" || name === "notes"
            ? (displayValue ? toDisplayCase(displayValue) : "—")
            : name === "category" || name === "sub_category"
              ? formatCategoryLabel(safeValue)
              : toDisplayCase(displayValue || "—");

    return `
      <div class="confirm-item${wideClass}">
        <strong>${escapeHtml(label)}</strong>
        <span>${escapeHtml(formattedValue)}</span>
      </div>
    `;
  }

  if (type === "select") {
    return `
      <label class="confirm-item confirm-item-editable${wideClass}">
        <span>${escapeHtml(label)}</span>
        <select data-confirm-field="${escapeHtml(name)}">
          ${renderForWhomOptions(safeValue)}
        </select>
      </label>
    `;
  }

  if (type === "textarea") {
    return `
      <label class="confirm-item confirm-item-editable${wideClass}">
        <span>${escapeHtml(label)}</span>
        <textarea data-confirm-field="${escapeHtml(name)}" rows="${escapeHtml(options.rows || "3")}">${escapeHtml(
          safeValue,
        )}</textarea>
      </label>
    `;
  }

  const attrs = [];
  if (type) {
    attrs.push(`type="${escapeHtml(type)}"`);
  }
  if (options.step) {
    attrs.push(`step="${escapeHtml(options.step)}"`);
  }
  if (options.min) {
    attrs.push(`min="${escapeHtml(options.min)}"`);
  }

  return `
    <label class="confirm-item confirm-item-editable${wideClass}">
      <span>${escapeHtml(label)}</span>
      <input value="${escapeHtml(safeValue)}" data-confirm-field="${escapeHtml(name)}" ${attrs.join(" ")} />
    </label>
  `;
}

function renderForWhomOptions(selectedValue) {
  return [...ALLOWED_FOR_WHOM]
    .map(
      (value) =>
        `<option value="${escapeHtml(value)}"${value === selectedValue ? " selected" : ""}>${escapeHtml(
          formatForWhomLabel(value),
        )}</option>`,
    )
    .join("");
}

function readConfirmEditorValue() {
  const getField = (name) => confirmPreview.querySelector(`[data-confirm-field="${name}"]`);

  if (!confirmEditorOpen) {
    return sanitizeExpense(pendingExpense || {});
  }

  return sanitizeExpense({
    ...pendingExpense,
    date: getField("date")?.value || pendingExpense.date,
    amount: Number(getField("amount")?.value ?? pendingExpense.amount),
    quantity: Number(getField("quantity")?.value ?? pendingExpense.quantity),
    product_name: getField("product_name")?.value || pendingExpense.product_name,
    for_whom: getField("for_whom")?.value || pendingExpense.for_whom,
    category: getField("category")?.value || pendingExpense.category,
    sub_category: getField("sub_category")?.value || pendingExpense.sub_category,
    description_raw: getField("description_raw")?.value || pendingExpense.description_raw,
    notes: getField("notes")?.value || pendingExpense.notes,
  });
}

function sanitizeDecision(decision) {
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

  return toDisplayCase(value);
}

function toDisplayCase(value) {
  const normalized = String(value || "").trim();

  if (!normalized) {
    return "";
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
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
