const APP_CONFIG = window.SPENDSOUL_CONFIG || {};
const WORKER_BASE_URL = normalizeWorkerBaseUrl(APP_CONFIG.workerBaseUrl || "");
const TELEGRAM_AUTH_HEADER = "X-Telegram-Init-Data";
const TELEGRAM_LOGIN_AUTH_HEADER = "X-Telegram-Auth-Data";
const TELEGRAM_LOGIN_STORAGE_KEY = "spendsoul-telegram-login";
const TELEGRAM_BOT_LOGIN_PENDING_KEY = "spendsoul-bot-login-pending";
const TELEGRAM_BOT_USERNAME = String(APP_CONFIG.telegramBotUsername || "spendsoul_bot").replace(/^@/, "");
captureTelegramLoginFromUrl();
let botLoginPollTimer = null;
const STORAGE_OWNER_KEY = getStorageOwnerKey();
const STORAGE_KEY = `spendsoul-${STORAGE_OWNER_KEY}-expenses`;
const INCOME_STORAGE_KEY = `spendsoul-${STORAGE_OWNER_KEY}-incomes`;
const CRYPTO_STORAGE_KEY = `spendsoul-${STORAGE_OWNER_KEY}-crypto-assets`;
const RECURRING_STORAGE_KEY = `spendsoul-${STORAGE_OWNER_KEY}-recurring-expenses`;
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
const resetServerButton = document.querySelector("#resetServerButton");
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
const latestExpenseCount = document.querySelector("#latestExpenseCount");
const latestExpenseCountLabel = document.querySelector("#latestExpenseCountLabel");
const latestExpenseHint = document.querySelector("#latestExpenseHint");
const latestExpenseList = document.querySelector("#latestExpenseList");
const viewTabs = [...document.querySelectorAll(".view-tab")];
const expensesView = document.querySelector("#expensesView");
const incomesView = document.querySelector("#incomesView");
const cryptoView = document.querySelector("#cryptoView");
const incomeForm = document.querySelector("#incomeForm");
const incomeDateInput = document.querySelector("#incomeDate");
const incomeAmountInput = document.querySelector("#incomeAmount");
const incomeSourceInput = document.querySelector("#incomeSource");
const incomeNotesInput = document.querySelector("#incomeNotes");
const incomeSubmitButton = document.querySelector("#incomeSubmitButton");
const incomeStatusMessage = document.querySelector("#incomeStatusMessage");
const monthlyIncomeAmount = document.querySelector("#monthlyIncomeAmount");
const monthlyExpenseMirror = document.querySelector("#monthlyExpenseMirror");
const monthlyBalanceAmount = document.querySelector("#monthlyBalanceAmount");
const incomeCount = document.querySelector("#incomeCount");
const incomesTableBody = document.querySelector("#incomesTableBody");
const cryptoForm = document.querySelector("#cryptoForm");
const cryptoCoinInput = document.querySelector("#cryptoCoin");
const cryptoAmountHeldInput = document.querySelector("#cryptoAmountHeld");
const cryptoInvestedAmountInput = document.querySelector("#cryptoInvestedAmount");
const cryptoNotesInput = document.querySelector("#cryptoNotes");
const cryptoSubmitButton = document.querySelector("#cryptoSubmitButton");
const refreshCryptoPricesButton = document.querySelector("#refreshCryptoPricesButton");
const cryptoStatusMessage = document.querySelector("#cryptoStatusMessage");
const cryptoCurrentValue = document.querySelector("#cryptoCurrentValue");
const cryptoInvestedValue = document.querySelector("#cryptoInvestedValue");
const cryptoProfitValue = document.querySelector("#cryptoProfitValue");
const cryptoReturnPercent = document.querySelector("#cryptoReturnPercent");
const cryptoPriceStatus = document.querySelector("#cryptoPriceStatus");
const cryptoTableBody = document.querySelector("#cryptoTableBody");
const recurringView = document.querySelector("#recurringView");
const recurringForm = document.querySelector("#recurringForm");
const recurringStartDateInput = document.querySelector("#recurringStartDate");
const recurringAmountInput = document.querySelector("#recurringAmount");
const recurringFrequencyInput = document.querySelector("#recurringFrequency");
const recurringForWhomInput = document.querySelector("#recurringForWhom");
const recurringDescriptionInput = document.querySelector("#recurringDescription");
const recurringCategoryInput = document.querySelector("#recurringCategory");
const recurringSubCategoryInput = document.querySelector("#recurringSubCategory");
const recurringNotesInput = document.querySelector("#recurringNotes");
const recurringSubmitButton = document.querySelector("#recurringSubmitButton");
const materializeRecurringButton = document.querySelector("#materializeRecurringButton");
const recurringStatusMessage = document.querySelector("#recurringStatusMessage");
const recurringMonthlyAmount = document.querySelector("#recurringMonthlyAmount");
const recurringCount = document.querySelector("#recurringCount");
const recurringTableBody = document.querySelector("#recurringTableBody");
const expenseSearchInput = document.querySelector("#expenseSearchInput");
const syncBanner = document.querySelector("#syncBanner");
const quickAddButton = document.querySelector("#quickAddButton");
const themeToggleButton = document.querySelector("#themeToggleButton");
const brandTitle = document.querySelector(".brand-title");

let categoryChart;
let forWhomChart;
let timelineChart;
let expenses = loadExpenses();
let incomes = loadIncomes();
let cryptoAssets = loadCryptoAssets();
let recurringExpenses = loadRecurringExpenses();
let cryptoPrices = {};
let filteredExpenses = [...expenses];
let isOfflineMode = false;
let pendingExpense = null;
let pendingDecision = null;
let pendingMode = "create";
let isInitialSyncing = false;
let recentlySavedExpenseId = null;
let recentlySavedIncomeId = null;
let recentlySavedCryptoAssetId = null;
let recentlySavedRecurringExpenseId = null;
let soulClickCount = 0;
let soulClickTimer = null;
let editingIncomeId = null;
let editingCryptoAssetId = null;
let editingRecurringExpenseId = null;
let confirmEditorOpen = false;
let currentSort = { key: "date", direction: "desc" };
let visibleWeekStart = getStartOfWeek(getLatestExpenseDate(expenses));
let visibleMonthDate = getStartOfMonth(getLatestFinancialDate(expenses, incomes));
const customSelects = new WeakMap();

dateInput.value = new Date().toISOString().slice(0, 10);
incomeDateInput.value = new Date().toISOString().slice(0, 10);
recurringStartDateInput.value = new Date().toISOString().slice(0, 10);
initializeTheme();
initializeSoulMode();
initializeTelegramApp();
if (hasTelegramAuth()) {
  syncExpensesOnLoad();
} else {
  isOfflineMode = true;
  setSyncState("offline", "Войдите через Telegram");
  setStatus("Войдите через @spendsoul_bot, чтобы загрузить ваши расходы.", true);
  setIncomeStatus("Войдите через Telegram, чтобы загрузить доходы.", true);
  setCryptoStatus("Войдите через Telegram, чтобы загрузить крипто портфель.", true);
  setRecurringStatus("Войдите через Telegram, чтобы загрузить подписки.", true);
}
render();
renderTelegramLoginGate();

form.addEventListener("submit", handleSubmit);
incomeForm.addEventListener("submit", handleIncomeSubmit);
cryptoForm.addEventListener("submit", handleCryptoSubmit);
recurringForm.addEventListener("submit", handleRecurringSubmit);
clearLocalButton?.addEventListener("click", handleClearLocalStorage);
resetServerButton?.addEventListener("click", handleResetServerData);
refreshCryptoPricesButton.addEventListener("click", refreshCryptoPrices);
materializeRecurringButton?.addEventListener("click", handleMaterializeRecurring);
quickAddButton.addEventListener("click", handleQuickAdd);
quantityDownButton.addEventListener("click", () => adjustQuantity(-1));
quantityUpButton.addEventListener("click", () => adjustQuantity(1));
categoryFilter.addEventListener("change", handleFiltersChange);
forWhomFilter.addEventListener("change", handleFiltersChange);
dateFromFilter.addEventListener("change", handleFiltersChange);
dateToFilter.addEventListener("change", handleFiltersChange);
expenseSearchInput?.addEventListener("input", handleFiltersChange);
tableSortButtons.forEach((button) => button.addEventListener("click", handleSortChange));
tableBody.addEventListener("click", handleTableBodyClick);
incomesTableBody.addEventListener("click", handleIncomeTableClick);
cryptoTableBody.addEventListener("click", handleCryptoTableClick);
recurringTableBody.addEventListener("click", handleRecurringTableClick);
prevWeekButton.addEventListener("click", () => shiftVisibleWeek(-1));
nextWeekButton.addEventListener("click", () => shiftVisibleWeek(1));
prevMonthButton.addEventListener("click", () => shiftVisibleMonth(-1));
nextMonthButton.addEventListener("click", () => shiftVisibleMonth(1));
confirmSaveButton.addEventListener("click", handleConfirmSave);
cancelConfirmButton.addEventListener("click", closeConfirmDialog);
closeConfirmModal.addEventListener("click", closeConfirmDialog);
toggleConfirmEditButton.addEventListener("click", toggleConfirmEditor);
confirmModal.addEventListener("click", handleConfirmBackdrop);
viewTabs.forEach((button) => button.addEventListener("click", handleViewTabClick));
document.addEventListener("click", handleDocumentClick);
themeToggleButton.addEventListener("click", toggleTheme);
brandTitle?.addEventListener("click", handleBrandTitleClick);

[dateInput, incomeDateInput, dateFromFilter, dateToFilter, recurringStartDateInput].forEach(bindNativeDatePicker);
initializeCustomSelects();

function blockOfflineWrite(setter) {
  if (!isOfflineMode) {
    return false;
  }

  setter("Сервер недоступен: показан локальный кеш, изменения временно отключены. Обновите страницу после восстановления связи.", true);
  return true;
}

function initializeTelegramApp() {
  if (!window.Telegram?.WebApp) {
    return;
  }

  window.Telegram.WebApp.ready();
  window.Telegram.WebApp.expand();
}

function initializeTheme() {
  const savedTheme = localStorage.getItem("spendsoul-theme") || "dark";
  applyTheme(savedTheme === "light" ? "light" : "dark");
}

function toggleTheme() {
  const nextTheme = document.body.dataset.theme === "light" ? "dark" : "light";
  localStorage.setItem("spendsoul-theme", nextTheme);
  applyTheme(nextTheme);
}

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  themeToggleButton.textContent = theme === "light" ? "Темная тема" : "Светлая тема";
}

function initializeSoulMode() {
  const isSoulMode = localStorage.getItem("spendsoul-soul-mode") === "on";
  document.body.dataset.soulMode = isSoulMode ? "on" : "off";
  if (isSoulMode) {
    setSyncState(syncBanner?.dataset.state || "online", "Soul mode активен");
  }
}

function handleBrandTitleClick() {
  soulClickCount += 1;
  window.clearTimeout(soulClickTimer);
  soulClickTimer = window.setTimeout(() => {
    soulClickCount = 0;
  }, 1400);

  if (soulClickCount < 5) {
    return;
  }

  soulClickCount = 0;
  const nextMode = document.body.dataset.soulMode === "on" ? "off" : "on";
  document.body.dataset.soulMode = nextMode;
  localStorage.setItem("spendsoul-soul-mode", nextMode === "on" ? "on" : "off");
  renderCharts();
  setSyncState(syncBanner?.dataset.state || "online", nextMode === "on" ? "Soul mode включен" : "Soul mode выключен");
  showToast(nextMode === "on" ? "Soul mode включен" : "Soul mode выключен", "success");
}

function hasTelegramAuth() {
  return Boolean(getTelegramInitData() || getTelegramLoginAuthData() || APP_CONFIG.devStorageUserId);
}

function renderTelegramLoginGate(reason = "") {
  const existingGate = document.querySelector("#telegramLoginGate");
  if (existingGate) {
    if (reason) {
      const title = existingGate.querySelector("#telegramLoginTitle");
      const copy = existingGate.querySelector("#telegramLoginCopy");
      if (title) {
        title.textContent = "Сессия истекла";
      }
      if (copy) {
        copy.textContent = reason;
      }
    }
    return;
  }

  if (hasTelegramAuth() && !reason) {
    return;
  }

  const gate = document.createElement("div");
  gate.id = "telegramLoginGate";
  gate.className = "telegram-login-gate";
  gate.innerHTML = `
    <div class="telegram-login-card">
      <div class="telegram-login-brand">
        <div class="brand-mark telegram-login-mark" aria-hidden="true">
          <span class="brand-symbol">₴</span>
        </div>
        <div>
          <h2>SpendSoul</h2>
          <p>Личный вход через Telegram</p>
        </div>
      </div>
      <div class="telegram-login-copy">
        <h3 id="telegramLoginTitle">${reason ? "Сессия истекла" : "Войдите в аккаунт"}</h3>
        <p id="telegramLoginCopy">${
          reason
            ? escapeHtml(reason)
            : `Нажмите кнопку, затем Start у @${escapeHtml(TELEGRAM_BOT_USERNAME)}. SpendSoul вернется к вашим данным автоматически.`
        }</p>
      </div>
      <button type="button" id="botLoginButton" class="telegram-bot-login-button">Открыть Telegram</button>
      <div id="telegramLoginButton" class="telegram-login-button hidden"></div>
      <p id="telegramLoginHint" class="telegram-login-hint"></p>
    </div>
  `;
  document.body.append(gate);

  document.querySelector("#botLoginButton").addEventListener("click", handleBotLoginClick);
  resumePendingBotLogin();

  if (isLocalHost()) {
    const hint = document.querySelector("#telegramLoginHint");
    hint.textContent =
      "Telegram Login Widget не работает на localhost. Для локальной проверки создайте config.local.js с devStorageUserId и workerBaseUrl на локальный Worker.";
    return;
  }

  window.handleTelegramLogin = handleTelegramLogin;
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://telegram.org/js/telegram-widget.js?22";
  script.dataset.telegramLogin = TELEGRAM_BOT_USERNAME;
  script.dataset.size = "large";
  script.dataset.radius = "8";
  script.dataset.userpic = "false";
  script.dataset.requestAccess = "write";
  script.dataset.onauth = "handleTelegramLogin(user)";
  document.querySelector("#telegramLoginButton").append(script);
}

async function handleBotLoginClick() {
  const button = document.querySelector("#botLoginButton");
  const hint = document.querySelector("#telegramLoginHint");

  button.disabled = true;
  button.textContent = "Готовлю вход...";
  hint.textContent = "";

  try {
    const loginToken = await createBotLoginToken();
    rememberPendingBotLogin(loginToken);
    openTelegramBotLogin(loginToken.bot_url);
    button.textContent = "Жду Start в Telegram";
    hint.innerHTML = `Не открылось? <a href="${escapeHtml(loginToken.bot_url)}" target="_blank" rel="noopener">Открыть вручную</a>`;
    startBotLoginPolling(loginToken.nonce);
  } catch (error) {
    button.disabled = false;
    button.textContent = "Открыть Telegram";
    hint.textContent = error.message || "Не удалось открыть Telegram-вход.";
  }
}

function openTelegramBotLogin(botUrl) {
  if (shouldOpenTelegramInCurrentTab()) {
    window.location.href = botUrl;
    return;
  }

  const openedWindow = window.open(botUrl, "_blank", "noopener,noreferrer");
  if (!openedWindow) {
    window.location.href = botUrl;
  }
}

function shouldOpenTelegramInCurrentTab() {
  const userAgent = navigator.userAgent || "";
  return /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent);
}

function rememberPendingBotLogin(loginToken) {
  try {
    localStorage.setItem(
      TELEGRAM_BOT_LOGIN_PENDING_KEY,
      JSON.stringify({
        nonce: loginToken.nonce,
        expires_at: Number(loginToken.expires_at) || 0,
        bot_url: loginToken.bot_url,
      }),
    );
  } catch {}
}

function getPendingBotLogin() {
  try {
    const pendingLogin = JSON.parse(localStorage.getItem(TELEGRAM_BOT_LOGIN_PENDING_KEY) || "null");
    if (!pendingLogin?.nonce || Number(pendingLogin.expires_at || 0) <= Math.floor(Date.now() / 1000)) {
      localStorage.removeItem(TELEGRAM_BOT_LOGIN_PENDING_KEY);
      return null;
    }

    return pendingLogin;
  } catch {
    localStorage.removeItem(TELEGRAM_BOT_LOGIN_PENDING_KEY);
    return null;
  }
}

function resumePendingBotLogin() {
  const pendingLogin = getPendingBotLogin();
  if (!pendingLogin) {
    return;
  }

  const button = document.querySelector("#botLoginButton");
  const hint = document.querySelector("#telegramLoginHint");
  button.disabled = true;
  button.textContent = "Проверяю вход...";
  hint.innerHTML = `Если вы еще не нажали Start, <a href="${escapeHtml(pendingLogin.bot_url)}" target="_blank" rel="noopener">откройте Telegram</a>.`;
  startBotLoginPolling(pendingLogin.nonce);
}

function startBotLoginPolling(nonce) {
  if (botLoginPollTimer) {
    window.clearInterval(botLoginPollTimer);
  }

  const poll = async () => {
    try {
      const status = await fetchBotLoginStatus(nonce);
      if (status.status === "authorized" && status.auth_data) {
        window.clearInterval(botLoginPollTimer);
        localStorage.removeItem(TELEGRAM_BOT_LOGIN_PENDING_KEY);
        localStorage.setItem(TELEGRAM_LOGIN_STORAGE_KEY, status.auth_data);
        window.location.reload();
        return;
      }

      if (status.status === "expired") {
        window.clearInterval(botLoginPollTimer);
        localStorage.removeItem(TELEGRAM_BOT_LOGIN_PENDING_KEY);
        const button = document.querySelector("#botLoginButton");
        const hint = document.querySelector("#telegramLoginHint");
        button.disabled = false;
        button.textContent = "Открыть Telegram";
        hint.textContent = "Сессия входа устарела. Нажмите кнопку еще раз.";
      }
    } catch {
      const hint = document.querySelector("#telegramLoginHint");
      hint.textContent = "Жду подтверждение в Telegram...";
    }
  };

  poll();
  botLoginPollTimer = window.setInterval(poll, 1800);
}

function handleTelegramLogin(user) {
  localStorage.setItem(TELEGRAM_LOGIN_STORAGE_KEY, JSON.stringify(user));
  window.location.reload();
}

function captureTelegramLoginFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  for (const [key, value] of hashParams.entries()) {
    if (!params.has(key)) {
      params.set(key, value);
    }
  }
  const id = params.get("id");
  const authDate = params.get("auth_date");
  const hash = params.get("hash");
  if (!id || !authDate || !hash) {
    return;
  }

  const payload = {};
  ["id", "first_name", "last_name", "username", "photo_url", "auth_date", "hash"].forEach((key) => {
    if (params.has(key)) {
      payload[key] = params.get(key);
    }
  });
  localStorage.setItem(TELEGRAM_LOGIN_STORAGE_KEY, JSON.stringify(payload));

  const cleanUrl = `${window.location.origin}${window.location.pathname}${window.location.hash}`;
  window.history.replaceState({}, document.title, cleanUrl);
}

function isLocalHost() {
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname) || window.location.protocol === "file:";
}

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

  if (blockOfflineWrite(setStatus)) {
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

async function handleIncomeSubmit(event) {
  event.preventDefault();

  const payload = {
    id: editingIncomeId,
    date: incomeDateInput.value,
    amount: Number(incomeAmountInput.value),
    currency: "UAH",
    source: incomeSourceInput.value.trim(),
    notes: incomeNotesInput.value.trim(),
  };

  if (!payload.date || !payload.source || Number.isNaN(payload.amount) || payload.amount <= 0) {
    setIncomeStatus("Заполните дату, сумму и источник.", true);
    return;
  }

  if (blockOfflineWrite(setIncomeStatus)) {
    return;
  }

  setIncomeLoading(true);
  setIncomeStatus("Сохраняю поступление...");

  try {
    const savedIncome = await createIncome(payload);
    incomes = upsertIncome(incomes, savedIncome);
    recentlySavedIncomeId = savedIncome.id;
    scheduleRecentHighlightClear();
    visibleMonthDate = getStartOfMonth(getLatestFinancialDate(expenses, incomes));
    persistIncomes(incomes);
    renderIncomeView();
    pulseNodes(monthlyIncomeAmount, monthlyBalanceAmount, incomeCount);
    incomeForm.reset();
    editingIncomeId = null;
    incomeDateInput.value = new Date().toISOString().slice(0, 10);
    await flashButtonSuccess(incomeSubmitButton, "Сохранено", "Сохранить доход");
    setIncomeStatus("Доход сохранен.");
  } catch (error) {
    setIncomeStatus(error.message || "Не удалось сохранить доход.", true);
  } finally {
    setIncomeLoading(false);
  }
}

async function handleCryptoSubmit(event) {
  event.preventDefault();

  const selectedCoin = parseCryptoCoinValue(cryptoCoinInput.value);
  const payload = {
    id: editingCryptoAssetId,
    ...selectedCoin,
    amount_held: Number(cryptoAmountHeldInput.value),
    invested_amount: Number(cryptoInvestedAmountInput.value),
    currency: "UAH",
    notes: cryptoNotesInput.value.trim(),
    updated_at: new Date().toISOString(),
  };

  if (
    !payload.name ||
    !payload.symbol ||
    !payload.coingecko_id ||
    Number.isNaN(payload.amount_held) ||
    payload.amount_held <= 0 ||
    Number.isNaN(payload.invested_amount) ||
    payload.invested_amount < 0
  ) {
    setCryptoStatus("Выберите монету, количество и сумму вложений.", true);
    return;
  }

  if (blockOfflineWrite(setCryptoStatus)) {
    return;
  }

  setCryptoLoading(true);
  setCryptoStatus("Сохраняю позицию...");

  try {
    const savedCryptoAsset = await createCryptoAsset(payload);
    cryptoAssets = upsertCryptoAsset(cryptoAssets, savedCryptoAsset);
    recentlySavedCryptoAssetId = savedCryptoAsset.id;
    scheduleRecentHighlightClear();
    persistCryptoAssets(cryptoAssets);
    cryptoForm.reset();
    editingCryptoAssetId = null;
    updateCustomSelect(cryptoCoinInput);
    renderCryptoView();
    await refreshCryptoPrices();
    await flashButtonSuccess(cryptoSubmitButton, "Сохранено", "Сохранить позицию");
    setCryptoStatus("Позиция сохранена.");
  } catch (error) {
    setCryptoStatus(error.message || "Не удалось сохранить позицию.", true);
  } finally {
    setCryptoLoading(false);
  }
}

async function handleRecurringSubmit(event) {
  event.preventDefault();

  const payload = {
    id: editingRecurringExpenseId,
    start_date: recurringStartDateInput.value,
    amount: Number(recurringAmountInput.value),
    description_raw: recurringDescriptionInput.value.trim(),
    category: recurringCategoryInput.value.trim() || "подписки",
    sub_category: recurringSubCategoryInput.value.trim() || "подписки",
    for_whom: recurringForWhomInput.value,
    frequency: recurringFrequencyInput.value,
    notes: recurringNotesInput.value.trim(),
    active: true,
  };

  if (!payload.start_date || !payload.description_raw || Number.isNaN(payload.amount) || payload.amount <= 0) {
    setRecurringStatus("Заполните старт, сумму и описание.", true);
    return;
  }

  if (blockOfflineWrite(setRecurringStatus)) {
    return;
  }

  setRecurringLoading(true);
  setRecurringStatus("Сохраняю подписку...");

  try {
    const savedRecurringExpense = await createRecurringExpense(payload);
    recurringExpenses = upsertRecurringExpense(recurringExpenses, savedRecurringExpense);
    recentlySavedRecurringExpenseId = savedRecurringExpense.id;
    scheduleRecentHighlightClear();
    persistRecurringExpenses(recurringExpenses);
    recurringForm.reset();
    editingRecurringExpenseId = null;
    recurringStartDateInput.value = new Date().toISOString().slice(0, 10);
    updateCustomSelect(recurringFrequencyInput);
    updateCustomSelect(recurringForWhomInput);
    renderRecurringView();
    pulseNodes(recurringMonthlyAmount, recurringCount);
    await flashButtonSuccess(recurringSubmitButton, "Сохранено", "Сохранить подписку");
    setRecurringStatus("Подписка сохранена.");
  } catch (error) {
    setRecurringStatus(error.message || "Не удалось сохранить подписку.", true);
  } finally {
    setRecurringLoading(false);
  }
}

async function handleMaterializeRecurring() {
  if (blockOfflineWrite(setRecurringStatus)) {
    return;
  }

  if (materializeRecurringButton) {
    materializeRecurringButton.disabled = true;
  }
  setRecurringStatus("Создаю расходы из подписок...");

  try {
    const generatedExpenses = await materializeRecurringExpenses();
    if (generatedExpenses.length) {
      expenses = mergeExpenses(generatedExpenses, expenses);
      persistExpenses(expenses);
      syncFilterOptions();
      render();
      setRecurringStatus(`Создано расходов из подписок: ${generatedExpenses.length}.`);
    } else {
      setRecurringStatus("За текущий период новых расходов из подписок нет.");
    }
  } catch (error) {
    setRecurringStatus(error.message || "Не удалось создать расходы из подписок.", true);
  } finally {
    if (materializeRecurringButton) {
      materializeRecurringButton.disabled = false;
    }
  }
}

function handleClearLocalStorage() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(INCOME_STORAGE_KEY);
  localStorage.removeItem(CRYPTO_STORAGE_KEY);
  localStorage.removeItem(RECURRING_STORAGE_KEY);
  expenses = [];
  incomes = [];
  cryptoAssets = [];
  recurringExpenses = [];
  cryptoPrices = {};
  visibleWeekStart = getStartOfWeek(new Date());
  visibleMonthDate = getStartOfMonth(new Date());
  syncFilterOptions();
  render();
  setStatus("Локальный кеш очищен.");
  setIncomeStatus("Локальный кеш очищен.");
  setCryptoStatus("Локальный кеш очищен.");
  setRecurringStatus("Локальный кеш очищен.");
}

async function handleResetServerData() {
  if (blockOfflineWrite(setStatus)) {
    return;
  }

  if (!confirm("Удалить все ваши расходы, доходы, крипто позиции и подписки на сервере?")) {
    return;
  }

  if (resetServerButton) {
    resetServerButton.disabled = true;
  }
  setSyncState("loading", "Сбрасываю серверные данные...");

  try {
    await resetServerData();
    handleClearLocalStorage();
    setSyncState("online", "Серверные данные очищены");
    setStatus("Серверные данные очищены.");
  } catch (error) {
    setSyncState("offline", "Сброс сервера не выполнен");
    setStatus(error.message || "Не удалось сбросить серверные данные.", true);
  } finally {
    if (resetServerButton) {
      resetServerButton.disabled = false;
    }
  }
}

function handleViewTabClick(event) {
  const target = event.currentTarget.dataset.viewTarget;
  const isIncomeView = target === "incomes";
  const isCryptoView = target === "crypto";
  const isRecurringView = target === "recurring";

  expensesView.classList.toggle("hidden", isIncomeView || isCryptoView || isRecurringView);
  incomesView.classList.toggle("hidden", !isIncomeView);
  cryptoView.classList.toggle("hidden", !isCryptoView);
  recurringView.classList.toggle("hidden", !isRecurringView);
  viewTabs.forEach((button) => button.classList.toggle("active", button.dataset.viewTarget === target));
}

function handleQuickAdd() {
  const activeTarget = viewTabs.find((button) => button.classList.contains("active"))?.dataset.viewTarget || "expenses";
  const targetNode =
    activeTarget === "incomes"
      ? incomeForm
      : activeTarget === "crypto"
        ? cryptoForm
        : activeTarget === "recurring"
          ? recurringForm
          : form;

  targetNode.scrollIntoView({ behavior: "smooth", block: "start" });
  targetNode.querySelector("input, textarea, select")?.focus({ preventScroll: true });
}

function handleDocumentClick(event) {
  const emptyStateAction = event.target.closest("[data-empty-view-target]");
  if (emptyStateAction) {
    const target = emptyStateAction.dataset.emptyViewTarget || "expenses";
    viewTabs.find((button) => button.dataset.viewTarget === target)?.click();
    handleQuickAdd();
    return;
  }

  document.querySelectorAll(".custom-select.open").forEach((customSelect) => {
    if (!customSelect.contains(event.target)) {
      customSelect.classList.remove("open");
      customSelect.querySelector(".custom-select-button")?.setAttribute("aria-expanded", "false");
    }
  });
}

function initializeCustomSelects() {
  document.querySelectorAll("select").forEach((selectNode) => createCustomSelect(selectNode));
}

function createCustomSelect(selectNode) {
  if (!selectNode || customSelects.has(selectNode)) {
    return;
  }

  const customSelect = document.createElement("div");
  customSelect.className = "custom-select";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "custom-select-button";
  button.setAttribute("aria-haspopup", "listbox");
  button.setAttribute("aria-expanded", "false");

  const list = document.createElement("div");
  list.className = "custom-select-list";
  list.setAttribute("role", "listbox");

  button.addEventListener("click", () => {
    document.querySelectorAll(".custom-select.open").forEach((openSelect) => {
      if (openSelect !== customSelect) {
        openSelect.classList.remove("open");
        openSelect.querySelector(".custom-select-button")?.setAttribute("aria-expanded", "false");
      }
    });

    const isOpen = customSelect.classList.toggle("open");
    button.setAttribute("aria-expanded", String(isOpen));
  });

  customSelect.append(button, list);
  selectNode.classList.add("native-select-hidden");
  selectNode.insertAdjacentElement("afterend", customSelect);
  customSelects.set(selectNode, { button, list, customSelect });
  updateCustomSelect(selectNode);
}

function updateCustomSelect(selectNode) {
  const customSelect = customSelects.get(selectNode);
  if (!customSelect) {
    return;
  }

  const { button, list, customSelect: customSelectNode } = customSelect;
  const options = [...selectNode.options];
  const selectedOption = options.find((option) => option.value === selectNode.value) || options[0];
  button.textContent = selectedOption?.textContent || "";
  list.innerHTML = "";

  for (const option of options) {
    const optionButton = document.createElement("button");
    optionButton.type = "button";
    optionButton.className = "custom-select-option";
    optionButton.textContent = option.textContent;
    optionButton.setAttribute("role", "option");
    optionButton.setAttribute("aria-selected", String(option.value === selectNode.value));
    optionButton.addEventListener("click", () => {
      selectNode.value = option.value;
      selectNode.dispatchEvent(new Event("change", { bubbles: true }));
      customSelectNode.classList.remove("open");
      button.setAttribute("aria-expanded", "false");
      updateCustomSelect(selectNode);
    });
    list.appendChild(optionButton);
  }
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
  const deleteButton = event.target.closest("[data-delete-expense-id]");
  if (deleteButton) {
    deleteExpenseById(Number(deleteButton.dataset.deleteExpenseId));
    return;
  }

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

function handleIncomeTableClick(event) {
  const deleteButton = event.target.closest("[data-delete-income-id]");
  if (deleteButton) {
    deleteIncomeById(Number(deleteButton.dataset.deleteIncomeId));
    return;
  }

  const editButton = event.target.closest("[data-edit-income-id]");
  if (!editButton) {
    return;
  }

  const income = incomes.find((item) => item.id === Number(editButton.dataset.editIncomeId));
  if (!income) {
    setIncomeStatus("Не удалось найти доход.", true);
    return;
  }

  incomeDateInput.value = income.date;
  editingIncomeId = income.id;
  incomeAmountInput.value = String(income.amount);
  incomeSourceInput.value = income.source;
  incomeNotesInput.value = income.notes;
  incomeSourceInput.focus();
  setIncomeStatus("Доход загружен в форму. Сохранение обновит запись.");
}

function handleCryptoTableClick(event) {
  const deleteButton = event.target.closest("[data-delete-crypto-id]");
  if (deleteButton) {
    deleteCryptoAssetById(Number(deleteButton.dataset.deleteCryptoId));
    return;
  }

  const editButton = event.target.closest("[data-edit-crypto-id]");
  if (!editButton) {
    return;
  }

  const asset = cryptoAssets.find((item) => item.id === Number(editButton.dataset.editCryptoId));
  if (!asset) {
    setCryptoStatus("Не удалось найти позицию.", true);
    return;
  }

  cryptoCoinInput.value = `${asset.coingecko_id}|${asset.symbol}|${asset.name}`;
  editingCryptoAssetId = asset.id;
  cryptoAmountHeldInput.value = String(asset.amount_held);
  cryptoInvestedAmountInput.value = String(asset.invested_amount);
  cryptoNotesInput.value = asset.notes;
  updateCustomSelect(cryptoCoinInput);
  cryptoAmountHeldInput.focus();
  setCryptoStatus("Позиция загружена в форму. Сохранение обновит запись.");
}

function handleRecurringTableClick(event) {
  const deleteButton = event.target.closest("[data-delete-recurring-id]");
  if (deleteButton) {
    deleteRecurringExpenseById(Number(deleteButton.dataset.deleteRecurringId));
    return;
  }

  const toggleButton = event.target.closest("[data-toggle-recurring-id]");
  if (toggleButton) {
    handleToggleRecurringExpense(Number(toggleButton.dataset.toggleRecurringId));
    return;
  }

  const editButton = event.target.closest("[data-edit-recurring-id]");
  if (!editButton) {
    return;
  }

  const recurringExpense = recurringExpenses.find((item) => item.id === Number(editButton.dataset.editRecurringId));
  if (!recurringExpense) {
    setRecurringStatus("Не удалось найти подписку.", true);
    return;
  }

  recurringStartDateInput.value = recurringExpense.start_date;
  editingRecurringExpenseId = recurringExpense.id;
  recurringAmountInput.value = String(recurringExpense.amount);
  recurringFrequencyInput.value = recurringExpense.frequency;
  recurringForWhomInput.value = recurringExpense.for_whom;
  recurringDescriptionInput.value = recurringExpense.description_raw;
  recurringCategoryInput.value = recurringExpense.category;
  recurringSubCategoryInput.value = recurringExpense.sub_category;
  recurringNotesInput.value = recurringExpense.notes;
  updateCustomSelect(recurringFrequencyInput);
  updateCustomSelect(recurringForWhomInput);
  recurringDescriptionInput.focus();
  setRecurringStatus("Подписка загружена в форму. Сохранение обновит запись.");
}

async function deleteExpenseById(id) {
  if (blockOfflineWrite(setStatus)) {
    return;
  }

  if (!Number.isFinite(id) || !confirm("Удалить эту трату?")) {
    return;
  }

  try {
    await deleteServerItem("expenses", id);
    expenses = expenses.filter((item) => item.id !== id);
    persistExpenses(expenses);
    syncFilterOptions();
    render();
    setStatus("Трата удалена.");
  } catch (error) {
    setStatus(error.message || "Не удалось удалить трату.", true);
  }
}

async function deleteIncomeById(id) {
  if (blockOfflineWrite(setIncomeStatus)) {
    return;
  }

  if (!Number.isFinite(id) || !confirm("Удалить этот доход?")) {
    return;
  }

  try {
    await deleteServerItem("incomes", id);
    incomes = incomes.filter((item) => item.id !== id);
    persistIncomes(incomes);
    renderIncomeView();
    setIncomeStatus("Доход удален.");
  } catch (error) {
    setIncomeStatus(error.message || "Не удалось удалить доход.", true);
  }
}

async function deleteCryptoAssetById(id) {
  if (blockOfflineWrite(setCryptoStatus)) {
    return;
  }

  if (!Number.isFinite(id) || !confirm("Удалить эту крипто позицию?")) {
    return;
  }

  try {
    await deleteServerItem("crypto-assets", id);
    cryptoAssets = cryptoAssets.filter((item) => item.id !== id);
    persistCryptoAssets(cryptoAssets);
    renderCryptoView();
    setCryptoStatus("Позиция удалена.");
  } catch (error) {
    setCryptoStatus(error.message || "Не удалось удалить позицию.", true);
  }
}

async function deleteRecurringExpenseById(id) {
  if (blockOfflineWrite(setRecurringStatus)) {
    return;
  }

  if (!Number.isFinite(id) || !confirm("Удалить эту подписку?")) {
    return;
  }

  try {
    await deleteServerItem("recurring-expenses", id);
    recurringExpenses = recurringExpenses.filter((item) => item.id !== id);
    persistRecurringExpenses(recurringExpenses);
    renderRecurringView();
    setRecurringStatus("Подписка удалена.");
  } catch (error) {
    setRecurringStatus(error.message || "Не удалось удалить подписку.", true);
  }
}

async function handleToggleRecurringExpense(id) {
  if (blockOfflineWrite(setRecurringStatus)) {
    return;
  }

  const recurringExpense = recurringExpenses.find((item) => item.id === id);
  if (!recurringExpense) {
    setRecurringStatus("Не удалось найти подписку.", true);
    return;
  }

  try {
    const savedRecurringExpense = await createRecurringExpense({
      ...recurringExpense,
      active: !recurringExpense.active,
    });
    recurringExpenses = upsertRecurringExpense(recurringExpenses, savedRecurringExpense);
    persistRecurringExpenses(recurringExpenses);
    renderRecurringView();
    setRecurringStatus(savedRecurringExpense.active ? "Подписка снова активна." : "Подписка отключена.");
  } catch (error) {
    setRecurringStatus(error.message || "Не удалось изменить статус подписки.", true);
  }
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

function normalizeWorkerBaseUrl(value) {
  return String(value || "").replace(/\/+$/, "");
}

function getStorageOwnerKey() {
  const telegramUser = getTelegramUser();
  if (telegramUser?.id) {
    return `tg-${telegramUser.id}`;
  }

  const loginUser = getTelegramLoginUser();
  if (loginUser?.id) {
    return `tg-${loginUser.id}`;
  }

  return String(APP_CONFIG.devStorageUserId || "telegram").replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
}

function getTelegramInitData() {
  return String(window.Telegram?.WebApp?.initData || APP_CONFIG.telegramInitData || "");
}

function getTelegramUser() {
  const initData = getTelegramInitData();
  if (!initData) {
    return null;
  }

  try {
    const user = new URLSearchParams(initData).get("user");
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
}

function getTelegramLoginAuthData() {
  return String(localStorage.getItem(TELEGRAM_LOGIN_STORAGE_KEY) || APP_CONFIG.telegramLoginAuthData || "");
}

function getTelegramLoginUser() {
  const authData = getTelegramLoginAuthData();
  if (!authData) {
    return null;
  }

  try {
    return JSON.parse(authData);
  } catch {
    return null;
  }
}

async function apiFetch(path, options = {}) {
  const telegramInitData = getTelegramInitData();
  const telegramLoginAuthData = getTelegramLoginAuthData();
  const headers = {
    ...(options.headers || {}),
  };

  if (telegramInitData) {
    headers[TELEGRAM_AUTH_HEADER] = telegramInitData;
  } else if (telegramLoginAuthData) {
    headers[TELEGRAM_LOGIN_AUTH_HEADER] = telegramLoginAuthData;
  }

  const response = await fetch(`${WORKER_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && (telegramLoginAuthData || telegramInitData)) {
    if (telegramLoginAuthData) {
      localStorage.removeItem(TELEGRAM_LOGIN_STORAGE_KEY);
    }
    renderTelegramLoginGate("Telegram-сессия истекла. Войдите заново, чтобы продолжить синхронизацию.");
    setSyncState("offline", "Нужен повторный вход");
  }

  return response;
}

async function createBotLoginToken() {
  const response = await apiFetch("/api/bot-login-token", {
    method: "POST",
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || "Не удалось создать Telegram-вход.");
  }

  return data;
}

async function fetchBotLoginStatus(nonce) {
  const response = await apiFetch(`/api/bot-login-status?nonce=${encodeURIComponent(nonce)}`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || "Не удалось проверить Telegram-вход.");
  }

  return data;
}

async function saveExpenseRecord(payload, mode = "create") {
  const isEdit = mode === "edit" && payload?.id;
  const response = await apiFetch(isEdit ? `/api/expenses/${encodeURIComponent(payload.id)}` : "/api/add-expense", {
    method: isEdit ? "PUT" : "POST",
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
    throw new Error(data?.error || "Ошибка сервера.");
  }

  return sanitizeExpense(data);
}

async function createIncome(payload) {
  const response = await apiFetch("/api/add-income", {
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
    throw new Error(data?.error || "Ошибка сервера.");
  }

  return sanitizeIncome(data);
}

async function createCryptoAsset(payload) {
  const response = await apiFetch("/api/add-crypto-asset", {
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
    throw new Error(data?.error || "Ошибка сервера.");
  }

  return sanitizeCryptoAsset(data);
}

async function createRecurringExpense(payload) {
  const response = await apiFetch("/api/add-recurring-expense", {
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
    throw new Error(data?.error || "Ошибка сервера.");
  }

  return sanitizeRecurringExpense(data);
}

async function maybeCreateSubscriptionFromExpense(expense) {
  if (!isSubscriptionExpense(expense) || hasMatchingSubscription(expense)) {
    return null;
  }

  try {
    return await createRecurringExpense({
      start_date: expense.date || new Date().toISOString().slice(0, 10),
      amount: expense.amount,
      currency: expense.currency || "UAH",
      description_raw: getExpenseShortTitle(expense),
      category: "подписки",
      sub_category: inferSubscriptionSubCategory(expense),
      for_whom: expense.for_whom || "myself",
      frequency: "monthly",
      notes: buildSubscriptionNote(expense),
      active: true,
    });
  } catch (error) {
    setRecurringStatus(error.message || "Не удалось автоматически добавить подписку.", true);
    return null;
  }
}

function isSubscriptionExpense(expense) {
  const text = normalizeSearchText(
    [
      expense.description_raw,
      expense.product_name,
      expense.category,
      expense.sub_category,
      expense.sub_sub_category,
      expense.notes,
      expense.ai_hint,
    ].join(" "),
  );

  return /\b(subscription|subscribe|premium|plus|pro)\b/.test(text) || text.includes("подпис");
}

function hasMatchingSubscription(expense) {
  const title = normalizeSubscriptionTitle(getExpenseShortTitle(expense));
  if (!title) {
    return false;
  }

  return recurringExpenses.some((item) => normalizeSubscriptionTitle(item.description_raw) === title);
}

function normalizeSubscriptionTitle(value) {
  return normalizeSearchText(value).replace(/\s+/g, " ").trim();
}

function inferSubscriptionSubCategory(expense) {
  const text = normalizeSearchText([expense.description_raw, expense.product_name, expense.sub_category, expense.notes].join(" "));
  if (/netflix|youtube|spotify|apple music|megogo|sweet tv|ivi|кино|музык|стрим/.test(text)) {
    return "стриминг";
  }

  if (/chatgpt|openai|notion|figma|adobe|github|vpn|софт|software|app|cloud|icloud|google/.test(text)) {
    return "софт";
  }

  if (/интернет|мобиль|телефон|связь|lifecell|kyivstar|vodafone/.test(text)) {
    return "связь";
  }

  return String(expense.sub_category || "сервис").trim();
}

function buildSubscriptionNote(expense) {
  const notes = String(expense.notes || "").trim();
  const source = `Автоматически добавлено из расхода №${expense.id}.`;
  return notes ? `${source} ${notes}` : source;
}

async function deleteServerItem(resource, id) {
  const response = await apiFetch(`/api/${resource}/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("Сервер вернул некорректный ответ.");
  }

  if (!response.ok) {
    throw new Error(data?.error || "Не удалось удалить запись.");
  }

  return data;
}

async function materializeRecurringExpenses() {
  const response = await apiFetch("/api/materialize-recurring-expenses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ date: new Date().toISOString().slice(0, 10) }),
  });

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("Сервер вернул некорректный ответ.");
  }

  if (!response.ok || !Array.isArray(data)) {
    throw new Error(data?.error || "Не удалось создать расходы из подписок.");
  }

  return data.map(sanitizeExpense);
}

async function resetServerData() {
  const response = await apiFetch("/api/reset-data", {
    method: "POST",
  });

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("Сервер вернул некорректный ответ.");
  }

  if (!response.ok) {
    throw new Error(data?.error || "Не удалось сбросить серверные данные.");
  }

  return data;
}

async function normalizeExpense(payload) {
  const response = await apiFetch("/api/normalize-expense", {
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
  const response = await apiFetch("/api/expenses");

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

async function fetchIncomes() {
  const response = await apiFetch("/api/incomes");

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("Не удалось прочитать список доходов с сервера.");
  }

  if (!response.ok || !Array.isArray(data)) {
    throw new Error(data?.error || "Не удалось загрузить доходы с сервера.");
  }

  return data.map(sanitizeIncome).sort(sortByDateDesc);
}

async function fetchCryptoAssets() {
  const response = await apiFetch("/api/crypto-assets");

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("Не удалось прочитать список крипто активов с сервера.");
  }

  if (!response.ok || !Array.isArray(data)) {
    throw new Error(data?.error || "Не удалось загрузить крипто активы с сервера.");
  }

  return data.map(sanitizeCryptoAsset).sort(sortByDateDesc);
}

async function fetchRecurringExpenses() {
  const response = await apiFetch("/api/recurring-expenses");

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("Не удалось прочитать список подписок с сервера.");
  }

  if (!response.ok || !Array.isArray(data)) {
    throw new Error(data?.error || "Не удалось загрузить подписки с сервера.");
  }

  return data.map(sanitizeRecurringExpense).sort(sortByStartDateDesc);
}

async function fetchCryptoPrices(ids) {
  if (!ids.length) {
    return {};
  }

  const response = await apiFetch(`/api/crypto-prices?ids=${encodeURIComponent(ids.join(","))}`);

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("Не удалось прочитать цены крипты с сервера.");
  }

  if (!response.ok || !data || typeof data !== "object") {
    throw new Error(data?.error || "Не удалось загрузить цены крипты.");
  }

  return data;
}

async function syncExpensesOnLoad() {
  isInitialSyncing = !expenses.length && !incomes.length && !cryptoAssets.length && !recurringExpenses.length;
  if (isInitialSyncing) {
    render();
  }
  setSyncState("loading", "Синхронизация с сервером...");
  setStatus("Загружаю данные с сервера...");
  setIncomeStatus("Загружаю доходы с сервера...");
  setCryptoStatus("Загружаю крипто портфель...");
  setRecurringStatus("Загружаю подписки...");

  const [expenseSyncResult, incomeSyncResult, cryptoSyncResult, recurringSyncResult] = await Promise.allSettled([
    fetchExpenses(),
    fetchIncomes(),
    fetchCryptoAssets(),
    fetchRecurringExpenses(),
  ]);
  const syncResults = [expenseSyncResult, incomeSyncResult, cryptoSyncResult, recurringSyncResult];
  const failedSyncCount = syncResults.filter((result) => result.status === "rejected").length;
  isOfflineMode = failedSyncCount > 0;

  if (expenseSyncResult.status === "fulfilled") {
    expenses = expenseSyncResult.value;
    persistExpenses(expenses);
    setStatus("Данные синхронизированы.");
  } else {
    setStatus(expenseSyncResult.reason?.message || "Не удалось синхронизировать данные, использую локальный кеш.", true);
  }

  if (incomeSyncResult.status === "fulfilled") {
    incomes = incomeSyncResult.value;
    persistIncomes(incomes);
    setIncomeStatus("Доходы синхронизированы.");
  } else {
    setIncomeStatus(incomeSyncResult.reason?.message || "Не удалось синхронизировать доходы, использую локальный кеш.", true);
  }

  if (cryptoSyncResult.status === "fulfilled") {
    cryptoAssets = cryptoSyncResult.value;
    persistCryptoAssets(cryptoAssets);
    setCryptoStatus("Крипто портфель синхронизирован.");
  } else {
    setCryptoStatus(cryptoSyncResult.reason?.message || "Не удалось синхронизировать крипто портфель.", true);
  }

  if (recurringSyncResult.status === "fulfilled") {
    recurringExpenses = recurringSyncResult.value;
    persistRecurringExpenses(recurringExpenses);
    setRecurringStatus("Подписки синхронизированы.");
  } else {
    setRecurringStatus(recurringSyncResult.reason?.message || "Не удалось синхронизировать подписки.", true);
  }

  visibleWeekStart = getStartOfWeek(getLatestExpenseDate(expenses));
  visibleMonthDate = getStartOfMonth(getLatestFinancialDate(expenses, incomes));
  isInitialSyncing = false;
  syncFilterOptions();
  render();
  setSyncState(isOfflineMode ? "offline" : "online", isOfflineMode ? "Локальный кеш" : "Сервер подключен");
  refreshCryptoPrices();
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

function loadIncomes() {
  try {
    const raw = localStorage.getItem(INCOME_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map(sanitizeIncome).sort(sortByDateDesc);
  } catch {
    return [];
  }
}

function loadCryptoAssets() {
  try {
    const raw = localStorage.getItem(CRYPTO_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map(sanitizeCryptoAsset).sort(sortByDateDesc);
  } catch {
    return [];
  }
}

function loadRecurringExpenses() {
  try {
    const raw = localStorage.getItem(RECURRING_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map(sanitizeRecurringExpense).sort(sortByStartDateDesc);
  } catch {
    return [];
  }
}

function persistExpenses(nextExpenses) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextExpenses));
}

function persistIncomes(nextIncomes) {
  localStorage.setItem(INCOME_STORAGE_KEY, JSON.stringify(nextIncomes));
}

function persistCryptoAssets(nextCryptoAssets) {
  localStorage.setItem(CRYPTO_STORAGE_KEY, JSON.stringify(nextCryptoAssets));
}

function persistRecurringExpenses(nextRecurringExpenses) {
  localStorage.setItem(RECURRING_STORAGE_KEY, JSON.stringify(nextRecurringExpenses));
}

function upsertExpense(currentExpenses, incomingExpense) {
  const withoutCurrent = currentExpenses.filter((item) => item.id !== incomingExpense.id);
  return [...withoutCurrent, incomingExpense].sort(sortByDateDesc);
}

function upsertIncome(currentIncomes, incomingIncome) {
  const withoutCurrent = currentIncomes.filter((item) => item.id !== incomingIncome.id);
  return [...withoutCurrent, incomingIncome].sort(sortByDateDesc);
}

function upsertCryptoAsset(currentCryptoAssets, incomingCryptoAsset) {
  const withoutCurrent = currentCryptoAssets.filter((item) => item.id !== incomingCryptoAsset.id);
  return [...withoutCurrent, incomingCryptoAsset].sort(sortByDateDesc);
}

function upsertRecurringExpense(currentRecurringExpenses, incomingRecurringExpense) {
  const withoutCurrent = currentRecurringExpenses.filter((item) => item.id !== incomingRecurringExpense.id);
  return [...withoutCurrent, incomingRecurringExpense].sort(sortByStartDateDesc);
}

function mergeExpenses(primaryExpenses, fallbackExpenses) {
  const merged = new Map();

  for (const expense of [...fallbackExpenses, ...primaryExpenses]) {
    const safeExpense = sanitizeExpense(expense);
    merged.set(safeExpense.id, safeExpense);
  }

  return [...merged.values()].sort(sortByDateDesc);
}

function mergeIncomes(primaryIncomes, fallbackIncomes) {
  const merged = new Map();

  for (const income of [...fallbackIncomes, ...primaryIncomes]) {
    const safeIncome = sanitizeIncome(income);
    merged.set(safeIncome.id, safeIncome);
  }

  return [...merged.values()].sort(sortByDateDesc);
}

function mergeCryptoAssets(primaryCryptoAssets, fallbackCryptoAssets) {
  const merged = new Map();

  for (const cryptoAsset of [...fallbackCryptoAssets, ...primaryCryptoAssets]) {
    const safeCryptoAsset = sanitizeCryptoAsset(cryptoAsset);
    merged.set(safeCryptoAsset.id, safeCryptoAsset);
  }

  return [...merged.values()].sort(sortByDateDesc);
}

function mergeRecurringExpenses(primaryRecurringExpenses, fallbackRecurringExpenses) {
  const merged = new Map();
  for (const recurringExpense of [...fallbackRecurringExpenses, ...primaryRecurringExpenses]) {
    const safeRecurringExpense = sanitizeRecurringExpense(recurringExpense);
    merged.set(safeRecurringExpense.id, safeRecurringExpense);
  }

  return [...merged.values()].sort(sortByStartDateDesc);
}

function sanitizeExpense(expense) {
  const safeExpense = expense || {};

  return {
    id: Number(safeExpense.id) || Date.now(),
    date: String(safeExpense.date || ""),
    amount: Number(safeExpense.amount) || 0,
    quantity: normalizeQuantityValue(safeExpense.quantity),
    currency: String(safeExpense.currency || "UAH"),
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

function sanitizeIncome(income) {
  const safeIncome = income || {};

  return {
    id: Number(safeIncome.id) || Date.now(),
    date: String(safeIncome.date || ""),
    amount: Number(safeIncome.amount) || 0,
    currency: String(safeIncome.currency || "UAH"),
    source: String(safeIncome.source || ""),
    notes: String(safeIncome.notes || ""),
  };
}

function sanitizeCryptoAsset(cryptoAsset) {
  const safeCryptoAsset = cryptoAsset || {};

  return {
    id: Number(safeCryptoAsset.id) || Date.now(),
    name: String(safeCryptoAsset.name || ""),
    symbol: String(safeCryptoAsset.symbol || "").toUpperCase(),
    coingecko_id: String(safeCryptoAsset.coingecko_id || "").toLowerCase(),
    amount_held: Number(safeCryptoAsset.amount_held) || 0,
    invested_amount: Number(safeCryptoAsset.invested_amount) || 0,
    currency: String(safeCryptoAsset.currency || "UAH"),
    notes: String(safeCryptoAsset.notes || ""),
    updated_at: String(safeCryptoAsset.updated_at || ""),
  };
}

function sanitizeRecurringExpense(recurringExpense) {
  const safeRecurringExpense = recurringExpense || {};
  const frequency = String(safeRecurringExpense.frequency || "monthly");

  return {
    id: Number(safeRecurringExpense.id) || Date.now(),
    start_date: String(safeRecurringExpense.start_date || new Date().toISOString().slice(0, 10)),
    amount: Number((Number(safeRecurringExpense.amount) || 0).toFixed(2)),
    currency: String(safeRecurringExpense.currency || "UAH"),
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

function sortByDateDesc(left, right) {
  return compareByDateWithTieBreaker(left, right, "desc");
}

function sortByStartDateDesc(left, right) {
  const leftDate = String(left?.start_date || "");
  const rightDate = String(right?.start_date || "");
  if (leftDate !== rightDate) {
    return rightDate.localeCompare(leftDate);
  }

  return (Number(right?.id) || 0) - (Number(left?.id) || 0);
}

function render() {
  filteredExpenses = sortExpenses(applyFilters(expenses));
  renderLatestExpenses();
  renderSummary();
  renderIncomeView();
  renderCryptoView();
  renderRecurringView();
  renderTable();
  renderCharts();
  renderSortState();
}

function renderLatestExpenses() {
  if (!latestExpenseCount || !latestExpenseList) {
    return;
  }

  const latestExpenses = [...expenses].sort(sortByDateDesc).slice(0, 4);
  latestExpenseCount.textContent = String(expenses.length);
  if (latestExpenseCountLabel) {
    latestExpenseCountLabel.textContent = formatRecordCountLabel(expenses.length);
  }
  if (latestExpenseHint) {
    latestExpenseHint.textContent = getLatestExpenseHint(latestExpenses.length);
  }

  if (!latestExpenses.length) {
    latestExpenseList.innerHTML = '<p class="latest-empty">Пока нет записей. Первая трата появится здесь.</p>';
    return;
  }

  latestExpenseList.innerHTML = latestExpenses
    .map((expense, index) => {
      const title = getExpenseShortTitle(expense);
      const meta = [formatShortIsoDate(expense.date), formatCategoryLabel(expense.category)]
        .filter(Boolean)
        .join(" · ");

      return `
        <article class="latest-expense-card">
          <span class="latest-expense-index">${String(index + 1).padStart(2, "0")}</span>
          <div>
            <strong>${escapeHtml(shortenText(title, 28))}</strong>
            <small>${escapeHtml(meta || "Без категории")}</small>
          </div>
          <b>${escapeHtml(expense.amount.toFixed(2))} ${escapeHtml(expense.currency)}</b>
        </article>
      `;
    })
    .join("");
}

function renderSummary() {
  if (isInitialSyncing) {
    renderStatSkeleton(totalAmountNode, "170px");
    renderStatSkeleton(expenseCountNode, "130px");
    renderStatSkeleton(latestExpenseCount, "54px");
    monthlyWeekBreakdown.innerHTML = '<span class="skeleton-line"></span><span class="skeleton-line skeleton-line-short"></span>';
    monthlySparkline.innerHTML = '<span class="skeleton-line"></span>';
    monthLabel.textContent = formatMonthLabel(visibleMonthDate);
    return;
  }

  clearStatSkeleton(totalAmountNode, expenseCountNode, latestExpenseCount);
  const monthlySummary = buildMonthlySummary(expenses, visibleMonthDate);
  totalAmountNode.textContent = `${monthlySummary.total.toFixed(2)} UAH`;
  expenseCountNode.textContent = `${monthlySummary.count} записей за месяц`;
  monthLabel.textContent = formatMonthLabel(visibleMonthDate);
  monthlyWeekBreakdown.innerHTML = renderMonthlyWeeks(monthlySummary.weeks);
  renderMonthlySparkline(monthlySummary.dailyTotals);

  const latestMonth = getStartOfMonth(getLatestExpenseDate(expenses));
  nextMonthButton.disabled = visibleMonthDate.getTime() >= latestMonth.getTime();
}

function renderIncomeView() {
  if (isInitialSyncing) {
    renderStatSkeleton(monthlyIncomeAmount, "160px");
    renderStatSkeleton(monthlyExpenseMirror, "110px");
    renderStatSkeleton(monthlyBalanceAmount, "120px");
    renderStatSkeleton(incomeCount, "150px");
    renderIncomeTable();
    return;
  }

  clearStatSkeleton(monthlyIncomeAmount, monthlyExpenseMirror, monthlyBalanceAmount, incomeCount);
  const monthlyIncomeSummary = buildMonthlyIncomeSummary(incomes, visibleMonthDate);
  const monthlyExpenseSummary = buildMonthlySummary(expenses, visibleMonthDate);
  const balance = monthlyIncomeSummary.total - monthlyExpenseSummary.total;

  if (monthlyIncomeAmount) {
    monthlyIncomeAmount.textContent = `${monthlyIncomeSummary.total.toFixed(2)} UAH`;
  }
  if (monthlyExpenseMirror) {
    monthlyExpenseMirror.textContent = `${monthlyExpenseSummary.total.toFixed(2)} UAH`;
  }
  if (monthlyBalanceAmount) {
    monthlyBalanceAmount.textContent = `${balance.toFixed(2)} UAH`;
    monthlyBalanceAmount.classList.toggle("negative-balance", balance < 0);
  }
  if (incomeCount) {
    incomeCount.textContent = `${monthlyIncomeSummary.count} ${formatIncomeCountLabel(monthlyIncomeSummary.count)} за месяц`;
  }

  renderIncomeTable();
}

function formatSubscriptionCountLabel(count) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) {
    return "активная подписка";
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return "активные подписки";
  }

  return "активных подписок";
}

function renderStatSkeleton(node, width) {
  if (!node) {
    return;
  }

  node.textContent = "";
  node.classList.add("skeleton-stat");
  node.style.setProperty("--skeleton-width", width);
}

function clearStatSkeleton(...nodes) {
  for (const node of nodes.filter(Boolean)) {
    node.classList.remove("skeleton-stat");
    node.style.removeProperty("--skeleton-width");
  }
}

function renderIncomeTable() {
  if (!incomesTableBody) {
    return;
  }

  incomesTableBody.innerHTML = "";

  if (isInitialSyncing) {
    renderSkeletonRows(incomesTableBody, 6, 3);
    return;
  }

  if (!incomes.length) {
    renderEmptyTableState(incomesTableBody, 6, "Доходов пока нет", "Добавьте зарплату, возврат или подарок, чтобы увидеть чистый баланс месяца.", "Добавить доход", "incomes");
    return;
  }

  for (const income of [...incomes].sort(sortByDateDesc)) {
    const row = document.createElement("tr");
    if (income.id === recentlySavedIncomeId) {
      row.classList.add("row-success-pulse");
    }
    row.innerHTML = `
      <td>${escapeHtml(String(income.id))}</td>
      <td>${escapeHtml(income.date)}</td>
      <td>${escapeHtml(income.amount.toFixed(2))} ${escapeHtml(income.currency)}</td>
      <td>${escapeHtml(toDisplayCase(income.source))}</td>
      <td>${escapeHtml(income.notes ? toDisplayCase(income.notes) : "—")}</td>
      <td class="table-actions-cell">
        <button type="button" class="table-icon-button table-action-edit" data-edit-income-id="${escapeHtml(String(income.id))}" aria-label="Редактировать доход"></button>
        <button type="button" class="table-icon-button table-danger-button table-action-delete" data-delete-income-id="${escapeHtml(String(income.id))}" aria-label="Удалить доход"></button>
      </td>
    `;
    incomesTableBody.appendChild(row);
  }
}

function renderCryptoView() {
  if (!cryptoTableBody) {
    return;
  }

  if (isInitialSyncing) {
    renderStatSkeleton(cryptoCurrentValue, "170px");
    renderStatSkeleton(cryptoInvestedValue, "110px");
    renderStatSkeleton(cryptoProfitValue, "110px");
    renderStatSkeleton(cryptoReturnPercent, "80px");
    renderCryptoTable([]);
    return;
  }

  clearStatSkeleton(cryptoCurrentValue, cryptoInvestedValue, cryptoProfitValue, cryptoReturnPercent);

  const portfolioRows = cryptoAssets.map(buildCryptoPortfolioRow);
  const investedTotal = cryptoAssets.reduce((sum, asset) => sum + asset.invested_amount, 0);
  const pricedRows = portfolioRows.filter((row) => row.hasPrice);
  const pricedInvestedTotal = pricedRows.reduce((sum, row) => sum + row.asset.invested_amount, 0);
  const currentTotal = pricedRows.reduce((sum, row) => sum + row.currentValue, 0);
  const profitTotal = currentTotal - pricedInvestedTotal;
  const returnPercent = pricedInvestedTotal > 0 ? (profitTotal / pricedInvestedTotal) * 100 : 0;

  cryptoCurrentValue.textContent = `${currentTotal.toFixed(2)} UAH`;
  cryptoInvestedValue.textContent = `${investedTotal.toFixed(2)} UAH`;
  cryptoProfitValue.textContent = pricedRows.length ? `${formatSignedAmount(profitTotal)} UAH` : "—";
  cryptoProfitValue.classList.toggle("negative-balance", profitTotal < 0);
  cryptoReturnPercent.textContent = pricedRows.length ? `${formatSignedAmount(returnPercent)}%` : "—";
  cryptoReturnPercent.classList.toggle("negative-balance", returnPercent < 0);

  renderCryptoTable(portfolioRows);
}

function renderCryptoTable(portfolioRows) {
  cryptoTableBody.innerHTML = "";

  if (isInitialSyncing) {
    renderSkeletonRows(cryptoTableBody, 8, 3);
    return;
  }

  if (!portfolioRows.length) {
    renderEmptyTableState(cryptoTableBody, 8, "Крипто портфель пуст", "Добавьте монету и вложенную сумму, а SpendSoul подтянет live-цену.", "Добавить позицию", "crypto");
    return;
  }

  for (const rowData of portfolioRows) {
    const row = document.createElement("tr");
    if (rowData.asset.id === recentlySavedCryptoAssetId) {
      row.classList.add("row-success-pulse");
    }
    row.innerHTML = `
      <td>${escapeHtml(rowData.asset.symbol)} · ${escapeHtml(rowData.asset.name)}</td>
      <td>${escapeHtml(formatCryptoAmount(rowData.asset.amount_held))}</td>
      <td>${escapeHtml(rowData.price ? `${rowData.price.toFixed(2)} UAH` : "нет цены")}</td>
      <td>${rowData.hasPrice ? `${escapeHtml(rowData.currentValue.toFixed(2))} UAH` : "—"}</td>
      <td>${escapeHtml(rowData.asset.invested_amount.toFixed(2))} UAH</td>
      <td class="${rowData.profit < 0 ? "negative-cell" : "positive-cell"}">${rowData.hasPrice ? `${escapeHtml(formatSignedAmount(rowData.profit))} UAH` : "—"}</td>
      <td>${escapeHtml(rowData.asset.notes ? toDisplayCase(rowData.asset.notes) : "—")}</td>
      <td class="table-actions-cell">
        <button type="button" class="table-icon-button table-action-edit" data-edit-crypto-id="${escapeHtml(String(rowData.asset.id))}" aria-label="Редактировать позицию"></button>
        <button type="button" class="table-icon-button table-danger-button table-action-delete" data-delete-crypto-id="${escapeHtml(String(rowData.asset.id))}" aria-label="Удалить позицию"></button>
      </td>
    `;
    cryptoTableBody.appendChild(row);
  }
}

function renderRecurringView() {
  if (!recurringTableBody) {
    return;
  }

  if (isInitialSyncing) {
    renderStatSkeleton(recurringMonthlyAmount, "160px");
    renderStatSkeleton(recurringCount, "140px");
    recurringTableBody.innerHTML = "";
    renderSkeletonRows(recurringTableBody, 9, 3);
    return;
  }

  clearStatSkeleton(recurringMonthlyAmount, recurringCount);

  const activeRecurringExpenses = recurringExpenses.filter((item) => item.active);
  const monthlyAmount = activeRecurringExpenses.reduce((sum, item) => {
    const multiplier = item.frequency === "weekly" ? 4.345 : 1;
    return sum + item.amount * multiplier;
  }, 0);

  recurringMonthlyAmount.textContent = `${monthlyAmount.toFixed(2)} UAH`;
  recurringCount.textContent = `${activeRecurringExpenses.length} ${formatSubscriptionCountLabel(activeRecurringExpenses.length)}`;
  recurringTableBody.innerHTML = "";

  if (isInitialSyncing) {
    renderSkeletonRows(recurringTableBody, 9, 3);
    return;
  }

  if (!recurringExpenses.length) {
    renderEmptyTableState(recurringTableBody, 9, "Подписок пока нет", "Добавьте регулярный платеж вручную или сохраните расход с категорией подписки.", "Добавить подписку", "recurring");
    return;
  }

  for (const recurringExpense of [...recurringExpenses].sort(sortByStartDateDesc)) {
    const row = document.createElement("tr");
    if (recurringExpense.id === recentlySavedRecurringExpenseId) {
      row.classList.add("row-success-pulse");
    }
    row.innerHTML = `
      <td>${escapeHtml(String(recurringExpense.id))}</td>
      <td>${escapeHtml(recurringExpense.start_date)}</td>
      <td>${escapeHtml(recurringExpense.amount.toFixed(2))} ${escapeHtml(recurringExpense.currency)}</td>
      <td>${escapeHtml(toDisplayCase(recurringExpense.description_raw))}</td>
      <td>${escapeHtml(recurringExpense.frequency === "weekly" ? "Неделя" : "Месяц")}</td>
      <td>${escapeHtml(formatCategoryLabel(recurringExpense.category))}</td>
      <td>${escapeHtml(formatForWhomLabel(recurringExpense.for_whom))}</td>
      <td>${escapeHtml(recurringExpense.active ? "Активна" : "Отключена")}</td>
      <td class="table-actions-cell">
        <button type="button" class="table-icon-button ${recurringExpense.active ? "table-action-pause" : "table-action-restore"}" data-toggle-recurring-id="${escapeHtml(String(recurringExpense.id))}" aria-label="${recurringExpense.active ? "Отключить подписку" : "Вернуть подписку"}"></button>
        <button type="button" class="table-icon-button table-action-edit" data-edit-recurring-id="${escapeHtml(String(recurringExpense.id))}" aria-label="Редактировать подписку"></button>
        <button type="button" class="table-icon-button table-danger-button table-action-delete" data-delete-recurring-id="${escapeHtml(String(recurringExpense.id))}" aria-label="Удалить подписку"></button>
      </td>
    `;
    recurringTableBody.appendChild(row);
  }
}

function buildCryptoPortfolioRow(asset) {
  const priceData = cryptoPrices[asset.coingecko_id] || {};
  const price = Number(priceData.uah) || 0;
  const hasPrice = price > 0;
  const currentValue = hasPrice ? Number((asset.amount_held * price).toFixed(2)) : 0;
  const profit = hasPrice ? Number((currentValue - asset.invested_amount).toFixed(2)) : 0;

  return {
    asset,
    price,
    hasPrice,
    currentValue,
    profit,
  };
}

function renderTable() {
  tableBody.innerHTML = "";

  if (isInitialSyncing) {
    renderSkeletonRows(tableBody, 12, 4);
    return;
  }

  if (filteredExpenses.length === 0) {
    renderEmptyTableState(
      tableBody,
      12,
      expenses.length ? "Ничего не найдено" : "Расходов пока нет",
      expenses.length ? "Попробуйте сбросить фильтры или поиск." : "Добавьте первую трату, и здесь появится нормализованная история.",
      "Добавить трату",
      "expenses",
    );
    return;
  }

  for (const expense of filteredExpenses) {
    const row = document.createElement("tr");
    if (expense.id === recentlySavedExpenseId) {
      row.classList.add("row-success-pulse");
    }
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
      <td class="table-actions-cell">
        <button type="button" class="table-icon-button table-danger-button table-action-delete" data-delete-expense-id="${escapeHtml(String(expense.id))}" aria-label="Удалить запись"></button>
      </td>
    `;
    tableBody.appendChild(row);
  }
}

function renderSkeletonRows(targetBody, colSpan, count) {
  targetBody.innerHTML = Array.from({ length: count }, (_, index) => {
    const width = 54 + ((index * 17) % 36);
    return `
      <tr class="skeleton-row">
        <td colspan="${colSpan}">
          <span class="skeleton-line" style="width: ${width}%"></span>
          <span class="skeleton-line skeleton-line-short"></span>
        </td>
      </tr>
    `;
  }).join("");
}

function renderEmptyTableState(targetBody, colSpan, title, copy, actionLabel, viewTarget) {
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.colSpan = colSpan;
  cell.innerHTML = `
    <div class="empty-state">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(copy)}</span>
      <button type="button" class="ghost-button empty-state-action" data-empty-view-target="${escapeHtml(viewTarget)}">${escapeHtml(actionLabel)}</button>
    </div>
  `;
  row.appendChild(cell);
  targetBody.appendChild(row);
}

function renderCharts() {
  const categoryData = aggregateBy("category");
  const forWhomData = aggregateBy("for_whom");
  const timelineData = aggregateByVisibleWeek();
  const isSoulMode = document.body.dataset.soulMode === "on";
  const chartColors = isSoulMode
    ? ["#6ee7f9", "#ff4f8b", "#facc15", "#7c3aed", "#22c55e", "#fb7185"]
    : ["#4285f4", "#ea4335", "#fbbc05", "#34a853", "#7aa2ff", "#ff6b4a"];
  const timelineColor = isSoulMode ? "#6ee7f9" : "#4285f4";

  categoryChart = renderPieChart(categoryChart, "#categoryChart", categoryData, chartColors);
  forWhomChart = renderPieChart(forWhomChart, "#forWhomChart", forWhomData, chartColors);
  timelineChart = renderBarChart(timelineChart, "#timelineChart", timelineData, timelineColor);
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

function buildMonthlyIncomeSummary(sourceIncomes, monthDate) {
  const startOfMonth = getStartOfMonth(monthDate);
  const endOfMonth = getEndOfMonth(startOfMonth);
  const monthlyIncomes = sourceIncomes.filter((income) => {
    const incomeDate = new Date(income.date || 0);
    return incomeDate >= startOfMonth && incomeDate <= endOfMonth;
  });

  return {
    total: Number(monthlyIncomes.reduce((sum, income) => sum + income.amount, 0).toFixed(2)),
    count: monthlyIncomes.length,
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

function formatRecordCountLabel(count) {
  const absCount = Math.abs(count);
  const lastTwoDigits = absCount % 100;
  const lastDigit = absCount % 10;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return "записей";
  }

  if (lastDigit === 1) {
    return "запись";
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return "записи";
  }

  return "записей";
}

function getLatestExpenseHint(visibleCount) {
  if (!visibleCount) {
    return "Добавьте первую трату";
  }

  if (visibleCount === 1) {
    return "Последняя трата справа";
  }

  return `Последние ${visibleCount} справа`;
}

function formatIncomeCountLabel(count) {
  const label = formatRecordCountLabel(count);

  if (label === "запись") {
    return "поступление";
  }

  if (label === "записи") {
    return "поступления";
  }

  return "поступлений";
}

function parseCryptoCoinValue(value) {
  const [coingeckoId = "", symbol = "", name = ""] = String(value || "").split("|");

  return {
    coingecko_id: coingeckoId,
    symbol,
    name,
  };
}

function formatCryptoAmount(value) {
  return Number(value || 0).toLocaleString("ru-RU", {
    maximumFractionDigits: 10,
  });
}

function formatSignedAmount(value) {
  const numericValue = Number(value) || 0;
  const prefix = numericValue > 0 ? "+" : "";
  return `${prefix}${numericValue.toFixed(2)}`;
}

function getLatestCryptoPriceUpdateTime(prices) {
  const timestamps = Object.values(prices)
    .map((price) => Number(price?.last_updated_at) || 0)
    .filter(Boolean);

  if (!timestamps.length) {
    return "";
  }

  const latestTimestamp = Math.max(...timestamps) * 1000;
  return new Date(latestTimestamp).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
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
          borderColor: "rgba(66, 133, 244, 0.36)",
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
            color: "rgba(66, 133, 244, 0.16)",
          },
          border: {
            color: "rgba(66, 133, 244, 0.28)",
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
            color: "rgba(66, 133, 244, 0.16)",
          },
          border: {
            color: "rgba(66, 133, 244, 0.28)",
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
  updateCustomSelect(selectNode);
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

function getLatestFinancialDate(sourceExpenses, sourceIncomes) {
  const datedItems = [...sourceExpenses, ...sourceIncomes].filter((item) => item?.date);

  if (!datedItems.length) {
    return new Date();
  }

  const latestItem = datedItems.sort((left, right) => compareByDateWithTieBreaker(left, right, "desc"))[0];
  return new Date(latestItem.date || Date.now());
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

function formatShortIsoDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return formatShortDate(date);
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

function getExpenseShortTitle(expense) {
  const productName = String(expense.product_name || "").trim();
  const rawDescription = String(expense.description_raw || "").trim();

  if (productName && productName.toLowerCase() !== "other") {
    return toDisplayCase(productName);
  }

  return toDisplayCase(rawDescription || "Трата");
}

function applyFilters(sourceExpenses) {
  const searchValue = normalizeSearchText(expenseSearchInput?.value || "");

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

    if (searchValue && !buildExpenseSearchText(expense).includes(searchValue)) {
      return false;
    }

    return true;
  });
}

function buildExpenseSearchText(expense) {
  return normalizeSearchText(
    [
      expense.id,
      expense.date,
      expense.amount,
      expense.description_raw,
      expense.product_name,
      expense.category,
      expense.sub_category,
      expense.sub_sub_category,
      formatForWhomLabel(expense.for_whom),
      expense.notes,
    ].join(" "),
  );
}

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(",", ".")
    .trim();
}

function setLoading(isLoading) {
  submitButton.disabled = isLoading;
  submitButton.textContent = isLoading ? "Сохраняю..." : "Сохранить";
}

function setIncomeLoading(isLoading) {
  incomeSubmitButton.disabled = isLoading;
  incomeSubmitButton.textContent = isLoading ? "Сохраняю..." : "Сохранить доход";
}

function setCryptoLoading(isLoading) {
  cryptoSubmitButton.disabled = isLoading;
  cryptoSubmitButton.textContent = isLoading ? "Сохраняю..." : "Сохранить позицию";
}

function setRecurringLoading(isLoading) {
  recurringSubmitButton.disabled = isLoading;
  recurringSubmitButton.textContent = isLoading ? "Сохраняю..." : "Сохранить подписку";
}

function celebrateExpenseSave() {
  pulseNodes(totalAmountNode, expenseCountNode, latestExpenseCount, monthlySparkline);
  scheduleRecentHighlightClear();
}

function scheduleRecentHighlightClear() {
  window.setTimeout(() => {
    recentlySavedExpenseId = null;
    recentlySavedIncomeId = null;
    recentlySavedCryptoAssetId = null;
    recentlySavedRecurringExpenseId = null;
  }, 1300);
}

function pulseNodes(...nodes) {
  for (const node of nodes.filter(Boolean)) {
    node.classList.remove("success-pulse");
    void node.offsetWidth;
    node.classList.add("success-pulse");
    window.setTimeout(() => node.classList.remove("success-pulse"), 1100);
  }
}

async function flashButtonSuccess(button, label, resetLabel) {
  if (!button) {
    return;
  }

  button.classList.add("button-success-flash");
  button.textContent = label;
  await new Promise((resolve) => window.setTimeout(resolve, 700));
  button.classList.remove("button-success-flash");
  button.textContent = resetLabel;
}

function setStatus(message, isError = false) {
  statusMessage.textContent = getInlineStatusMessage(message, isError);
  statusMessage.classList.toggle("error", isError);
  maybeShowStatusToast(message, isError);
}

function setIncomeStatus(message, isError = false) {
  incomeStatusMessage.textContent = getInlineStatusMessage(message, isError);
  incomeStatusMessage.classList.toggle("error", isError);
  maybeShowStatusToast(message, isError);
}

function setCryptoStatus(message, isError = false) {
  cryptoStatusMessage.textContent = getInlineStatusMessage(message, isError);
  cryptoStatusMessage.classList.toggle("error", isError);
  maybeShowStatusToast(message, isError);
}

function setRecurringStatus(message, isError = false) {
  recurringStatusMessage.textContent = getInlineStatusMessage(message, isError);
  recurringStatusMessage.classList.toggle("error", isError);
  maybeShowStatusToast(message, isError);
}

function getInlineStatusMessage(message, isError) {
  if (!message || isError || isToastSuccessMessage(message)) {
    return "";
  }

  return message;
}

function maybeShowStatusToast(message, isError) {
  if (!message) {
    return;
  }

  const normalized = normalizeSearchText(message);
  if (normalized.includes("локальный кеш")) {
    return;
  }

  const isSuccess = isToastSuccessMessage(message);
  if (isError || isSuccess) {
    showToast(message, isError ? "error" : "success");
  }
}

function isToastSuccessMessage(message) {
  return /сохран|удален|удалена|очищен|добавлена|создано|активна|отключена|обновлена/.test(normalizeSearchText(message));
}

function showToast(message, type = "success") {
  let host = document.querySelector("#toastHost");
  if (!host) {
    host = document.createElement("div");
    host.id = "toastHost";
    host.className = "toast-host";
    host.setAttribute("aria-live", "polite");
    document.body.append(host);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  host.append(toast);
  window.setTimeout(() => toast.classList.add("toast-visible"), 20);
  window.setTimeout(() => {
    toast.classList.remove("toast-visible");
    window.setTimeout(() => toast.remove(), 180);
  }, 2800);
}

function setSyncState(state, message) {
  if (!syncBanner) {
    return;
  }

  syncBanner.textContent = message;
  syncBanner.dataset.state = state;
}

async function refreshCryptoPrices() {
  const ids = [...new Set(cryptoAssets.map((asset) => asset.coingecko_id).filter(Boolean))];

  if (!ids.length) {
    cryptoPrices = {};
    cryptoPriceStatus.textContent = "Добавьте первую монету";
    renderCryptoView();
    return;
  }

  refreshCryptoPricesButton.disabled = true;
  cryptoPriceStatus.textContent = "Обновляю цены...";

  try {
    cryptoPrices = await fetchCryptoPrices(ids);
    const updatedAt = getLatestCryptoPriceUpdateTime(cryptoPrices);
    cryptoPriceStatus.textContent = updatedAt ? `Цены обновлены ${updatedAt}` : "Цены обновлены";
    renderCryptoView();
  } catch (error) {
    setCryptoStatus(error.message || "Не удалось обновить цены крипты.", true);
    cryptoPriceStatus.textContent = "Цены недоступны";
    renderCryptoView();
  } finally {
    refreshCryptoPricesButton.disabled = false;
  }
}

async function handleConfirmSave() {
  if (!pendingExpense) {
    return;
  }

  if (blockOfflineWrite(setStatus)) {
    return;
  }

  pendingExpense = readConfirmEditorValue();

  confirmSaveButton.disabled = true;
  confirmSaveButton.textContent = "Сохраняю...";

  try {
    const currentMode = pendingMode;
    const savedExpense = await saveExpenseRecord(pendingExpense, currentMode);
    expenses = upsertExpense(expenses, savedExpense);
    const createdSubscription = currentMode === "create" ? await maybeCreateSubscriptionFromExpense(savedExpense) : null;
    visibleWeekStart = getStartOfWeek(getLatestExpenseDate(expenses));
    visibleMonthDate = getStartOfMonth(getLatestFinancialDate(expenses, incomes));
    persistExpenses(expenses);
    if (createdSubscription) {
      recurringExpenses = upsertRecurringExpense(recurringExpenses, createdSubscription);
      persistRecurringExpenses(recurringExpenses);
    }
    recentlySavedExpenseId = savedExpense.id;
    syncFilterOptions();
    render();
    celebrateExpenseSave();
    if (pendingMode === "create") {
      form.reset();
      dateInput.value = new Date().toISOString().slice(0, 10);
      quantityInput.value = "1";
    }
    await flashButtonSuccess(confirmSaveButton, "Сохранено", "Подтвердить");
    pendingExpense = null;
    pendingDecision = null;
    pendingMode = "create";
    closeConfirmDialog();
    setStatus(
      currentMode === "edit"
        ? "Запись обновлена."
        : createdSubscription
          ? "Трата сохранена, подписка добавлена."
          : "Трата сохранена.",
    );
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
  const compactFields = `
    ${renderConfirmField("Итого", "amount", String(expense.amount), { type: "number", step: "0.01", min: "0", suffix: expense.currency })}
    ${renderConfirmField("Товар", "product_name", expense.product_name)}
    ${renderConfirmField("Категория", "category", expense.category)}
    ${renderConfirmField("Для кого", "for_whom", expense.for_whom, { type: "select" })}
  `;

  const editorFields = `
    ${renderConfirmField("Дата", "date", expense.date, { type: "date" })}
    ${renderConfirmField("Итого", "amount", String(expense.amount), { type: "number", step: "0.01", min: "0", suffix: expense.currency })}
    ${renderConfirmField("Количество", "quantity", String(expense.quantity), { type: "number", step: "1", min: "1" })}
    ${renderConfirmField("Товар", "product_name", expense.product_name)}
    ${renderConfirmField("Для кого", "for_whom", expense.for_whom, { type: "select" })}
    ${renderConfirmField("Категория", "category", expense.category)}
    ${renderConfirmField("Подкатегория", "sub_category", expense.sub_category)}
    ${renderConfirmField("Описание", "description_raw", expense.description_raw, { type: "textarea", wide: true, rows: "3" })}
    ${renderConfirmField("Заметки", "notes", expense.notes, { type: "textarea", wide: true, rows: "2", emptyText: "—" })}
  `;

  confirmPreview.innerHTML = confirmEditorOpen ? editorFields : compactFields;

  if (confirmEditorOpen) {
    confirmPreview.querySelectorAll('input[type="date"]').forEach(bindNativeDatePicker);
    confirmPreview.querySelectorAll("select").forEach((selectNode) => createCustomSelect(selectNode));
  }
}

function renderDecision(decision) {
  const safeDecision = sanitizeDecision(decision);
  const items = safeDecision.details
    .filter((item) => item.field !== "sub_sub_category")
    .map((item) => `<li>${escapeHtml(item.message)}</li>`)
    .join("");

  return `
    <h3>ИИ понял так</h3>
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

function normalizeQuantityValue(value) {
  return Math.max(1, Math.trunc(Number(value) || 1));
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
