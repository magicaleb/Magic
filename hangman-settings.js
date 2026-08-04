'use strict';

const SETTINGS_VERSION = '2.5.0';
const SETTINGS_DATE = 'Aug 4, 2026';
let lookaheadImpactCache = { key: '', rows: [] };

function settingsSectionByTitle(title) {
  return Array.from(document.querySelectorAll('#settingsPanel .panel-scroll > .section')).find((section) => section.querySelector('h2')?.textContent.trim() === title);
}

function createSettingsGroup(key, description, sectionTitles) {
  const group = document.createElement('div');
  group.className = 'settings-group';
  group.dataset.group = key;
  const intro = document.createElement('p');
  intro.className = 'settings-group-title';
  intro.textContent = description;
  group.append(intro);
  sectionTitles.forEach((title) => {
    const section = settingsSectionByTitle(title);
    if (section) group.append(section);
  });
  return group;
}

function refreshSettingsOverview() {
  const overview = document.getElementById('settingsOverview');
  if (!overview) return;
  const meta = getMeta();
  const active = getActiveWords().length;
  const total = getAllWords().length;
  const optimizer = document.getElementById('optimizerSelect')?.selectedOptions?.[0]?.textContent || optimizerLabel(meta.optimizer);
  const assist = meta.lengthMode === 'exact' ? 'Exact length' : meta.lengthMode === 'bucket' ? 'Length bucket' : meta.vowelMode ? 'Vowel assist' : 'No assist';
  overview.replaceChildren();
  [[currentListName, 'Active list'], [`${active}/${total}`, 'Active words'], [optimizer, assist]].forEach(([value, label]) => {
    const card = document.createElement('div');
    card.className = 'settings-overview-card';
    const strong = document.createElement('strong');
    strong.textContent = value;
    const span = document.createElement('span');
    span.textContent = label;
    card.append(strong, span);
    overview.append(card);
  });
}

function showSettingsGroup(key) {
  document.querySelectorAll('.settings-group').forEach((group) => group.classList.toggle('active', group.dataset.group === key));
  document.querySelectorAll('.settings-tab').forEach((tab) => {
    const active = tab.dataset.group === key;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  sessionStorage.setItem('hangmanSettingsGroup', key);
  document.querySelector('#settingsPanel .panel-scroll')?.scrollTo({ top: 0, behavior: 'auto' });
}

function installSettingsLayout() {
  const scroll = document.querySelector('#settingsPanel .panel-scroll');
  if (!scroll || document.getElementById('settingsTabs')) return;
  document.getElementById('settingsAutosaveNote')?.remove();
  const overview = document.createElement('div');
  overview.id = 'settingsOverview';
  overview.className = 'settings-overview';
  const tabs = document.createElement('div');
  tabs.id = 'settingsTabs';
  tabs.className = 'settings-tabs';
  tabs.setAttribute('role', 'tablist');
  [['performance', 'Performance'], ['words', 'Word List'], ['advanced', 'Advanced']].forEach(([key, label]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'settings-tab';
    button.dataset.group = key;
    button.textContent = label;
    button.setAttribute('role', 'tab');
    button.addEventListener('click', () => showSettingsGroup(key));
    tabs.append(button);
  });
  const performance = createSettingsGroup('performance', 'Everything needed to prepare and perform the effect.', ['Active Word List', 'Performance Inputs', 'Performance Framing']);
  const words = createSettingsGroup('words', 'Tune which words are available without mixing list maintenance into performance setup.', ['Word Eligibility', 'Add Word To Current List', 'Words', 'Create New List']);
  const advanced = createSettingsGroup('advanced', 'Tree behavior, analysis tools, and options you may change less often.', ['Tree Style', 'List Lab']);
  scroll.prepend(overview, tabs, performance, words, advanced);
  showSettingsGroup(sessionStorage.getItem('hangmanSettingsGroup') || 'performance');
  refreshSettingsOverview();
  const experimental = document.createElement('div');
  experimental.className = 'experimental-note';
  experimental.textContent = 'Experimental Lookahead evaluates several future questions before choosing the next letter. Compare its average and maximum depth with your current style before relying on it in performance.';
  document.getElementById('optimizerDescription')?.insertAdjacentElement('afterend', experimental);
}

const originalRefreshSettingsForLayout = refreshSettings;
refreshSettings = function refreshSettingsWithLayout() {
  originalRefreshSettingsForLayout();
  refreshSettingsOverview();
};

const originalOptimizerLabelForLayout = optimizerLabel;
optimizerLabel = function optimizerLabelWithLookahead(mode) {
  return mode === 'lookahead' ? 'Experimental Lookahead' : originalOptimizerLabelForLayout(mode);
};

const originalComputeImpactForLookahead = computeImpactRows;
computeImpactRows = function computeImpactRowsWithoutLookaheadExplosion() {
  if (getMeta().optimizer !== 'lookahead') return originalComputeImpactForLookahead();
  const key = JSON.stringify({ list: currentListName, words: getActiveWords(), mode: 'lookahead-proxy' });
  if (lookaheadImpactCache.key === key) return lookaheadImpactCache.rows;
  const meta = getMeta();
  const selected = meta.optimizer;
  meta.optimizer = 'fastest';
  impactCache.key = '';
  try {
    const rows = originalComputeImpactForLookahead();
    lookaheadImpactCache = { key, rows };
    return rows;
  } finally {
    meta.optimizer = selected;
    impactCache.key = '';
  }
};

function updateVersionForSettingsLayout() {
  const button = document.getElementById('versionButton');
  if (button) button.textContent = `V${SETTINGS_VERSION} · ${SETTINGS_DATE}`;
  const current = document.querySelector('#versionPanel .panel-header .version');
  if (current) current.textContent = `Current: V${SETTINGS_VERSION}`;
  const changelog = document.querySelector('#versionPanel .changelog');
  if (changelog && !changelog.querySelector('[data-version="2.5.0"]')) {
    const article = document.createElement('article');
    article.dataset.version = '2.5.0';
    article.innerHTML = '<h2>V2.5.0 · Aug 4, 2026</h2><p>Added optional Late Lie Recovery. After enough truthful narrowing, a discreet green cue appears only when an exact decision plan can still identify the word despite one future false letter answer.</p>';
    changelog.prepend(article);
  }
}

installSettingsLayout();
updateVersionForSettingsLayout();
['change', 'input'].forEach((eventName) => document.getElementById('settingsPanel')?.addEventListener(eventName, () => requestAnimationFrame(refreshSettingsOverview)));

const lateLieScript = document.createElement('script');
lateLieScript.src = './hangman-lie.js?v=2.5.0';
lateLieScript.async = false;
lateLieScript.addEventListener('load', () => {
  btnClear.addEventListener('click', resetLateLieSession);
  btnUndo.addEventListener('click', () => {
    lateLieArmed = Boolean(curNode?.lateLie || answerGroups.some((group) => group.lateLieActivated));
    syncLateLieDot();
  });
  btnSolve.addEventListener('pointerup', () => requestAnimationFrame(syncLateLieDot));
});
document.head.append(lateLieScript);
