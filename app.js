import {
  ALLOWED_FOR_WHOM,
  CURRENCY_LABELS,
  FOR_WHOM_LABELS,
  SUPPORTED_CURRENCIES,
  escapeHtml,
  formatCategoryLabel,
  formatForWhomLabel,
  normalizeQuantityValue,
  normalizeCurrency,
  sanitizeCryptoAsset,
  sanitizeDecision,
  sanitizeExpense,
  sanitizeIncome,
  sanitizeRecurringExpense,
  shortenText,
  toDisplayCase,
} from "./app-utils.js";

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
const SETTINGS_STORAGE_KEY = `spendsoul-${STORAGE_OWNER_KEY}-settings`;
const EXCHANGE_RATES_STORAGE_KEY = "spendsoul-exchange-rates";
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
const resetServerHistoryButton = document.querySelector("#resetServerHistoryButton");
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
const todayTotalAmount = document.querySelector("#todayTotalAmount");
const todayLimitStatus = document.querySelector("#todayLimitStatus");
const todayLimitMeter = document.querySelector("#todayLimitMeter");
const todayExpenseCount = document.querySelector("#todayExpenseCount");
const todayIncomeAmount = document.querySelector("#todayIncomeAmount");
const todayMonthTotal = document.querySelector("#todayMonthTotal");
const todayBalanceAmount = document.querySelector("#todayBalanceAmount");
const quickExpenseForm = document.querySelector("#quickExpenseForm");
const quickEntryType = document.querySelector("#quickEntryType");
const quickExpenseInput = document.querySelector("#quickExpenseInput");
const quickInputHint = document.querySelector("#quickInputHint");
const quickExpenseSubmitButton = document.querySelector("#quickExpenseSubmitButton");
const quickExpenseStatusMessage = document.querySelector("#quickExpenseStatusMessage");
const activityTypeFilter = document.querySelector("#activityTypeFilter");
const activityFeed = document.querySelector("#activityFeed");
const viewTabs = [...document.querySelectorAll(".view-tab")];
const todayView = document.querySelector("#todayView");
const expensesView = document.querySelector("#expensesView");
const incomesView = document.querySelector("#incomesView");
const cryptoView = document.querySelector("#cryptoView");
const settingsView = document.querySelector("#settingsView");
const incomeForm = document.querySelector("#incomeForm");
const incomeFormTitle = document.querySelector("#incomeFormTitle");
const incomeFormCopy = document.querySelector("#incomeFormCopy");
const incomeFormChip = document.querySelector("#incomeFormChip");
const incomeDateInput = document.querySelector("#incomeDate");
const incomeAmountInput = document.querySelector("#incomeAmount");
const incomeCurrencyInput = document.querySelector("#incomeCurrency");
const incomeSourceInput = document.querySelector("#incomeSource");
const incomeNotesInput = document.querySelector("#incomeNotes");
const incomeSubmitButton = document.querySelector("#incomeSubmitButton");
const cancelIncomeEditButton = document.querySelector("#cancelIncomeEditButton");
const incomeStatusMessage = document.querySelector("#incomeStatusMessage");
const monthlyIncomeAmount = document.querySelector("#monthlyIncomeAmount");
const monthlyExpenseMirror = document.querySelector("#monthlyExpenseMirror");
const monthlyBalanceAmount = document.querySelector("#monthlyBalanceAmount");
const incomeCount = document.querySelector("#incomeCount");
const incomesTableBody = document.querySelector("#incomesTableBody");
const cryptoForm = document.querySelector("#cryptoForm");
const cryptoFormTitle = document.querySelector("#cryptoFormTitle");
const cryptoFormCopy = document.querySelector("#cryptoFormCopy");
const cryptoFormChip = document.querySelector("#cryptoFormChip");
const cryptoCoinInput = document.querySelector("#cryptoCoin");
const cryptoAmountHeldInput = document.querySelector("#cryptoAmountHeld");
const cryptoInvestedAmountInput = document.querySelector("#cryptoInvestedAmount");
const cryptoNotesInput = document.querySelector("#cryptoNotes");
const cryptoSubmitButton = document.querySelector("#cryptoSubmitButton");
const cancelCryptoEditButton = document.querySelector("#cancelCryptoEditButton");
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
const recurringFormTitle = document.querySelector("#recurringFormTitle");
const recurringFormCopy = document.querySelector("#recurringFormCopy");
const recurringFormChip = document.querySelector("#recurringFormChip");
const recurringStartDateInput = document.querySelector("#recurringStartDate");
const recurringAmountInput = document.querySelector("#recurringAmount");
const recurringCurrencyInput = document.querySelector("#recurringCurrency");
const recurringFrequencyInput = document.querySelector("#recurringFrequency");
const recurringForWhomInput = document.querySelector("#recurringForWhom");
const recurringDescriptionInput = document.querySelector("#recurringDescription");
const recurringCategoryInput = document.querySelector("#recurringCategory");
const recurringSubCategoryInput = document.querySelector("#recurringSubCategory");
const recurringNotesInput = document.querySelector("#recurringNotes");
const recurringSubmitButton = document.querySelector("#recurringSubmitButton");
const cancelRecurringEditButton = document.querySelector("#cancelRecurringEditButton");
const materializeRecurringButton = document.querySelector("#materializeRecurringButton");
const recurringStatusMessage = document.querySelector("#recurringStatusMessage");
const recurringMonthlyAmount = document.querySelector("#recurringMonthlyAmount");
const recurringCount = document.querySelector("#recurringCount");
const recurringTableBody = document.querySelector("#recurringTableBody");
const settingsForm = document.querySelector("#settingsForm");
const dailyLimitInput = document.querySelector("#dailyLimitInput");
const monthlyLimitInput = document.querySelector("#monthlyLimitInput");
const categoryCatalogInput = document.querySelector("#categoryCatalogInput");
const categoryRenameFromInput = document.querySelector("#categoryRenameFromInput");
const categoryRenameToInput = document.querySelector("#categoryRenameToInput");
const categoryRenameButton = document.querySelector("#categoryRenameButton");
const defaultCurrencyInput = document.querySelector("#defaultCurrencyInput");
const displayCurrencyInput = document.querySelector("#displayCurrencyInput");
const settingsSubmitButton = document.querySelector("#settingsSubmitButton");
const refreshExchangeRatesButton = document.querySelector("#refreshExchangeRatesButton");
const exchangeRateStatusMessage = document.querySelector("#exchangeRateStatusMessage");
const settingsStatusMessage = document.querySelector("#settingsStatusMessage");
const monthlyLimitProgress = document.querySelector("#monthlyLimitProgress");
const monthlyLimitStatus = document.querySelector("#monthlyLimitStatus");
const settingsTodayTotal = document.querySelector("#settingsTodayTotal");
const settingsMonthTotal = document.querySelector("#settingsMonthTotal");
const categoryCatalogList = document.querySelector("#categoryCatalogList");
const expenseSearchInput = document.querySelector("#expenseSearchInput");
const syncBanner = document.querySelector("#syncBanner");
const quickAddButton = document.querySelector("#quickAddButton");
const quickSheetOverlay = document.querySelector("#quickSheetOverlay");
const quickSheetCloseButton = document.querySelector("#quickSheetCloseButton");
const themeToggleButton = document.querySelector("#themeToggleButton");
const brandTitle = document.querySelector(".brand-title");

let categoryChart;
let forWhomChart;
let timelineChart;
let expenses = loadExpenses();
let incomes = loadIncomes();
let cryptoAssets = loadCryptoAssets();
let recurringExpenses = loadRecurringExpenses();
let appSettings = loadSettings();
let exchangeRates = loadExchangeRates();
let cryptoPrices = {};
let filteredExpenses = [...expenses];
let isOfflineMode = false;
let pendingExpense = null;
let pendingDecision = null;
let pendingMode = "create";
let isInitialSyncing = false;
let suppressStatusToasts = true;
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
incomeCurrencyInput.value = appSettings.default_currency;
recurringCurrencyInput.value = appSettings.default_currency;
initializeTheme();
initializeSoulMode();
initializeTelegramApp();
registerServiceWorker();
if (hasTelegramAuth()) {
  syncExpensesOnLoad();
} else {
  isOfflineMode = true;
  setSyncState("offline", "Войдите через Telegram");
  setStatus("Войдите через @spendsoul_bot, чтобы загрузить ваши расходы.", true);
  setIncomeStatus("Войдите через Telegram, чтобы загрузить доходы.", true);
  setCryptoStatus("Войдите через Telegram, чтобы загрузить крипто портфель.", true);
  setRecurringStatus("Войдите через Telegram, чтобы загрузить подписки.", true);
  setSettingsStatus("Войдите через Telegram, чтобы синхронизировать настройки.", true);
}
render();
renderTelegramLoginGate();
resumeBotLoginFromUrl();
window.setTimeout(() => {
  suppressStatusToasts = false;
}, 600);

form.addEventListener("submit", handleSubmit);
quickExpenseForm?.addEventListener("submit", handleQuickExpenseSubmit);
quickEntryType?.addEventListener("change", handleQuickEntryTypeChange);
activityTypeFilter?.addEventListener("change", renderActivityFeed);
incomeForm.addEventListener("submit", handleIncomeSubmit);
cryptoForm.addEventListener("submit", handleCryptoSubmit);
recurringForm.addEventListener("submit", handleRecurringSubmit);
cancelIncomeEditButton?.addEventListener("click", cancelIncomeEdit);
cancelCryptoEditButton?.addEventListener("click", cancelCryptoEdit);
cancelRecurringEditButton?.addEventListener("click", cancelRecurringEdit);
settingsForm?.addEventListener("submit", handleSettingsSubmit);
refreshExchangeRatesButton?.addEventListener("click", handleRefreshExchangeRates);
categoryRenameButton?.addEventListener("click", handleCategoryRename);
clearLocalButton?.addEventListener("click", handleClearLocalStorage);
resetServerButton?.addEventListener("click", handleResetServerData);
resetServerHistoryButton?.addEventListener("click", handleResetServerHistory);
refreshCryptoPricesButton.addEventListener("click", refreshCryptoPrices);
materializeRecurringButton?.addEventListener("click", handleMaterializeRecurring);
quickAddButton.addEventListener("click", handleQuickAdd);
quickSheetOverlay?.addEventListener("click", closeQuickAddSheet);
quickSheetCloseButton?.addEventListener("click", closeQuickAddSheet);
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
document.addEventListener("keydown", handleDocumentKeydown);
themeToggleButton.addEventListener("click", toggleTheme);
brandTitle?.addEventListener("click", handleBrandTitleClick);

[dateInput, incomeDateInput, dateFromFilter, dateToFilter, recurringStartDateInput].forEach(bindNativeDatePicker);
initializeCustomSelects();
handleQuickEntryTypeChange();
updateEditorStates();

function blockOfflineWrite(setter) {
  if (!isOfflineMode) {
    return false;
  }

  setter("Сервер недоступен: показан локальный кеш, изменения временно отключены. Обновите страницу после восстановления связи.", true);
  return true;
}

function initializeTelegramApp() {
  const webApp = window.Telegram?.WebApp;
  if (!webApp) {
    return;
  }

  if (webApp.initData) {
    document.body.dataset.telegramApp = "true";
  }

  webApp.ready();
  webApp.expand();
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

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || !["https:", "http:"].includes(window.location.protocol)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
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
        <img class="brand-mark telegram-login-mark" src="./icons/spendsoul-icon.svg" alt="SpendSoul" />
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

  showBotLoginPollingState(pendingLogin);
}

function resumeBotLoginFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const nonce = sanitizeBotLoginNonce(params.get("login_nonce") || hashParams.get("login_nonce"));
  if (!nonce || hasTelegramAuth()) {
    return;
  }

  const pendingLogin = {
    nonce,
    expires_at: Math.floor(Date.now() / 1000) + 120,
    bot_url: `https://t.me/${TELEGRAM_BOT_USERNAME}?start=login_${nonce}`,
  };
  rememberPendingBotLogin(pendingLogin);
  renderTelegramLoginGate();
  showBotLoginPollingState(pendingLogin, "Проверяю подтверждение Telegram...");

  params.delete("login_nonce");
  hashParams.delete("login_nonce");
  const nextSearch = params.toString();
  const nextHash = hashParams.toString();
  const cleanUrl = `${window.location.origin}${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${nextHash ? `#${nextHash}` : ""}`;
  window.history.replaceState({}, document.title, cleanUrl);
}

function showBotLoginPollingState(pendingLogin, message = "") {
  const button = document.querySelector("#botLoginButton");
  const hint = document.querySelector("#telegramLoginHint");
  if (!button || !hint) {
    return;
  }

  button.disabled = true;
  button.textContent = "Проверяю вход...";
  hint.innerHTML =
    message ||
    `Если вы еще не нажали Start, <a href="${escapeHtml(pendingLogin.bot_url)}" target="_blank" rel="noopener">откройте Telegram</a>.`;
  startBotLoginPolling(pendingLogin.nonce);
}

function sanitizeBotLoginNonce(value) {
  return String(value || "").match(/^[a-f0-9]{32}$/i) ? String(value).toLowerCase() : "";
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
    currency: appSettings.default_currency,
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
    closeQuickAddSheet();
    openConfirmDialog(normalizedResult.expense, normalizedResult.decision);
    setStatus("Проверьте нормализованную трату и подтвердите сохранение.");
  } catch (error) {
    setStatus(error.message || "Не удалось сохранить трату.", true);
  } finally {
    setLoading(false);
  }
}

async function handleQuickExpenseSubmit(event) {
  event.preventDefault();

  const entryType = quickEntryType?.value || "expense";
  const parsedExpense = parseQuickExpenseInput(quickExpenseInput.value);
  if (!parsedExpense) {
    setQuickExpenseStatus(
      entryType === "crypto" ? "Для крипты: btc 0.01 12000 или sol 2 5000." : "Напишите описание и сумму: например, кофе 80.",
      true,
    );
    return;
  }

  if (blockOfflineWrite(setQuickExpenseStatus)) {
    return;
  }

  quickExpenseSubmitButton.disabled = true;
  quickExpenseSubmitButton.textContent = "Понимаю...";
  setQuickExpenseStatus("Обрабатываю быстрый ввод...");

  try {
    if (entryType === "income") {
      const savedIncome = await createIncome({
        date: parsedExpense.date,
        amount: parsedExpense.amount,
        currency: parsedExpense.currency,
        source: parsedExpense.description_raw,
        notes: "Быстрый ввод",
      });
      incomes = upsertIncome(incomes, savedIncome);
      persistIncomes(incomes);
      quickExpenseInput.value = "";
      render();
      await flashButtonSuccess(quickExpenseSubmitButton, "Сохранено", "Добавить");
      setQuickExpenseStatus("Доход сохранён.");
      return;
    }

    if (entryType === "recurring") {
      const savedRecurringExpense = await createRecurringExpense({
        start_date: parsedExpense.date,
        amount: parsedExpense.amount,
        currency: parsedExpense.currency,
        description_raw: parsedExpense.description_raw,
        category: "подписки",
        sub_category: "подписки",
        for_whom: "myself",
        frequency: "monthly",
        notes: "Быстрый ввод",
        active: true,
      });
      recurringExpenses = upsertRecurringExpense(recurringExpenses, savedRecurringExpense);
      persistRecurringExpenses(recurringExpenses);
      quickExpenseInput.value = "";
      render();
      await flashButtonSuccess(quickExpenseSubmitButton, "Сохранено", "Добавить");
      setQuickExpenseStatus("Подписка сохранена.");
      return;
    }

    if (entryType === "crypto") {
      const cryptoPayload = parseQuickCryptoInput(quickExpenseInput.value);
      if (!cryptoPayload) {
        setQuickExpenseStatus("Для крипты: btc 0.01 12000 или sol 2 5000.", true);
        return;
      }
      const savedCryptoAsset = await createCryptoAsset(cryptoPayload);
      cryptoAssets = upsertCryptoAsset(cryptoAssets, savedCryptoAsset);
      persistCryptoAssets(cryptoAssets);
      quickExpenseInput.value = "";
      render();
      await refreshCryptoPrices();
      await flashButtonSuccess(quickExpenseSubmitButton, "Сохранено", "Добавить");
      setQuickExpenseStatus("Крипто позиция сохранена.");
      return;
    }

    const normalizedResult = await normalizeExpense(parsedExpense);
    pendingMode = "create";
    pendingExpense = normalizedResult.expense;
    pendingDecision = normalizedResult.decision;
    openConfirmDialog(normalizedResult.expense, normalizedResult.decision);
    setQuickExpenseStatus("Проверьте запись и подтвердите сохранение.");
  } catch (error) {
    setQuickExpenseStatus(error.message || "Не удалось обработать быстрый ввод.", true);
  } finally {
    quickExpenseSubmitButton.disabled = false;
    quickExpenseSubmitButton.textContent = "Добавить";
  }
}

function handleQuickEntryTypeChange() {
  const entryType = quickEntryType?.value || "expense";
  const hints = {
    expense: {
      placeholder: "кофе 80, такси домой 240, чатгпт 800 подписка",
      hint: "Расход: кофе 80 или такси домой 240",
    },
    income: {
      placeholder: "зарплата 20000, возврат долга 500",
      hint: "Доход: зарплата 20000 или возврат 500",
    },
    recurring: {
      placeholder: "spotify 250, vpn 120, chatgpt 800",
      hint: "Подписка: spotify 250, частота по умолчанию месяц",
    },
    crypto: {
      placeholder: "btc 0.01 12000, sol 2 5000",
      hint: "Крипта: монета количество вложено",
    },
  };
  const nextHint = hints[entryType] || hints.expense;
  if (quickExpenseInput) {
    quickExpenseInput.placeholder = nextHint.placeholder;
  }
  if (quickInputHint) {
    quickInputHint.textContent = nextHint.hint;
  }
}

async function handleCategoryRename() {
  const from = normalizeSearchText(categoryRenameFromInput?.value || "");
  const to = String(categoryRenameToInput?.value || "").trim().toLowerCase();
  if (!from || !to) {
    setSettingsStatus("Укажите старую и новую категорию.", true);
    return;
  }

  const changedExpenses = expenses.filter((expense) => normalizeSearchText(expense.category) === from);
  if (!changedExpenses.length) {
    setSettingsStatus("Таких категорий в расходах не найдено.", true);
    return;
  }

  if (blockOfflineWrite(setSettingsStatus)) {
    return;
  }

  categoryRenameButton.disabled = true;
  setSettingsStatus("Обновляю категории...");

  try {
    for (const expense of changedExpenses) {
      const savedExpense = await saveExpenseRecord({ ...expense, category: to }, "edit");
      expenses = upsertExpense(expenses, savedExpense);
    }
    appSettings = sanitizeSettings({
      ...appSettings,
      category_catalog: [...appSettings.category_catalog.filter((category) => normalizeSearchText(category) !== from), to],
    });
    await saveSettings(appSettings);
    persistSettings(appSettings);
    persistExpenses(expenses);
    categoryRenameFromInput.value = "";
    categoryRenameToInput.value = "";
    syncFilterOptions();
    render();
    setSettingsStatus(`Категория обновлена в ${changedExpenses.length} записях.`);
  } catch (error) {
    setSettingsStatus(error.message || "Не удалось обновить категории.", true);
  } finally {
    categoryRenameButton.disabled = false;
  }
}

async function handleIncomeSubmit(event) {
  event.preventDefault();

  const payload = {
    id: editingIncomeId,
    date: incomeDateInput.value,
    amount: Number(incomeAmountInput.value),
    currency: incomeCurrencyInput.value || appSettings.default_currency,
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
    incomeCurrencyInput.value = appSettings.default_currency;
    updateCustomSelect(incomeCurrencyInput);
    updateEditorStates();
    await flashButtonSuccess(incomeSubmitButton, "Сохранено", getIncomeSubmitLabel());
    setIncomeStatus(payload.id ? "Доход обновлен." : "Доход сохранен.");
  } catch (error) {
    setIncomeStatus(error.message || "Не удалось сохранить доход.", true);
  } finally {
    setIncomeLoading(false);
  }
}

async function handleSettingsSubmit(event) {
  event.preventDefault();

  const nextSettings = sanitizeSettings({
    daily_limit: Number(dailyLimitInput.value) || 0,
    monthly_limit: Number(monthlyLimitInput.value) || 0,
    default_currency: defaultCurrencyInput.value,
    display_currency: displayCurrencyInput.value,
    category_catalog: categoryCatalogInput.value
      .split(/\n|,/)
      .map((value) => value.trim())
      .filter(Boolean),
  });

  if (blockOfflineWrite(setSettingsStatus)) {
    appSettings = nextSettings;
    persistSettings(appSettings);
    renderSettingsView();
    return;
  }

  settingsSubmitButton.disabled = true;
  setSettingsStatus("Сохраняю настройки...");

  try {
    appSettings = await saveSettings(nextSettings);
    persistSettings(appSettings);
    renderSettingsView();
    await flashButtonSuccess(settingsSubmitButton, "Сохранено", "Сохранить лимиты");
    setSettingsStatus("Настройки сохранены.");
  } catch (error) {
    appSettings = nextSettings;
    persistSettings(appSettings);
    renderSettingsView();
    setSettingsStatus(error.message || "Настройки сохранены локально.", true);
  } finally {
    settingsSubmitButton.disabled = false;
  }
}

async function handleRefreshExchangeRates() {
  if (refreshExchangeRatesButton) {
    refreshExchangeRatesButton.disabled = true;
  }
  setSettingsStatus("Обновляю курсы...");

  try {
    exchangeRates = await fetchExchangeRates();
    persistExchangeRates(exchangeRates);
    render();
    setSettingsStatus("Курсы обновлены.");
  } catch (error) {
    setSettingsStatus(error.message || "Не удалось обновить курсы.", true);
  } finally {
    if (refreshExchangeRatesButton) {
      refreshExchangeRatesButton.disabled = false;
    }
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
    updateEditorStates();
    renderCryptoView();
    await refreshCryptoPrices();
    await flashButtonSuccess(cryptoSubmitButton, "Сохранено", getCryptoSubmitLabel());
    setCryptoStatus(payload.id ? "Позиция обновлена." : "Позиция сохранена.");
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
    currency: recurringCurrencyInput.value || appSettings.default_currency,
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
    recurringCurrencyInput.value = appSettings.default_currency;
    updateCustomSelect(recurringFrequencyInput);
    updateCustomSelect(recurringForWhomInput);
    updateCustomSelect(recurringCurrencyInput);
    updateEditorStates();
    renderRecurringView();
    pulseNodes(recurringMonthlyAmount, recurringCount);
    await flashButtonSuccess(recurringSubmitButton, "Сохранено", getRecurringSubmitLabel());
    setRecurringStatus(payload.id ? "Подписка обновлена." : "Подписка сохранена.");
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

function cancelIncomeEdit() {
  editingIncomeId = null;
  incomeForm.reset();
  incomeDateInput.value = new Date().toISOString().slice(0, 10);
  incomeCurrencyInput.value = appSettings.default_currency;
  updateCustomSelect(incomeCurrencyInput);
  updateEditorStates();
  setIncomeStatus("Редактирование дохода отменено.");
}

function cancelCryptoEdit() {
  editingCryptoAssetId = null;
  cryptoForm.reset();
  updateCustomSelect(cryptoCoinInput);
  updateEditorStates();
  setCryptoStatus("Редактирование позиции отменено.");
}

function cancelRecurringEdit() {
  editingRecurringExpenseId = null;
  recurringForm.reset();
  recurringStartDateInput.value = new Date().toISOString().slice(0, 10);
  recurringCurrencyInput.value = appSettings.default_currency;
  updateCustomSelect(recurringFrequencyInput);
  updateCustomSelect(recurringForWhomInput);
  updateCustomSelect(recurringCurrencyInput);
  updateEditorStates();
  setRecurringStatus("Редактирование подписки отменено.");
}

function updateEditorStates() {
  const incomeEditing = Boolean(editingIncomeId);
  incomeForm?.classList.toggle("editing-record", incomeEditing);
  if (incomeFormTitle) {
    incomeFormTitle.textContent = incomeEditing ? "Редактирование дохода" : "Новый доход";
  }
  if (incomeFormCopy) {
    incomeFormCopy.textContent = incomeEditing
      ? "Проверьте дату, сумму, валюту и источник. Сохранение обновит выбранную запись без дубля."
      : "Записывайте зарплату, возвраты, подарки и любые поступления отдельно от расходов.";
  }
  if (incomeFormChip) {
    incomeFormChip.textContent = incomeEditing ? `Правка #${editingIncomeId}` : "Плюс к балансу";
  }
  if (incomeSubmitButton && !incomeSubmitButton.disabled) {
    incomeSubmitButton.textContent = getIncomeSubmitLabel();
  }
  cancelIncomeEditButton?.classList.toggle("hidden", !incomeEditing);

  const cryptoEditing = Boolean(editingCryptoAssetId);
  cryptoForm?.classList.toggle("editing-record", cryptoEditing);
  if (cryptoFormTitle) {
    cryptoFormTitle.textContent = cryptoEditing ? "Редактирование позиции" : "Новая позиция";
  }
  if (cryptoFormCopy) {
    cryptoFormCopy.textContent = cryptoEditing
      ? "Обновите количество, вложенную сумму или заметку. Цена подтянется заново после сохранения."
      : "Укажите монету, сколько держите и сколько всего вложили. Текущую стоимость посчитаем по live-цене.";
  }
  if (cryptoFormChip) {
    cryptoFormChip.textContent = cryptoEditing ? `Правка #${editingCryptoAssetId}` : "Live price";
  }
  if (cryptoSubmitButton && !cryptoSubmitButton.disabled) {
    cryptoSubmitButton.textContent = getCryptoSubmitLabel();
  }
  cancelCryptoEditButton?.classList.toggle("hidden", !cryptoEditing);

  const recurringEditing = Boolean(editingRecurringExpenseId);
  recurringForm?.classList.toggle("editing-record", recurringEditing);
  if (recurringFormTitle) {
    recurringFormTitle.textContent = recurringEditing ? "Редактирование подписки" : "Подписка";
  }
  if (recurringFormCopy) {
    recurringFormCopy.textContent = recurringEditing
      ? "Измените сумму, валюту, период или статус сервиса. Сохранение обновит текущую подписку."
      : "Сохраняйте сервисы и регулярные платежи, чтобы видеть, что можно отключить для экономии.";
  }
  if (recurringFormChip) {
    recurringFormChip.textContent = recurringEditing ? `Правка #${editingRecurringExpenseId}` : "Экономия";
  }
  if (recurringSubmitButton && !recurringSubmitButton.disabled) {
    recurringSubmitButton.textContent = getRecurringSubmitLabel();
  }
  cancelRecurringEditButton?.classList.toggle("hidden", !recurringEditing);
}

function getIncomeSubmitLabel() {
  return editingIncomeId ? "Обновить доход" : "Сохранить доход";
}

function getCryptoSubmitLabel() {
  return editingCryptoAssetId ? "Обновить позицию" : "Сохранить позицию";
}

function getRecurringSubmitLabel() {
  return editingRecurringExpenseId ? "Обновить подписку" : "Сохранить подписку";
}

function handleClearLocalStorage() {
  clearLocalHistory({ resetSettings: true });
  setStatus("Локальный кеш очищен.");
  setIncomeStatus("Локальный кеш очищен.");
  setCryptoStatus("Локальный кеш очищен.");
  setRecurringStatus("Локальный кеш очищен.");
  setSettingsStatus("Локальный кеш очищен.");
}

function clearLocalHistory({ resetSettings = false } = {}) {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(INCOME_STORAGE_KEY);
  localStorage.removeItem(CRYPTO_STORAGE_KEY);
  localStorage.removeItem(RECURRING_STORAGE_KEY);
  expenses = [];
  incomes = [];
  cryptoAssets = [];
  recurringExpenses = [];
  if (resetSettings) {
    localStorage.removeItem(SETTINGS_STORAGE_KEY);
    appSettings = sanitizeSettings({});
  }
  cryptoPrices = {};
  visibleWeekStart = getStartOfWeek(new Date());
  visibleMonthDate = getStartOfMonth(new Date());
  syncFilterOptions();
  render();
}

async function handleResetServerData() {
  return handleResetServerHistory();
}

async function handleResetServerHistory() {
  if (blockOfflineWrite(setSettingsStatus)) {
    return;
  }

  if (!confirm("Очистить вашу историю на сервере? Настройки и категории останутся, но расходы, доходы, активы и подписки будут удалены.")) {
    return;
  }

  [resetServerButton, resetServerHistoryButton].filter(Boolean).forEach((button) => {
    button.disabled = true;
  });
  setSyncState("loading", "Очищаю вашу серверную историю...");
  setSettingsStatus("Очищаю историю на сервере...");

  try {
    await resetServerHistory();
    clearLocalHistory({ resetSettings: false });
    setSyncState("online", "История на сервере очищена");
    setStatus("История на сервере очищена.");
    setIncomeStatus("История на сервере очищена.");
    setCryptoStatus("История на сервере очищена.");
    setRecurringStatus("История на сервере очищена.");
    setSettingsStatus("История очищена. Настройки и категории сохранены.");
  } catch (error) {
    setSyncState("offline", "История не очищена");
    setSettingsStatus(error.message || "Не удалось очистить историю на сервере.", true);
  } finally {
    [resetServerButton, resetServerHistoryButton].filter(Boolean).forEach((button) => {
      button.disabled = false;
    });
  }
}

function handleViewTabClick(event) {
  closeQuickAddSheet();
  const target = event.currentTarget.dataset.viewTarget;
  const isTodayView = target === "today";
  const isIncomeView = target === "incomes";
  const isCryptoView = target === "crypto";
  const isSettingsView = target === "settings";

  todayView?.classList.toggle("hidden", !isTodayView);
  expensesView.classList.toggle("hidden", isTodayView || isIncomeView || isCryptoView || isSettingsView);
  incomesView.classList.toggle("hidden", !isIncomeView);
  cryptoView.classList.toggle("hidden", !isCryptoView);
  recurringView.classList.toggle("hidden", !isSettingsView);
  settingsView?.classList.toggle("hidden", !isSettingsView);
  viewTabs.forEach((button) => button.classList.toggle("active", button.dataset.viewTarget === target));
}

function handleQuickAdd() {
  const activeTarget = viewTabs.find((button) => button.classList.contains("active"))?.dataset.viewTarget || "today";
  const targetNode =
    activeTarget === "today"
      ? quickExpenseForm
      : activeTarget === "expenses"
        ? form
        : activeTarget === "incomes"
          ? incomeForm
          : activeTarget === "crypto"
            ? cryptoForm
            : activeTarget === "settings"
            ? settingsForm
            : quickExpenseForm || form;

  targetNode.scrollIntoView({ behavior: "smooth", block: "start" });
  targetNode.querySelector("input, textarea, select")?.focus({ preventScroll: true });
}

function openQuickAddSheet() {
  document.body.classList.add("quick-sheet-open");
  quickSheetOverlay?.setAttribute("aria-hidden", "false");
  const preferredInput = descriptionInput.value.trim() ? amountInput : descriptionInput;
  window.setTimeout(() => preferredInput.focus({ preventScroll: true }), 180);
}

function closeQuickAddSheet() {
  document.body.classList.remove("quick-sheet-open");
  quickSheetOverlay?.setAttribute("aria-hidden", "true");
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

function handleDocumentKeydown(event) {
  if (event.key === "Escape") {
    closeQuickAddSheet();
  }
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
  incomeCurrencyInput.value = normalizeCurrency(income.currency, appSettings.default_currency);
  incomeSourceInput.value = income.source;
  incomeNotesInput.value = income.notes;
  updateCustomSelect(incomeCurrencyInput);
  updateEditorStates();
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
  updateEditorStates();
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
  recurringCurrencyInput.value = normalizeCurrency(recurringExpense.currency, appSettings.default_currency);
  recurringFrequencyInput.value = recurringExpense.frequency;
  recurringForWhomInput.value = recurringExpense.for_whom;
  recurringDescriptionInput.value = recurringExpense.description_raw;
  recurringCategoryInput.value = recurringExpense.category;
  recurringSubCategoryInput.value = recurringExpense.sub_category;
  recurringNotesInput.value = recurringExpense.notes;
  updateCustomSelect(recurringFrequencyInput);
  updateCustomSelect(recurringForWhomInput);
  updateCustomSelect(recurringCurrencyInput);
  updateEditorStates();
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

async function fetchHealth() {
  const response = await apiFetch("/api/health");
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("Не удалось проверить версию API.");
  }

  if (!response.ok) {
    throw new Error(data?.error || "API недоступен.");
  }

  return data;
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

async function saveSettings(payload) {
  const response = await apiFetch("/api/settings", {
    method: "PUT",
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
    throw new Error(data?.error || "Не удалось сохранить настройки.");
  }

  return sanitizeSettings(data);
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

function parseQuickExpenseInput(value) {
  const rawValue = String(value || "").trim();
  if (!rawValue) {
    return null;
  }

  const amountMatch = rawValue.match(/(?:^|\s)(\d+(?:[.,]\d{1,2})?)(?:\s*(?:uah|usd|eur|pln|rub|грн|₴|\$|€|zł|₽|руб))?(?=\s|$)/i);
  if (!amountMatch) {
    return null;
  }

  const amount = Number(amountMatch[1].replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const description = rawValue
    .replace(amountMatch[0], " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!description) {
    return null;
  }

  return {
    date: new Date().toISOString().slice(0, 10),
    amount,
    currency: inferQuickInputCurrency(rawValue),
    quantity: 1,
    description_raw: description,
    notes: "Быстрый ввод",
    ai_hint: buildQuickInputHint(description),
  };
}

function parseQuickCryptoInput(value) {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length < 3) {
    return null;
  }

  const coinToken = parts[0].toLowerCase();
  const amountHeld = Number(parts[1].replace(",", "."));
  const investedAmount = Number(parts[2].replace(",", "."));
  const coins = {
    btc: { coingecko_id: "bitcoin", symbol: "BTC", name: "Bitcoin" },
    bitcoin: { coingecko_id: "bitcoin", symbol: "BTC", name: "Bitcoin" },
    eth: { coingecko_id: "ethereum", symbol: "ETH", name: "Ethereum" },
    ethereum: { coingecko_id: "ethereum", symbol: "ETH", name: "Ethereum" },
    sol: { coingecko_id: "solana", symbol: "SOL", name: "Solana" },
    solana: { coingecko_id: "solana", symbol: "SOL", name: "Solana" },
    ton: { coingecko_id: "toncoin", symbol: "TON", name: "Toncoin" },
    usdt: { coingecko_id: "tether", symbol: "USDT", name: "Tether" },
    usdc: { coingecko_id: "usd-coin", symbol: "USDC", name: "USD Coin" },
    bnb: { coingecko_id: "binancecoin", symbol: "BNB", name: "BNB" },
  };
  const coin = coins[coinToken];
  if (!coin || !Number.isFinite(amountHeld) || amountHeld <= 0 || !Number.isFinite(investedAmount) || investedAmount < 0) {
    return null;
  }

  return {
    ...coin,
    amount_held: amountHeld,
    invested_amount: investedAmount,
    currency: appSettings.default_currency,
    notes: parts.slice(3).join(" "),
    updated_at: new Date().toISOString(),
  };
}

function inferQuickInputCurrency(value) {
  const lowered = String(value || "").toLowerCase();
  if (/(?:\$|usd|dollar|dollars|бакс|баксы|доллар)/i.test(lowered)) {
    return "USD";
  }
  if (/(?:€|eur|euro|евро)/i.test(lowered)) {
    return "EUR";
  }
  if (/(?:zł|pln|злот)/i.test(lowered)) {
    return "PLN";
  }
  if (/(?:rub|ruble|rubles|₽|руб)/i.test(lowered)) {
    return "RUB";
  }
  if (/(?:₴|uah|грн|грив)/i.test(lowered)) {
    return "UAH";
  }
  return appSettings.default_currency;
}

function buildQuickInputHint(description) {
  const catalogHint = appSettings.category_catalog.length
    ? `Используй справочник категорий, если подходит: ${appSettings.category_catalog.join(", ")}.`
    : "";
  return ["Запись создана из быстрого ввода в одну строку.", catalogHint].filter(Boolean).join(" ");
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

async function resetServerHistory() {
  const response = await apiFetch("/api/reset-history", {
    method: "POST",
  });

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("Сервер вернул некорректный ответ.");
  }

  if (!response.ok) {
    throw new Error(data?.error || "Не удалось очистить историю на сервере.");
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

async function fetchSettings() {
  const response = await apiFetch("/api/settings");

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("Не удалось прочитать настройки с сервера.");
  }

  if (!response.ok || !data || typeof data !== "object") {
    throw new Error(data?.error || "Не удалось загрузить настройки.");
  }

  return sanitizeSettings(data);
}

async function fetchExchangeRates() {
  const symbols = [...SUPPORTED_CURRENCIES].filter((currency) => currency !== "UAH");
  const response = await apiFetch(`/api/exchange-rates?symbols=${encodeURIComponent(symbols.join(","))}`);

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("Не удалось прочитать курсы валют.");
  }

  if (!response.ok || !data?.rates) {
    throw new Error(data?.error || "Не удалось загрузить курсы валют.");
  }

  return sanitizeExchangeRates(data);
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

  const [healthSyncResult, expenseSyncResult, incomeSyncResult, cryptoSyncResult, recurringSyncResult, settingsSyncResult, exchangeRateSyncResult] =
    await Promise.allSettled([
    fetchHealth(),
    fetchExpenses(),
    fetchIncomes(),
    fetchCryptoAssets(),
    fetchRecurringExpenses(),
    fetchSettings(),
    fetchExchangeRates(),
  ]);
  const syncResults = [expenseSyncResult, incomeSyncResult, cryptoSyncResult, recurringSyncResult];
  const failedSyncCount = syncResults.filter((result) => result.status === "rejected").length;
  isOfflineMode = failedSyncCount > 0;
  const apiVersionLabel = healthSyncResult.status === "fulfilled" ? ` · API ${healthSyncResult.value.version || "online"}` : "";

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

  if (settingsSyncResult.status === "fulfilled") {
    appSettings = settingsSyncResult.value;
    persistSettings(appSettings);
    setSettingsStatus("Настройки синхронизированы.");
  } else {
    setSettingsStatus(settingsSyncResult.reason?.message || "Не удалось синхронизировать настройки.", true);
  }

  if (exchangeRateSyncResult.status === "fulfilled") {
    exchangeRates = exchangeRateSyncResult.value;
    persistExchangeRates(exchangeRates);
  }

  visibleWeekStart = getStartOfWeek(getLatestExpenseDate(expenses));
  visibleMonthDate = getStartOfMonth(getLatestFinancialDate(expenses, incomes));
  isInitialSyncing = false;
  syncFilterOptions();
  render();
  setSyncState(isOfflineMode ? "offline" : "online", isOfflineMode ? "Локальный кеш" : `Сервер подключен${apiVersionLabel}`);
  suppressStatusToasts = false;
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

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    return sanitizeSettings(raw ? JSON.parse(raw) : {});
  } catch {
    return sanitizeSettings({});
  }
}

function loadExchangeRates() {
  try {
    const raw = localStorage.getItem(EXCHANGE_RATES_STORAGE_KEY);
    return sanitizeExchangeRates(raw ? JSON.parse(raw) : {});
  } catch {
    return sanitizeExchangeRates({});
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

function persistSettings(nextSettings) {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(sanitizeSettings(nextSettings)));
}

function persistExchangeRates(nextExchangeRates) {
  localStorage.setItem(EXCHANGE_RATES_STORAGE_KEY, JSON.stringify(sanitizeExchangeRates(nextExchangeRates)));
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

function sanitizeSettings(settings) {
  const safeSettings = settings || {};
  const categoryCatalog = Array.isArray(safeSettings.category_catalog)
    ? safeSettings.category_catalog
    : String(safeSettings.category_catalog || "")
        .split(/\n|,/)
        .map((value) => value.trim());

  return {
    daily_limit: Math.max(0, Number(safeSettings.daily_limit) || 0),
    monthly_limit: Math.max(0, Number(safeSettings.monthly_limit) || 0),
    default_currency: normalizeCurrency(safeSettings.default_currency, "UAH"),
    display_currency: normalizeCurrency(safeSettings.display_currency, "USD"),
    category_catalog: [...new Set(categoryCatalog.map((value) => String(value || "").trim().toLowerCase()).filter(Boolean))].sort(),
  };
}

function sanitizeExchangeRates(data) {
  const safeRates = data?.rates || data || {};
  const rates = { UAH: 1 };
  for (const currency of SUPPORTED_CURRENCIES) {
    const rate = Number(safeRates[currency]);
    if (Number.isFinite(rate) && rate > 0) {
      rates[currency] = rate;
    }
  }

  return {
    base: "UAH",
    rates,
    updated_at: String(data?.updated_at || new Date().toISOString()),
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

function convertMoney(amount, fromCurrency, toCurrency) {
  const from = normalizeCurrency(fromCurrency, appSettings.default_currency);
  const to = normalizeCurrency(toCurrency, appSettings.display_currency);
  const numericAmount = Number(amount) || 0;
  if (from === to) {
    return numericAmount;
  }

  const fromRate = Number(exchangeRates.rates?.[from]) || 0;
  const toRate = Number(exchangeRates.rates?.[to]) || 0;
  if (!fromRate || !toRate) {
    return null;
  }

  return Number(((numericAmount * fromRate) / toRate).toFixed(2));
}

function getExpenseAmountInCurrency(expense, currency = appSettings.default_currency) {
  const convertedAmount = convertMoney(expense.amount, expense.currency, currency);
  return convertedAmount === null ? Number(expense.amount) || 0 : convertedAmount;
}

function getIncomeAmountInCurrency(income, currency = appSettings.default_currency) {
  const convertedAmount = convertMoney(income.amount, income.currency, currency);
  return convertedAmount === null ? Number(income.amount) || 0 : convertedAmount;
}

function formatMoney(amount, currency = appSettings.default_currency) {
  return `${Number(amount || 0).toFixed(2)} ${normalizeCurrency(currency, appSettings.default_currency)}`;
}

function formatMoneyWithEquivalent(amount, currency = appSettings.default_currency) {
  const safeCurrency = normalizeCurrency(currency, appSettings.default_currency);
  const displayCurrency = appSettings.display_currency;
  const baseText = formatMoney(amount, safeCurrency);
  if (safeCurrency === displayCurrency) {
    return baseText;
  }

  const convertedAmount = convertMoney(amount, safeCurrency, displayCurrency);
  return convertedAmount === null ? baseText : `${baseText} (≈ ${formatMoney(convertedAmount, displayCurrency)})`;
}

function renderCurrencyBadge(currency) {
  const safeCurrency = normalizeCurrency(currency, appSettings.default_currency);
  if (safeCurrency === appSettings.default_currency) {
    return "";
  }

  return `<span class="currency-badge">${escapeHtml(safeCurrency)}</span>`;
}

function render() {
  filteredExpenses = sortExpenses(applyFilters(expenses));
  renderTodayView();
  renderLatestExpenses();
  renderActivityFeed();
  renderSummary();
  renderIncomeView();
  renderCryptoView();
  renderRecurringView();
  renderSettingsView();
  renderTable();
  renderCharts();
  renderSortState();
  syncEditorCurrencyDefaults();
  updateEditorStates();
}

function syncEditorCurrencyDefaults() {
  if (!editingIncomeId && incomeCurrencyInput && document.activeElement !== incomeCurrencyInput) {
    incomeCurrencyInput.value = appSettings.default_currency;
    updateCustomSelect(incomeCurrencyInput);
  }
  if (!editingRecurringExpenseId && recurringCurrencyInput && document.activeElement !== recurringCurrencyInput) {
    recurringCurrencyInput.value = appSettings.default_currency;
    updateCustomSelect(recurringCurrencyInput);
  }
}

function renderTodayView() {
  const today = new Date().toISOString().slice(0, 10);
  const todayExpenses = expenses.filter((expense) => expense.date === today);
  const todayIncomes = incomes.filter((income) => income.date === today);
  const todayExpenseTotal = todayExpenses.reduce((sum, expense) => sum + getExpenseAmountInCurrency(expense), 0);
  const todayIncomeTotal = todayIncomes.reduce((sum, income) => sum + getIncomeAmountInCurrency(income), 0);
  const todayBalance = todayIncomeTotal - todayExpenseTotal;
  const todayOperationCount = todayExpenses.length + todayIncomes.length;
  const monthlySummary = buildMonthlySummary(expenses, visibleMonthDate);
  const monthlyIncomeSummary = buildMonthlyIncomeSummary(incomes, visibleMonthDate);
  const monthlyBalance = monthlyIncomeSummary.total - monthlySummary.total;
  const dailyLimit = Number(appSettings.daily_limit) || 0;
  const dailyRatio = dailyLimit ? Math.min(todayExpenseTotal / dailyLimit, 1) : 0;

  if (todayTotalAmount) {
    todayTotalAmount.textContent = formatMoneyWithEquivalent(todayBalance, appSettings.default_currency);
    todayTotalAmount.dataset.state = todayBalance >= 0 ? "positive" : "negative";
  }
  if (todayExpenseCount) {
    todayExpenseCount.textContent = String(todayOperationCount);
  }
  if (todayIncomeAmount) {
    todayIncomeAmount.textContent = formatMoneyWithEquivalent(todayIncomeTotal, appSettings.default_currency);
    todayIncomeAmount.dataset.state = todayIncomeTotal > 0 ? "positive" : "neutral";
  }
  if (todayMonthTotal) {
    todayMonthTotal.textContent = formatMoneyWithEquivalent(todayExpenseTotal, appSettings.default_currency);
    todayMonthTotal.dataset.state = todayExpenseTotal > 0 ? "negative" : "neutral";
  }
  if (todayBalanceAmount) {
    todayBalanceAmount.textContent = formatMoneyWithEquivalent(monthlyBalance, appSettings.default_currency);
    todayBalanceAmount.dataset.state = monthlyBalance >= 0 ? "positive" : "negative";
  }
  if (todayLimitMeter) {
    todayLimitMeter.style.width = `${Math.round(dailyRatio * 100)}%`;
    todayLimitMeter.dataset.state = dailyRatio >= 1 ? "danger" : dailyRatio >= 0.75 ? "warning" : "ok";
  }
  if (todayLimitStatus) {
    if (!dailyLimit) {
      todayLimitStatus.textContent =
        todayIncomeTotal > 0
          ? `Сегодня: доход ${formatMoneyWithEquivalent(todayIncomeTotal, appSettings.default_currency)}, расход ${formatMoneyWithEquivalent(
              todayExpenseTotal,
              appSettings.default_currency,
            )}`
          : "Дневной лимит расходов не задан";
    } else {
      const left = dailyLimit - todayExpenseTotal;
      todayLimitStatus.textContent =
        left >= 0
          ? `По расходам осталось ${formatMoney(left)} из ${formatMoney(dailyLimit)}`
          : `Лимит расходов превышен на ${formatMoney(Math.abs(left))}`;
    }
  }
}

function renderLatestExpenses() {
  if (!latestExpenseCount || !latestExpenseList) {
    return;
  }

  const latestItems = buildLatestActivityItems().slice(0, 4);
  latestExpenseCount.textContent = String(expenses.length + incomes.length + cryptoAssets.length + recurringExpenses.length);
  if (latestExpenseCountLabel) {
    latestExpenseCountLabel.textContent = "событий";
  }
  if (latestExpenseHint) {
    latestExpenseHint.textContent = latestItems.length ? `Последние ${latestItems.length} операций` : "Добавьте первую операцию";
  }

  if (!latestItems.length) {
    latestExpenseList.innerHTML = '<p class="latest-empty">Пока нет операций. Первая запись появится здесь.</p>';
    return;
  }

  latestExpenseList.innerHTML = latestItems
    .map((item, index) => {
      return `
        <article class="latest-expense-card">
          <span class="latest-expense-index">${String(index + 1).padStart(2, "0")}</span>
          <div>
            <strong>${escapeHtml(shortenText(item.title, 28))}</strong>
            <small>${escapeHtml(item.meta)}</small>
          </div>
          <b>${escapeHtml(item.amountText)}</b>
        </article>
      `;
    })
    .join("");
}

function buildLatestActivityItems() {
  return [
    ...expenses.map((expense) => ({
      type: "expense",
      date: expense.date,
      id: expense.id,
      title: getExpenseShortTitle(expense),
      meta: ["Расход", formatShortIsoDate(expense.date), formatCategoryLabel(expense.category)].filter(Boolean).join(" · "),
      amountText: `− ${formatMoneyWithEquivalent(expense.amount, expense.currency)}`,
    })),
    ...incomes.map((income) => ({
      type: "income",
      date: income.date,
      id: income.id,
      title: toDisplayCase(income.source || "Доход"),
      meta: ["Доход", formatShortIsoDate(income.date)].filter(Boolean).join(" · "),
      amountText: `+ ${formatMoneyWithEquivalent(income.amount, income.currency)}`,
    })),
    ...cryptoAssets.map((asset) => ({
      type: "crypto",
      date: asset.updated_at || "",
      id: asset.id,
      title: `${asset.symbol} · ${asset.name}`,
      meta: "Актив · крипта",
      amountText: formatMoneyWithEquivalent(asset.invested_amount, asset.currency),
    })),
    ...recurringExpenses.map((item) => ({
      type: "recurring",
      date: item.start_date,
      id: item.id,
      title: toDisplayCase(item.description_raw || "Подписка"),
      meta: `Подписка · ${item.frequency === "weekly" ? "неделя" : "месяц"}`,
      amountText: formatMoneyWithEquivalent(item.amount, item.currency),
    })),
  ].sort((left, right) => {
    const leftTime = new Date(left.date || 0).getTime();
    const rightTime = new Date(right.date || 0).getTime();
    if (leftTime !== rightTime) {
      return rightTime - leftTime;
    }

    return (Number(right.id) || 0) - (Number(left.id) || 0);
  });
}

function renderActivityFeed() {
  if (!activityFeed) {
    return;
  }

  const filter = activityTypeFilter?.value || "all";
  const items = buildLatestActivityItems().filter((item) => filter === "all" || item.type === filter).slice(0, 12);
  if (!items.length) {
    activityFeed.innerHTML = '<p class="latest-empty">Операций пока нет.</p>';
    return;
  }

  activityFeed.innerHTML = items
    .map(
      (item) => `
        <article class="activity-item activity-item-${escapeHtml(item.type)}">
          <span>${escapeHtml(item.meta)}</span>
          <strong>${escapeHtml(item.title)}</strong>
          <b>${escapeHtml(item.amountText)}</b>
        </article>
      `,
    )
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
  totalAmountNode.textContent = formatMoneyWithEquivalent(monthlySummary.total, appSettings.default_currency);
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
  monthlyIncomeAmount.textContent = formatMoneyWithEquivalent(monthlyIncomeSummary.total, appSettings.default_currency);
  }
  if (monthlyExpenseMirror) {
    monthlyExpenseMirror.textContent = formatMoneyWithEquivalent(monthlyExpenseSummary.total, appSettings.default_currency);
  }
  if (monthlyBalanceAmount) {
    monthlyBalanceAmount.textContent = formatMoneyWithEquivalent(balance, appSettings.default_currency);
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
      <td>${escapeHtml(formatMoneyWithEquivalent(income.amount, income.currency))}${renderCurrencyBadge(income.currency)}</td>
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
      <td>${escapeHtml(formatMoneyWithEquivalent(rowData.asset.invested_amount, rowData.asset.currency))}${renderCurrencyBadge(rowData.asset.currency)}</td>
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
    return sum + getExpenseAmountInCurrency(item) * multiplier;
  }, 0);

  recurringMonthlyAmount.textContent = formatMoneyWithEquivalent(monthlyAmount, appSettings.default_currency);
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
      <td>${escapeHtml(formatMoneyWithEquivalent(recurringExpense.amount, recurringExpense.currency))}${renderCurrencyBadge(recurringExpense.currency)}</td>
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

function renderSettingsView() {
  if (!settingsView) {
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const todayTotal = expenses.filter((expense) => expense.date === today).reduce((sum, expense) => sum + getExpenseAmountInCurrency(expense), 0);
  const monthlySummary = buildMonthlySummary(expenses, visibleMonthDate);
  const monthlyLimit = Number(appSettings.monthly_limit) || 0;
  const monthlyRatio = monthlyLimit ? monthlySummary.total / monthlyLimit : 0;

  if (dailyLimitInput && document.activeElement !== dailyLimitInput) {
    dailyLimitInput.value = appSettings.daily_limit ? String(appSettings.daily_limit) : "";
  }
  if (monthlyLimitInput && document.activeElement !== monthlyLimitInput) {
    monthlyLimitInput.value = appSettings.monthly_limit ? String(appSettings.monthly_limit) : "";
  }
  if (defaultCurrencyInput && document.activeElement !== defaultCurrencyInput) {
    defaultCurrencyInput.value = appSettings.default_currency;
    updateCustomSelect(defaultCurrencyInput);
  }
  if (displayCurrencyInput && document.activeElement !== displayCurrencyInput) {
    displayCurrencyInput.value = appSettings.display_currency;
    updateCustomSelect(displayCurrencyInput);
  }
  if (categoryCatalogInput && document.activeElement !== categoryCatalogInput) {
    categoryCatalogInput.value = appSettings.category_catalog.join(", ");
  }
  if (exchangeRateStatusMessage) {
    exchangeRateStatusMessage.textContent = getExchangeRateStatusText();
  }
  if (settingsTodayTotal) {
    settingsTodayTotal.textContent = formatMoneyWithEquivalent(todayTotal, appSettings.default_currency);
  }
  if (settingsMonthTotal) {
    settingsMonthTotal.textContent = formatMoneyWithEquivalent(monthlySummary.total, appSettings.default_currency);
  }
  if (monthlyLimitProgress) {
    monthlyLimitProgress.textContent = monthlyLimit ? `${Math.round(monthlyRatio * 100)}%` : "0%";
    monthlyLimitProgress.classList.toggle("negative-balance", monthlyRatio > 1);
  }
  if (monthlyLimitStatus) {
    monthlyLimitStatus.textContent = monthlyLimit
      ? `${formatMoney(monthlySummary.total)} из ${formatMoney(monthlyLimit)} за месяц`
      : "Месячный лимит не задан";
  }
  if (categoryCatalogList) {
    const categories = appSettings.category_catalog.length
      ? appSettings.category_catalog
      : [...new Set(expenses.map((expense) => expense.category).filter((value) => value && value !== "other"))].sort();
    categoryCatalogList.innerHTML = categories.length
      ? categories.map((category) => `<span>${escapeHtml(formatCategoryLabel(category))}</span>`).join("")
      : '<p class="latest-empty">Категории появятся после первых расходов или ручного заполнения справочника.</p>';
  }
}

function getExchangeRateStatusText() {
  const updatedAt = String(exchangeRates.updated_at || "");
  if (!updatedAt) {
    return "Курс ещё не загружен";
  }

  const date = new Date(updatedAt);
  const formattedDate = Number.isNaN(date.getTime())
    ? updatedAt
    : date.toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
  const rate = convertMoney(1, appSettings.display_currency, appSettings.default_currency);
  const rateText = rate === null ? "" : ` · 1 ${appSettings.display_currency} ≈ ${formatMoney(rate, appSettings.default_currency)}`;
  return `Курс обновлён ${formattedDate}${rateText}`;
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
      <td>${escapeHtml(formatMoneyWithEquivalent(expense.amount, expense.currency))}${renderCurrencyBadge(expense.currency)}</td>
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
    totals.set(key, (totals.get(key) || 0) + getExpenseAmountInCurrency(expense));
  }

  const labels = [...totals.keys()];
  const values = labels.map((label) => totals.get(label));

  return { labels: labels.map(formatAggregateLabel), values };
}

function aggregateByDate() {
  const totals = new Map();

  for (const expense of filteredExpenses) {
    const key = expense.date || "Без даты";
    totals.set(key, (totals.get(key) || 0) + getExpenseAmountInCurrency(expense));
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
    const dayTotal = dayExpenses.reduce((sum, expense) => sum + getExpenseAmountInCurrency(expense), 0);

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
      .reduce((sum, expense) => sum + getExpenseAmountInCurrency(expense), 0);

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
      .reduce((sum, expense) => sum + getExpenseAmountInCurrency(expense), 0);

    weeks.push({
      start: weekStart,
      end: weekEnd,
      total: Number(total.toFixed(2)),
    });

    cursor = addDays(weekEnd, 1);
  }

  return {
    total: Number(monthlyExpenses.reduce((sum, expense) => sum + getExpenseAmountInCurrency(expense), 0).toFixed(2)),
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
    total: Number(monthlyIncomes.reduce((sum, income) => sum + getIncomeAmountInCurrency(income), 0).toFixed(2)),
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
          <strong>${escapeHtml(formatMoneyWithEquivalent(week.total, appSettings.default_currency))}</strong>
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
  const compactChart = isCompactChartViewport();

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
              size: compactChart ? 11 : 13,
              weight: compactChart ? "500" : "650",
              lineHeight: compactChart ? 1.12 : 1.2,
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
              size: compactChart ? 10 : 11,
              weight: compactChart ? "500" : "650",
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

function isCompactChartViewport() {
  return Boolean(window.matchMedia?.("(max-width: 560px)").matches);
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
  incomeSubmitButton.textContent = isLoading ? "Сохраняю..." : getIncomeSubmitLabel();
}

function setCryptoLoading(isLoading) {
  cryptoSubmitButton.disabled = isLoading;
  cryptoSubmitButton.textContent = isLoading ? "Сохраняю..." : getCryptoSubmitLabel();
}

function setRecurringLoading(isLoading) {
  recurringSubmitButton.disabled = isLoading;
  recurringSubmitButton.textContent = isLoading ? "Сохраняю..." : getRecurringSubmitLabel();
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

function setQuickExpenseStatus(message, isError = false) {
  if (!quickExpenseStatusMessage) {
    setStatus(message, isError);
    return;
  }

  quickExpenseStatusMessage.textContent = getInlineStatusMessage(message, isError);
  quickExpenseStatusMessage.classList.toggle("error", isError);
  maybeShowStatusToast(message, isError);
}

function setSettingsStatus(message, isError = false) {
  if (!settingsStatusMessage) {
    return;
  }

  settingsStatusMessage.textContent = getInlineStatusMessage(message, isError);
  settingsStatusMessage.classList.toggle("error", isError);
  maybeShowStatusToast(message, isError);
}

function getInlineStatusMessage(message, isError) {
  if (!message || isError || isToastSuccessMessage(message)) {
    return "";
  }

  return message;
}

function maybeShowStatusToast(message, isError) {
  if (!message || suppressStatusToasts) {
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
    await rememberExpenseTaxonomy(savedExpense);
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
      if (quickExpenseInput) {
        quickExpenseInput.value = "";
      }
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

async function rememberExpenseTaxonomy(expense) {
  const learnedCategory = normalizeSearchText(expense?.category || "");
  if (!learnedCategory || learnedCategory === "other" || appSettings.category_catalog.includes(learnedCategory)) {
    return;
  }

  appSettings = sanitizeSettings({
    ...appSettings,
    category_catalog: [...appSettings.category_catalog, learnedCategory],
  });
  persistSettings(appSettings);

  if (!isOfflineMode && hasTelegramAuth()) {
    try {
      appSettings = await saveSettings(appSettings);
      persistSettings(appSettings);
    } catch {}
  }
}

function renderConfirmPreview(expense) {
  const compactFields = `
    ${renderConfirmField("Итого", "amount", String(expense.amount), { type: "number", step: "0.01", min: "0", suffix: expense.currency })}
    ${renderConfirmField("Валюта", "currency", expense.currency)}
    ${renderConfirmField("Товар", "product_name", expense.product_name)}
    ${renderConfirmField("Категория", "category", expense.category)}
    ${renderConfirmField("Для кого", "for_whom", expense.for_whom, { type: "select" })}
  `;

  const editorFields = `
    ${renderConfirmField("Дата", "date", expense.date, { type: "date" })}
    ${renderConfirmField("Итого", "amount", String(expense.amount), { type: "number", step: "0.01", min: "0", suffix: expense.currency })}
    ${renderConfirmField("Валюта", "currency", expense.currency, { type: "select" })}
    ${renderConfirmField("Количество", "quantity", String(expense.quantity), { type: "number", step: "1", min: "1" })}
    ${renderConfirmField("Товар", "product_name", expense.product_name)}
    ${renderConfirmField("Для кого", "for_whom", expense.for_whom, { type: "select" })}
    ${renderConfirmField("Категория", "category", expense.category)}
    ${renderConfirmField("Подкатегория", "sub_category", expense.sub_category)}
    ${renderConfirmField("Детализация", "sub_sub_category", expense.sub_sub_category)}
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
          ${name === "currency" ? renderCurrencyOptions(safeValue) : renderForWhomOptions(safeValue)}
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

function renderCurrencyOptions(selectedValue) {
  const selectedCurrency = normalizeCurrency(selectedValue, appSettings.default_currency);
  return [...SUPPORTED_CURRENCIES]
    .map((value) => `<option value="${escapeHtml(value)}"${value === selectedCurrency ? " selected" : ""}>${escapeHtml(CURRENCY_LABELS[value] || value)}</option>`)
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
    currency: getField("currency")?.value || pendingExpense.currency,
    quantity: Number(getField("quantity")?.value ?? pendingExpense.quantity),
    product_name: getField("product_name")?.value || pendingExpense.product_name,
    for_whom: getField("for_whom")?.value || pendingExpense.for_whom,
    category: getField("category")?.value || pendingExpense.category,
    sub_category: getField("sub_category")?.value || pendingExpense.sub_category,
    sub_sub_category: getField("sub_sub_category")?.value || pendingExpense.sub_sub_category,
    description_raw: getField("description_raw")?.value || pendingExpense.description_raw,
    notes: getField("notes")?.value || pendingExpense.notes,
  });
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
