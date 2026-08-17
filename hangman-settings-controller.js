'use strict';

function enhancedRenderWords() {
  const container = byId('wordView');
  container.replaceChildren();
  const words = getAllWords().slice().sort();
  const meta = getMeta();
  const groups = meta.omitAmbiguous ? signatureGroups(words) : null;
  const search = byId('wordSearch').value.trim().toUpperCase();
  const filter = byId('wordStatusFilter').value;
  let shown = 0;

  words.forEach((word) => {
    const manual = isManuallyOmitted(word, meta);
    const ruleReasons = automaticOmissionReasons(word, words, meta, groups);
    const omitted = manual || ruleReasons.length > 0;
    if (search && !word.includes(search)) return;
    if (filter === 'active' && omitted) return;
    if (filter === 'omitted' && !omitted) return;
    shown += 1;

    const row = document.createElement('div');
    row.className = 'word-row';
    const nameWrap = document.createElement('div');
    nameWrap.className = 'word-name';
    const name = document.createElement('strong');
    name.textContent = word;
    const state = document.createElement('span');
    state.className = `word-state ${omitted ? 'omitted' : ''}`;
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

    const menu = document.createElement('details');
    menu.className = 'word-menu';
    const summary = document.createElement('summary');
    summary.textContent = 'More';
    menu.append(summary, remove);
    row.append(nameWrap, omit, menu);
    container.append(row);
  });

  if (!shown) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No words match this search and filter.';
    container.append(empty);
  }
}

function startingQuestionFor(input = {}) {
  const candidates = filterByPerformanceInputs(getActiveWords(), input);
  if (!candidates.length) return { text: 'No matching words', short: 'No match', count: 0, warning: true };
  const previewRoot = buildRootFor(candidates, input);
  if (!previewRoot) return { text: 'No first question available', short: 'Unavailable', count: candidates.length, warning: true };
  if (previewRoot.leaf) {
    const answer = getLeafAnswer(previewRoot);
    return {
      text: answer ? `No letter needed — ${answer}` : 'No separating letter question',
      short: answer ? `Word: ${answer}` : 'No separator',
      count: candidates.length,
      warning: !answer
    };
  }
  return { text: `Ask: “Does it contain ${previewRoot.ch}?”`, short: `Contains ${previewRoot.ch}?`, count: candidates.length, letter: previewRoot.ch };
}

function assistLabel(meta = getMeta()) {
  const parts = [];
  if (meta.lengthMode === 'exact') parts.push('Exact length');
  if (meta.lengthMode === 'bucket') parts.push('Rough length');
  if (meta.vowelMode) parts.push('Vowels');
  return parts.join(' + ') || 'None';
}

function startingQuestionInputs(meta, words) {
  const lengthInputs = [];
  if (meta.lengthMode === 'exact') {
    Array.from(new Set(words.map((word) => word.length))).sort((a, b) => a - b).forEach((length) => {
      lengthInputs.push({ label: `${length} letters`, input: { exactLength: length } });
    });
  } else if (meta.lengthMode === 'bucket') {
    lengthInputs.push(
      { label: `Short (≤${meta.shortMax})`, input: { lengthBucket: 'short' } },
      { label: `Medium (${meta.shortMax + 1}–${meta.mediumMax})`, input: { lengthBucket: 'medium' } },
      { label: `Long (${meta.mediumMax + 1}+)`, input: { lengthBucket: 'long' } }
    );
  } else lengthInputs.push({ label: '', input: {} });

  const vowelInputs = meta.vowelMode
    ? [{ label: '1 vowel', value: 1 }, { label: '2 vowels', value: 2 }, { label: '3+ vowels', value: 3 }]
    : [{ label: '', value: null }];

  return lengthInputs.flatMap((length) => vowelInputs.map((vowel) => ({
    label: [length.label, vowel.label].filter(Boolean).join(' · '),
    input: { ...length.input, ...(vowel.value ? { vowelBucket: vowel.value } : {}) }
  })));
}

function enhancedRenderFirstLetter() {
  const meta = getMeta();
  const active = getActiveWords();
  const total = getAllWords().length;
  const assisted = meta.lengthMode !== 'none' || meta.vowelMode;
  const base = startingQuestionFor({});
  const firstLetter = byId('firstLetter');
  firstLetter.classList.toggle('warning', Boolean(base.warning || !active.length));
  firstLetter.textContent = !active.length
    ? 'No active words — adjust the list before performing'
    : assisted ? 'First question depends on your secret input' : base.text;

  byId('readyList').textContent = currentListName;
  byId('readyCount').textContent = `${active.length}/${total} active`;
  byId('readyStrategy').textContent = optimizerLabel(meta.optimizer);
  byId('readyAssist').textContent = assistLabel(meta);
  byId('readyLie').textContent = meta.lateLieMode ? 'On' : 'Off';
  byId('listStatusName').textContent = currentListName;
  byId('listStatusCount').textContent = `${active.length}/${total}`;
  byId('listStatusFirst').textContent = assisted ? 'Varies by input' : base.short;

  const details = byId('firstQuestionDetails');
  const matrix = byId('firstQuestionMatrix');
  const rows = assisted && active.length ? startingQuestionInputs(meta, active) : [];
  details.hidden = !rows.length;
  details.querySelector('summary').textContent = rows.length === 1 ? 'View starting question' : `View ${rows.length} starting questions`;
  matrix.replaceChildren(...rows.map(({ label, input }) => {
    const result = startingQuestionFor(input);
    const card = document.createElement('div');
    card.className = `first-question-row ${result.warning ? 'warning' : ''}`;
    const name = document.createElement('span');
    name.textContent = label || 'No input';
    const question = document.createElement('strong');
    question.textContent = result.short;
    const count = document.createElement('small');
    count.textContent = `${result.count} candidate${result.count === 1 ? '' : 's'}`;
    card.append(name, question, count);
    return card;
  }));

  const builtIn = currentListName === 'default' || currentListName === 'cars';
  byId('renameListBtn').disabled = builtIn;
  byId('deleteListBtn').disabled = builtIn;
}

function enhancedRenderTreeSummary() {
  const stats = treeAnalysis;
  const omitted = getAllWords().length - getActiveWords().length;
  byId('treeSummary').textContent = `${stats.averageQuestions.toFixed(1)} typical questions · ${stats.maxQuestions} maximum · ${stats.averageNos.toFixed(1)} typical NOs${omitted ? ` · ${omitted} words omitted` : ''}.`;
}

function enhancedRefreshListSelect() {
  [listSelect, byId('listSelectManage')].forEach((select) => {
    select.replaceChildren();
    Object.keys(lists).sort().forEach((name) => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      select.append(option);
    });
    select.value = currentListName;
  });
}

renderWords = enhancedRenderWords;
renderFirstLetter = enhancedRenderFirstLetter;
renderTreeSummary = enhancedRenderTreeSummary;
refreshListSelect = enhancedRefreshListSelect;

byId('listSelectManage').addEventListener('change', (event) => {
  listSelect.value = event.currentTarget.value;
  useList.click();
});

byId('duplicateListBtn').addEventListener('click', () => {
  const proposed = window.prompt('Name for the duplicated list:', `${currentListName} copy`)?.trim();
  if (!proposed || lists[proposed]) return;
  lists[proposed] = getAllWords().slice();
  listMeta[proposed] = { ...getMeta(), omitted: [...(getMeta().omitted || [])] };
  currentListName = proposed;
  localStorage.setItem(STORAGE_KEYS.activeList, currentListName);
  saveLists();
  saveListMeta();
  rebuildTree();
  clearAll();
  refreshSettings();
});

byId('renameListBtn').addEventListener('click', () => {
  if (currentListName === 'default' || currentListName === 'cars') return;
  const proposed = window.prompt('New list name:', currentListName)?.trim();
  if (!proposed || proposed === currentListName || lists[proposed]) return;
  lists[proposed] = lists[currentListName];
  listMeta[proposed] = listMeta[currentListName];
  delete lists[currentListName];
  delete listMeta[currentListName];
  currentListName = proposed;
  localStorage.setItem(STORAGE_KEYS.activeList, currentListName);
  saveLists();
  saveListMeta();
  refreshSettings();
});

byId('deleteListBtn').addEventListener('click', () => {
  if (currentListName === 'default' || currentListName === 'cars') return;
  if (!window.confirm(`Delete the “${currentListName}” list? This cannot be undone.`)) return;
  delete lists[currentListName];
  delete listMeta[currentListName];
  currentListName = lists.default ? 'default' : Object.keys(lists)[0];
  localStorage.setItem(STORAGE_KEYS.activeList, currentListName);
  saveLists();
  saveListMeta();
  resetInputState();
  rebuildTree();
  clearAll();
  refreshSettings();
});

byId('wordSearch').addEventListener('input', renderWords);
byId('wordStatusFilter').addEventListener('change', renderWords);
localStorage.setItem(STORAGE_KEYS.exploreMode, '0');
btnExplore.hidden = true;
toolbar.classList.remove('explore-enabled');
refreshSettings();

