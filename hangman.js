'use strict';

function showPanel(panel) {
  panel.hidden = false;
  scheduleResize();
}

function hidePanel(panel) {
  panel.hidden = true;
  scheduleResize();
}

function openSettings() {
  refreshSettings();
  if (typeof showSettingsGroup === 'function') showSettingsGroup('performance');
  showPanel(settingsPanel);
}

byId('closeSettings').addEventListener('click', () => hidePanel(settingsPanel));
byId('versionButton').addEventListener('click', () => showPanel(versionPanel));
byId('closeVersion').addEventListener('click', () => hidePanel(versionPanel));
byId('closeHelp').addEventListener('click', () => hidePanel(helpOverlay));
byId('closeWordDetail').addEventListener('click', () => hidePanel(wordDetailPanel));

function pluralWords(number) {
  return `${number} word${number === 1 ? '' : 's'}`;
}

function optimizerLabel(mode) {
  return mode === 'longNoRuns' ? 'Dramatic' : 'Efficient';
}

function renderOptimizerDescription() {
  byId('optimizerDescription').textContent = optimizerSelect.value === 'longNoRuns'
    ? 'Favors convincing runs of NO answers. It can take slightly longer, but usually feels more theatrical.'
    : 'Keeps performances predictable and avoids unusually long question paths.';
}

function renderInputModeDescription() {
  const meta = {
    ...getMeta(),
    lengthMode: lengthModeSelect.value,
    vowelMode: vowelModeToggle.checked,
    shortMax: Number(byId('shortMax').value) || 5,
    mediumMax: Number(byId('mediumMax').value) || 7
  };
  const parts = [];
  if (meta.lengthMode === 'exact') parts.push('Tap Hangman, draw one blank line per letter, then tap Hangman again. The filtered first question appears in the discreet reveal strip.');
  if (meta.lengthMode === 'bucket') parts.push(`Before starting, hold Hangman and release in the left, middle, or right third for Short (≤${meta.shortMax}), Medium (${meta.shortMax + 1}–${meta.mediumMax}), or Long (${meta.mediumMax + 1}+).`);
  if (meta.vowelMode) parts.push('Before starting, hold Solve and release left, middle, or right for 1, 2, or 3+ distinct vowels. With a known limit of 1 or 2, the tree stops asking vowels after that many vowel YES answers.');
  if (!parts.length) parts.push('No secret input is used. The opening question is shown at the top of Performance settings.');
  byId('inputModeDescription').textContent = parts.join(' ');
}

function renderWords() {
  const container = byId('wordView');
  container.replaceChildren();
  const words = getAllWords().slice().sort();
  const meta = getMeta();
  const groups = meta.omitAmbiguous ? signatureGroups(words) : null;
  words.forEach((word) => {
    const manual = isManuallyOmitted(word, meta);
    const ruleReasons = automaticOmissionReasons(word, words, meta, groups);
    const row = document.createElement('div');
    row.className = 'word-row';
    const nameWrap = document.createElement('div');
    nameWrap.className = 'word-name';
    const name = document.createElement('strong');
    name.textContent = word;
    const state = document.createElement('span');
    state.className = `word-state ${(manual || ruleReasons.length) ? 'omitted' : ''}`;
    if (manual) state.textContent = 'OMITTED MANUALLY';
    else if (ruleReasons.length) state.textContent = `OMITTED BY RULE: ${ruleReasons.join(', ')}`;
    else state.textContent = 'ACTIVE';
    nameWrap.append(name, state);

    const omit = document.createElement('button');
    omit.type = 'button';
    omit.className = 'word-action omit';
    omit.textContent = manual ? 'Include' : 'Omit';
    omit.addEventListener('click', () => {
      const set = new Set(getMeta().omitted || []);
      if (set.has(word)) set.delete(word); else set.add(word);
      getMeta().omitted = Array.from(set);
      saveListMeta();
      rebuildTree();
      refreshSettings();
    });

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'word-action delete';
    remove.textContent = 'Delete';
    remove.addEventListener('click', () => {
      if (!window.confirm(`Delete ${word} from “${currentListName}”?`)) return;
      lists[currentListName] = getAllWords().filter((item) => item !== word);
      getMeta().omitted = (getMeta().omitted || []).filter((item) => item !== word);
      saveLists();
      saveListMeta();
      rebuildTree();
      refreshSettings();
    });
    row.append(nameWrap, omit, remove);
    container.append(row);
  });
}

function renderFirstLetter() {
  const meta = getMeta();
  const active = getActiveWords();
  if (!active.length) {
    byId('firstLetter').textContent = 'No active words remain after omissions and eligibility rules.';
    return;
  }
  if (meta.lengthMode !== 'none' || meta.vowelMode) {
    byId('firstLetter').textContent = 'Assisted mode: the first question is calculated after the length/vowel input and appears discreetly in the reveal strip.';
    return;
  }
  const baseRoot = buildRootFor(active);
  const first = baseRoot?.leaf ? getLeafAnswer(baseRoot) : baseRoot?.ch;
  byId('firstLetter').textContent = first ? `First question: contains ${first}?` : 'No first question available';
}

function renderTreeSummary() {
  const stats = treeAnalysis;
  const total = getAllWords().length;
  const active = getActiveWords().length;
  const omitted = total - active;
  byId('treeSummary').textContent = `${optimizerLabel(getMeta().optimizer)} · ${active} active of ${total} saved${omitted ? ` · ${omitted} omitted` : ''} · ${stats.averageQuestions.toFixed(1)} questions average · ${stats.maxQuestions} maximum · ${stats.averageNos.toFixed(1)} NOs average · ${stats.threePlusNoRun} words reach a 3+ NO streak${stats.ambiguousWords ? ` · ${stats.ambiguousWords} ambiguous` : ''}. Base stats do not include optional performance inputs.`;
}

function renderEligibilitySummary() {
  const total = getAllWords().length;
  const active = getActiveWords().length;
  byId('eligibilitySummary').textContent = `${active} active · ${total - active} omitted from performances · ${total} still saved in the list.`;
}

function refreshListSelect() {
  listSelect.replaceChildren();
  Object.keys(lists).sort().forEach((name) => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    listSelect.append(option);
  });
  listSelect.value = currentListName;
}

function refreshSettings() {
  const meta = getMeta();
  exploreModeToggle.checked = isExploreModeEnabled();
  refreshListSelect();
  framingInput.value = meta.framing;
  optimizerSelect.value = meta.optimizer;
  customOptimizerFields.hidden = meta.optimizer !== 'custom';
  byId('customTargetNos').value = meta.customTargetNos;
  byId('customMaxQuestions').value = meta.customMaxQuestions;
  lengthModeSelect.value = meta.lengthMode;
  byId('bucketFields').hidden = meta.lengthMode !== 'bucket';
  byId('shortMax').value = meta.shortMax;
  byId('mediumMax').value = meta.mediumMax;
  vowelModeToggle.checked = Boolean(meta.vowelMode);
  byId('minLetters').value = meta.minLetters;
  byId('maxLetters').value = meta.maxLetters || '';
  byId('omitPlurals').checked = Boolean(meta.omitPlurals);
  byId('omitBrands').checked = Boolean(meta.omitBrands);
  byId('omitLarge').checked = Boolean(meta.omitLarge);
  byId('omitAmbiguous').checked = Boolean(meta.omitAmbiguous);
  renderOptimizerDescription();
  renderInputModeDescription();
  renderWords();
  renderFirstLetter();
  renderTreeSummary();
  renderEligibilitySummary();
  updateHelp();
}

function rebuildTree() {
  activeWords = getActiveWords();
  root = buildRootFor(activeWords);
  treeAnalysis = analyzeTree(root, activeWords);
  curNode = root;
  answerGroups = [];
  pendingGroup = null;
  cancelPendingTimer();
}

useList.addEventListener('click', () => {
  currentListName = listSelect.value;
  localStorage.setItem(STORAGE_KEYS.activeList, currentListName);
  resetInputState();
  rebuildTree();
  clearAll();
  refreshSettings();
});

byId('saveFraming').addEventListener('click', () => {
  getMeta().framing = framingInput.value.trim() || DEFAULT_FRAMING;
  saveListMeta();
  updateHelp();
  showTransientReveal('SAVED', 750);
});

lengthModeSelect.addEventListener('change', () => {
  byId('bucketFields').hidden = lengthModeSelect.value !== 'bucket';
  renderInputModeDescription();
});
vowelModeToggle.addEventListener('change', renderInputModeDescription);
byId('shortMax').addEventListener('input', renderInputModeDescription);
byId('mediumMax').addEventListener('input', renderInputModeDescription);

byId('saveInputMode').addEventListener('click', () => {
  const meta = getMeta();
  meta.lengthMode = lengthModeSelect.value;
  meta.shortMax = Math.max(2, Number(byId('shortMax').value) || 5);
  meta.mediumMax = Math.max(meta.shortMax + 1, Number(byId('mediumMax').value) || 7);
  meta.vowelMode = vowelModeToggle.checked;
  saveListMeta();
  resetInputState();
  renderFirstLetter();
  updateHelp();
  showTransientReveal('INPUTS SAVED', 850);
});

optimizerSelect.addEventListener('change', () => {
  customOptimizerFields.hidden = optimizerSelect.value !== 'custom';
  renderOptimizerDescription();
});

byId('applyOptimizer').addEventListener('click', () => {
  const meta = getMeta();
  meta.optimizer = optimizerSelect.value;
  meta.customTargetNos = Math.max(0, Number(byId('customTargetNos').value) || 5);
  meta.customMaxQuestions = Math.max(2, Number(byId('customMaxQuestions').value) || 9);
  saveListMeta();
  rebuildTree();
  renderFirstLetter();
  renderTreeSummary();
  showTransientReveal('TREE SAVED', 800);
});

byId('applyEligibility').addEventListener('click', () => {
  const meta = getMeta();
  meta.minLetters = Math.max(1, Number(byId('minLetters').value) || 1);
  meta.maxLetters = Math.max(0, Number(byId('maxLetters').value) || 0);
  meta.omitPlurals = byId('omitPlurals').checked;
  meta.omitBrands = byId('omitBrands').checked;
  meta.omitLarge = byId('omitLarge').checked;
  meta.omitAmbiguous = byId('omitAmbiguous').checked;
  saveListMeta();
  rebuildTree();
  refreshSettings();
  showTransientReveal('RULES APPLIED', 850);
});

addWordInput.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  const [word] = normalizeWords([event.currentTarget.value]);
  if (!word) return;
  if (!getAllWords().includes(word)) lists[currentListName].push(word);
  getMeta().omitted = (getMeta().omitted || []).filter((item) => item !== word);
  saveLists();
  saveListMeta();
  rebuildTree();
  strokes = [];
  answerGroups = [];
  redraw();
  event.currentTarget.value = '';
  refreshSettings();
});

createListBtn.addEventListener('click', () => {
  const name = byId('newListName').value.trim();
  const words = normalizeWords(byId('newListWords').value.split(/\r?\n/));
  if (!name || !words.length) return;
  lists[name] = words;
  listMeta[name] = defaultMetaFor(name);
  currentListName = name;
  localStorage.setItem(STORAGE_KEYS.activeList, currentListName);
  saveLists();
  saveListMeta();
  resetInputState();
  rebuildTree();
  clearAll();
  byId('newListName').value = '';
  byId('newListWords').value = '';
  refreshSettings();
});

function isExploreModeEnabled() {
  return localStorage.getItem(STORAGE_KEYS.exploreMode) === EXPLORE_ON;
}

function syncExploreButton() {
  btnExplore.hidden = true;
  toolbar.classList.remove('explore-enabled');
  scheduleResize();
}

exploreModeToggle.addEventListener('change', () => {
  localStorage.setItem(STORAGE_KEYS.exploreMode, exploreModeToggle.checked ? EXPLORE_ON : '0');
  syncExploreButton();
});

let exploreHistory = [];
let exploreNode = null;
let exploreWords = [];
let exploreReturnToSettings = false;
let exploreView = 'lab';

function setExploreView(view) {
  exploreView = view;
  const labActive = view === 'lab';
  byId('labView').hidden = !labActive;
  byId('practiceView').hidden = labActive;
  byId('labTab').classList.toggle('active', labActive);
  byId('practiceTab').classList.toggle('active', !labActive);
  byId('labTab').setAttribute('aria-selected', String(labActive));
  byId('practiceTab').setAttribute('aria-selected', String(!labActive));
  byId('exploreTitle').textContent = labActive ? 'List Lab' : 'Practice Path';
  byId('exploreBack').textContent = labActive ? 'Done' : (exploreHistory.length ? 'Back' : 'Lab');
  if (labActive) renderLab(); else renderExplore();
}

function openExplore(returnToSettings = false) {
  exploreReturnToSettings = returnToSettings;
  rebuildTree();
  exploreHistory = [];
  exploreNode = root;
  exploreWords = activeWords.slice();
  settingsPanel.hidden = true;
  setExploreView('lab');
  showPanel(explorePanel);
}

function closeExplore() {
  hidePanel(explorePanel);
  if (exploreReturnToSettings) {
    exploreReturnToSettings = false;
    openSettings();
    if (typeof showSettingsGroup === 'function') showSettingsGroup('words');
  }
}

