/**
 * FlowDesk: language switching, mobile navigation, and a local workflow demo.
 * No frameworks, no network requests, no real messages, and no backend.
 * The only persistent value is the visitor's language preference.
 */
(() => {
  "use strict";

  const translations = window.FLOWDESK_TRANSLATIONS;
  const supportedLanguages = ["en", "ar", "de"];
  const storageKey = "flowdesk-language";

  // If translations fail to load, leave the static English page available.
  if (!translations || !translations.en) return;

  const root = document.documentElement;
  const languageSelect = document.getElementById("language-select");
  const languageStatus = document.getElementById("language-status");
  const menuToggle = document.getElementById("menu-toggle");
  const navigation = document.getElementById("main-navigation");
  const workflowTitle = document.getElementById("workflow-title");
  const workflowSummary = document.getElementById("workflow-summary");
  const workflowSteps = document.getElementById("workflow-steps");
  const steps = Array.from(document.querySelectorAll(".demo-step"));
  const runButton = document.getElementById("run-demo");
  const runLabel = document.getElementById("run-label");
  const resetButton = document.getElementById("reset-demo");
  const progress = document.getElementById("simulation-progress");
  const progressFill = progress.querySelector("span");
  const demoStatus = document.getElementById("demo-status");
  const modeButtons = Array.from(document.querySelectorAll("[data-mode]"));
  const footerLanguageButtons = Array.from(document.querySelectorAll("[data-set-language]"));

  let currentLanguage = "en";
  let currentMode = "proposed";
  let menuOpen = false;
  let simulationTimer = null;
  let completed = false;
  let running = false;

  const isSupported = (language) => supportedLanguages.includes(language);
  const t = (key) => translations[currentLanguage][key] ?? translations.en[key] ?? key;

  function storedLanguage() {
    // Storage can be blocked in private browsing or on file:// pages.
    try {
      const language = localStorage.getItem(storageKey);
      return isSupported(language) ? language : null;
    } catch (_) {
      return null;
    }
  }

  function urlLanguage() {
    const language = new URLSearchParams(window.location.search).get("lang");
    return isSupported(language) ? language : null;
  }

  function saveLanguage(language) {
    try {
      localStorage.setItem(storageKey, language);
    } catch (_) {
      // Language switching still works for this visit if storage is unavailable.
    }
  }

  function updateLanguageUrl(language) {
    // Avoid History API restrictions on directly opened local files.
    if (!["http:", "https:"].includes(window.location.protocol)) return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("lang", language);
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    } catch (_) {
      // Updating the visible URL is optional, not a requirement for translation.
    }
  }

  function translatePage() {
    document.querySelectorAll("[data-i18n]").forEach((element) => {
      element.textContent = t(element.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-aria]").forEach((element) => {
      element.setAttribute("aria-label", t(element.dataset.i18nAria));
    });
    document.title = t("meta.title");
    document.querySelector('meta[name="description"]').setAttribute("content", t("meta.description"));
    menuToggle.setAttribute("aria-label", t(menuOpen ? "nav.close" : "nav.open"));
    runLabel.textContent = t(completed ? "demo.replay" : "demo.run");
  }

  function setProgress(number) {
    progress.setAttribute("aria-valuenow", String(number));
    progressFill.style.width = `${(number / steps.length) * 100}%`;
  }

  function resetSimulation() {
    window.clearTimeout(simulationTimer);
    simulationTimer = null;
    completed = false;
    running = false;
    runButton.disabled = false;
    runLabel.textContent = t("demo.run");
    workflowSteps.setAttribute("aria-busy", "false");
    workflowSteps.dataset.state = "idle";
    steps.forEach((step) => {
      step.classList.remove("is-active", "is-complete");
      step.removeAttribute("aria-current");
    });
    setProgress(0);
    demoStatus.textContent = t("demo.ready");
  }

  function setMode(mode) {
    if (!["manual", "proposed"].includes(mode)) return;
    currentMode = mode;
    resetSimulation();
    workflowSteps.dataset.mode = mode;
    workflowTitle.dataset.i18n = `demo.${mode}.title`;
    workflowSummary.dataset.i18n = `demo.${mode}.summary`;
    steps.forEach((step, index) => {
      step.querySelector("[data-step-title]").dataset.i18n = `demo.${mode}.step${index + 1}.title`;
      step.querySelector("[data-step-text]").dataset.i18n = `demo.${mode}.step${index + 1}.text`;
    });
    modeButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
    });
    translatePage();
  }

  function setLanguage(language, { persist = true, updateUrl = true, announce = true } = {}) {
    if (!isSupported(language)) return;
    currentLanguage = language;
    root.lang = language;
    root.dir = language === "ar" ? "rtl" : "ltr";
    languageSelect.value = language;
    footerLanguageButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.setLanguage === language));
    });
    // Cancel any pending animation before replacing its language-dependent text.
    resetSimulation();
    translatePage();
    if (persist) saveLanguage(language);
    if (updateUrl) updateLanguageUrl(language);
    if (announce) languageStatus.textContent = t("language.changed");
  }

  function setMenu(open, { restoreFocus = false } = {}) {
    menuOpen = open;
    navigation.classList.toggle("is-open", open);
    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.setAttribute("aria-label", t(open ? "nav.close" : "nav.open"));
    if (restoreFocus) menuToggle.focus();
  }

  function runSimulation() {
    if (running) return;
    resetSimulation();
    running = true;
    runButton.disabled = true;
    workflowSteps.setAttribute("aria-busy", "true");
    workflowSteps.dataset.state = "running";
    let index = 0;

    function advance() {
      if (index > 0) {
        const previous = steps[index - 1];
        previous.classList.remove("is-active");
        previous.classList.add("is-complete");
        previous.removeAttribute("aria-current");
        setProgress(index);
      }
      if (index === steps.length) {
        simulationTimer = null;
        running = false;
        completed = true;
        runButton.disabled = false;
        runLabel.textContent = t("demo.replay");
        workflowSteps.setAttribute("aria-busy", "false");
        workflowSteps.dataset.state = "complete";
        demoStatus.textContent = t("demo.done");
        return;
      }
      steps[index].classList.add("is-active");
      steps[index].setAttribute("aria-current", "step");
      const stepTitle = t(`demo.${currentMode}.step${index + 1}.title`);
      demoStatus.textContent = `${t("demo.running")} ${index + 1} ${t("demo.of")} ${steps.length}: ${stepTitle}`;
      index += 1;
      // Identical illustrative timing in both modes. This is not a benchmark.
      simulationTimer = window.setTimeout(advance, 650);
    }
    advance();
  }

  languageSelect.addEventListener("change", (event) => setLanguage(event.target.value));
  footerLanguageButtons.forEach((button) => {
    button.addEventListener("click", () => setLanguage(button.dataset.setLanguage));
  });
  modeButtons.forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.mode));
  });
  runButton.addEventListener("click", runSimulation);
  resetButton.addEventListener("click", resetSimulation);
  menuToggle.addEventListener("click", () => setMenu(!menuOpen));

  navigation.addEventListener("click", (event) => {
    const link = event.target.closest("a[href^='#']");
    if (!link || !menuOpen) return;
    setMenu(false);
    const target = document.getElementById(link.hash.slice(1));
    // Keep keyboard focus in the content, not inside the newly closed menu.
    if (target) target.focus({ preventScroll: true });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menuOpen) setMenu(false, { restoreFocus: true });
  });
  document.addEventListener("click", (event) => {
    if (menuOpen && !event.target.closest(".site-header")) setMenu(false);
  });
  const desktopMedia = window.matchMedia("(min-width: 901px)");
  desktopMedia.addEventListener("change", (event) => {
    if (event.matches) setMenu(false);
  });
  window.addEventListener("popstate", () => {
    setLanguage(urlLanguage() || storedLanguage() || "en", { updateUrl: false });
  });

  // Priority: explicit ?lang=, then an earlier choice, otherwise English.
  // Browser/device language does not override the English-first requirement.
  setMode("proposed");
  setLanguage(urlLanguage() || storedLanguage() || "en", {
    persist: false,
    updateUrl: false,
    announce: false
  });
  root.classList.add("js");
  document.querySelectorAll("[data-js-only]").forEach((element) => {
    element.hidden = false;
  });
})();
