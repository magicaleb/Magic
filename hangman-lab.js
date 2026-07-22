'use strict';

function makeStatCard(value, label) {
  const card = document.createElement('div');
  card.className = 'stat-card';
  const number = document.createElement('span');
  number.className = 'stat-value';
  number.textContent = value;
  const caption = document.createElement('span');
  caption.className = 'stat-label';
  caption.textContent = label;
  card.append(number, caption);
  return card;
}

function makePattern(path, limit = Infinity) {
  const fragment = document.createDocumentFragment();
  path.slice(0, limit).forEach((step) => {
    const chip = document.createElement('span');
    chip.className = `pattern-chip ${step.yes ? 'yes' : 'no'}`;
    chip.textContent = `${step.letter} ${step.yes ? 'Y' : 'N'}`;
    fragment.append(chip);
  });
  if (path.length > limit) {
    const more = document.createElement('span');
    more.className = 'pattern-chip';
    more.textContent = `+${path.length - limit}`;
    fragment.append(more);
  }
  return fragment;
}

function currentLabFilters() {
  return {
    search: byId('labSearch').value.trim().toUpperCase(),
    sort: byId('labSort').value,
    minNoRun: Number(byId('filterMinNoRun').value) || 0,
    maxQuestions: Number(byId('filterMaxQuestions').value) || Infinity,
    ambiguous: byId('filterAmbiguous').checked,
    framing: byId('filterFraming').checked
  };
}

function filteredAnalyses() {
  const filters = currentLabFilters();
  const items = treeAnalysis.analyses.filter((item) => {
    if (filters.search && !item.word.includes(filters.search)) return false;
    if (item.longestNoRun < filters.minNoRun) return false;
    if (item.questions > filters.maxQuestions) return false;
    if (filters.ambiguous && !item.ambiguous) return false;
    if (filters.framing && !item.flags.length) return false;
    return true;
  });
  items.sort((a, b) => {
    if (filters.sort === 'totalNo') return b.totalNo - a.totalNo || b.longestNoRun - a.longestNoRun || a.word.localeCompare(b.word);
    if (filters.sort === 'questions') return b.questions - a.questions || b.totalNo - a.totalNo || a.word.localeCompare(b.word);
    if (filters.sort === 'openingNo') return b.openingNoRun - a.openingNoRun || b.longestNoRun - a.longestNoRun || a.word.localeCompare(b.word);
    if (filters.sort === 'alphabetical') return a.word.localeCompare(b.word);
    return b.longestNoRun - a.longestNoRun || b.totalNo - a.totalNo || a.word.localeCompare(b.word);
  });
  return items;
}

function renderLab() {
  byId('labFraming').textContent = `Framing: ${getMeta().framing} Base-tree statistics exclude omitted words but do not apply the optional length/vowel input.`;
  const stats = treeAnalysis;
  byId('labStats').replaceChildren(
    makeStatCard(stats.averageQuestions.toFixed(1), 'Average questions'),
    makeStatCard(stats.maxQuestions, 'Worst case'),
    makeStatCard(stats.averageNos.toFixed(1), 'Average NOs'),
    makeStatCard(stats.threePlusNoRun, 'Words with 3+ NO streak')
  );
  const analyses = filteredAnalyses();
  byId('labResultCount').textContent = `${pluralWords(analyses.length)} shown · ${getAllWords().length - getActiveWords().length} omitted · ${stats.framingIssues} framing flags · ${stats.ambiguousWords} ambiguous`;
  const list = byId('labWordList');
  list.replaceChildren();
  if (!analyses.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No active words match these filters.';
    list.append(empty);
    return;
  }
  analyses.forEach((analysis) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'lab-word-card';
    card.addEventListener('click', () => openWordDetail(analysis.word));
    const main = document.createElement('div');
    main.className = 'lab-word-main';
    const name = document.createElement('div');
    name.className = 'lab-word-name';
    const text = document.createElement('span');
    text.textContent = analysis.word;
    name.append(text);
    if (analysis.ambiguous) {
      const badge = document.createElement('span');
      badge.className = 'ambiguous-badge';
      badge.textContent = 'AMBIGUOUS';
      name.append(badge);
    }
    if (analysis.flags.length) {
      const badge = document.createElement('span');
      badge.className = 'issue-badge';
      badge.textContent = `${analysis.flags.length} FLAG${analysis.flags.length === 1 ? '' : 'S'}`;
      name.append(badge);
    }
    const pattern = document.createElement('div');
    pattern.className = 'lab-word-pattern';
    pattern.append(makePattern(analysis.path, 8));
    main.append(name, pattern);
    const metrics = document.createElement('div');
    metrics.className = 'lab-metrics';
    [['Q', analysis.questions], ['NO', analysis.totalNo], ['RUN', analysis.longestNoRun]].forEach(([label, value]) => {
      const metric = document.createElement('div');
      metric.className = 'metric-mini';
      const strong = document.createElement('strong');
      strong.textContent = value;
      const span = document.createElement('span');
      span.textContent = label;
      metric.append(strong, span);
      metrics.append(metric);
    });
    card.append(main, metrics);
    list.append(card);
  });
}

function openWordDetail(word) {
  const analysis = treeAnalysis.analyses.find((item) => item.word === word);
  if (!analysis) return;
  byId('detailWord').textContent = analysis.word;
  byId('detailSummary').textContent = analysis.ambiguous ? 'Not uniquely identifiable' : 'Uniquely identifiable';
  byId('detailMetrics').replaceChildren(
    makeStatCard(analysis.questions, 'Questions'),
    makeStatCard(analysis.totalNo, 'Total NOs'),
    makeStatCard(analysis.openingNoRun, 'Opening NO streak'),
    makeStatCard(analysis.longestNoRun, 'Longest NO streak')
  );
  byId('detailPattern').replaceChildren(makePattern(analysis.path));
  byId('detailPath').replaceChildren(...analysis.path.map((step, index) => {
    const row = document.createElement('div');
    row.className = `detail-step ${step.yes ? 'yes' : 'no'}`;
    const number = document.createElement('span');
    number.className = 'number';
    number.textContent = `${index + 1}.`;
    const question = document.createElement('span');
    question.textContent = `Contains ${step.letter}?`;
    const answer = document.createElement('span');
    answer.className = 'answer';
    answer.textContent = step.yes ? 'YES' : 'NO';
    row.append(number, question, answer);
    return row;
  }));
  const flags = byId('detailFlags');
  flags.className = 'flag-list';
  if (analysis.flags.length) {
    flags.replaceChildren(...analysis.flags.map((text) => {
      const flag = document.createElement('div');
      flag.className = 'flag-item';
      flag.textContent = text;
      return flag;
    }));
  } else {
    const clear = document.createElement('div');
    clear.className = 'flag-clear';
    clear.textContent = 'No automatic framing issues detected. These checks are heuristic.';
    flags.replaceChildren(clear);
  }
  showPanel(wordDetailPanel);
}

['labSearch','labSort','filterMinNoRun','filterMaxQuestions','filterAmbiguous','filterFraming'].forEach((id) => {
  const eventName = id === 'filterAmbiguous' || id === 'filterFraming' ? 'change' : 'input';
  byId(id).addEventListener(eventName, renderLab);
});

function resetExplore() {
  exploreHistory = [];
  exploreNode = root;
  exploreWords = activeWords.slice();
  renderExplore();
}

function renderExplorePath() {
  const path = byId('explorePath');
  path.replaceChildren();
  exploreHistory.forEach((item, index) => {
    if (index) {
      const separator = document.createElement('span');
      separator.className = 'path-sep';
      separator.textContent = '→';
      path.append(separator);
    }
    const step = document.createElement('span');
    step.className = `path-item ${item.yes ? 'yes' : 'no'}`;
    step.textContent = `${item.ch}${item.yes ? '✓' : '✗'}`;
    path.append(step);
  });
  if (exploreHistory.length) requestAnimationFrame(() => { path.scrollLeft = path.scrollWidth; });
}

function setBranchCard(prefix, node, words, contains) {
  byId(`explore${prefix}Rule`).textContent = `${contains ? 'Contains' : 'Does not contain'} ${exploreNode.ch}`;
  byId(`explore${prefix}Count`).textContent = pluralWords(words.length);
  if (node.leaf) {
    byId(`explore${prefix}Next`).textContent = '';
    byId(`explore${prefix}Leaf`).textContent = words.length === 1 ? `Match: ${words[0]}` : 'Finish branch';
  } else {
    byId(`explore${prefix}Next`).textContent = `Next: ${node.ch}?`;
    byId(`explore${prefix}Leaf`).textContent = '';
  }
}

function renderExplore() {
  const node = exploreNode;
  const words = exploreWords;
  const question = byId('exploreQuestion');
  const branches = byId('exploreBranches');
  const leafCard = byId('exploreLeafCard');
  const hint = byId('exploreHint');
  renderExplorePath();
  byId('exploreStatus').textContent = `${currentListName} · ${pluralWords(words.length)} remaining`;
  byId('exploreBack').textContent = exploreHistory.length ? 'Back' : 'Lab';
  if (node?.leaf) {
    question.style.display = 'none';
    branches.style.display = 'none';
    leafCard.style.display = 'block';
    const leafWords = node.words?.length ? node.words : words;
    const hasOne = leafWords.length === 1;
    byId('exploreLeafLabel').textContent = hasOne ? 'MATCH' : (leafWords.length ? 'POSSIBLE MATCHES' : 'NO MATCH');
    byId('exploreLeafWord').textContent = hasOne ? leafWords[0] : `${leafWords.length} WORDS`;
    byId('exploreLeafDetail').textContent = hasOne ? 'The path has identified the word.' : (leafWords.length ? 'These words have the same unique letter set and cannot be separated by letter-presence questions.' : 'No matching active word.');
    hint.textContent = hasOne ? `Finished in ${exploreHistory.length} questions.` : 'The remaining chips are unresolved possibilities.';
  } else if (node) {
    leafCard.style.display = 'none';
    question.style.display = 'block';
    branches.style.display = 'flex';
    question.textContent = `Does the word contain ${node.ch}?`;
    hint.textContent = "Choose the answer for the spectator's word.";
    const yesWords = words.filter((word) => word.includes(node.ch));
    const noWords = words.filter((word) => !word.includes(node.ch));
    setBranchCard('Yes', node.yesNode, yesWords, true);
    setBranchCard('No', node.noNode, noWords, false);
  }
  const grid = byId('exploreWordsGrid');
  byId('exploreWordsHeader').textContent = `${pluralWords(words.length)} remaining`;
  grid.replaceChildren(...words.slice().sort().map((word) => {
    const chip = document.createElement('span');
    chip.className = 'explore-word';
    chip.textContent = word;
    return chip;
  }));
}

function stepExplore(isYes) {
  if (!exploreNode || exploreNode.leaf) return;
  exploreHistory.push({ ch: exploreNode.ch, yes: isYes });
  exploreWords = exploreWords.filter((word) => hasLetter(word, exploreNode.ch) === isYes);
  exploreNode = isYes ? exploreNode.yesNode : exploreNode.noNode;
  renderExplore();
}

function replayExploreHistory() {
  exploreNode = root;
  exploreWords = activeWords.slice();
  exploreHistory.forEach((step) => {
    exploreWords = exploreWords.filter((word) => hasLetter(word, exploreNode.ch) === step.yes);
    exploreNode = step.yes ? exploreNode.yesNode : exploreNode.noNode;
  });
}

btnExplore.addEventListener('click', () => openExplore(false));
byId('openExploreSettings').addEventListener('click', () => openExplore(true));
byId('exploreClose').addEventListener('click', closeExplore);
byId('exploreRestart').addEventListener('click', resetExplore);
byId('exploreYesCard').addEventListener('click', () => stepExplore(true));
byId('exploreNoCard').addEventListener('click', () => stepExplore(false));
byId('labTab').addEventListener('click', () => setExploreView('lab'));
byId('practiceTab').addEventListener('click', () => {
  resetExplore();
  setExploreView('practice');
});
byId('exploreBack').addEventListener('click', () => {
  if (exploreView === 'lab') {
    closeExplore();
    return;
  }
  if (!exploreHistory.length) {
    setExploreView('lab');
    return;
  }
  exploreHistory.pop();
  replayExploreHistory();
  renderExplore();
});

function updateHelp() {
  const meta = getMeta();
  byId('helpFraming').textContent = `Suggested framing: “${meta.framing}”`;
  const instructions = [];
  if (meta.lengthMode === 'exact') instructions.push('Classic Length Mode: tap Hangman, draw one blank line per letter, then tap Hangman again. The app counts the blanks, filters the list, and shows the first question faintly beneath the buttons.');
  else if (meta.lengthMode === 'bucket') instructions.push(`Length Bucket Mode: before starting, hold Hangman and release left for Short (≤${meta.shortMax}), middle for Medium (${meta.shortMax + 1}–${meta.mediumMax}), or right for Long (${meta.mediumMax + 1}+). Then tap Hangman normally.`);
  else instructions.push('No length input: note the First Question in Settings, then tap Hangman to begin.');
  if (meta.vowelMode) instructions.push('Vowel input: before starting, hold Solve and release left, middle, or right for 1, 2, or 3+ distinct vowels.');
  byId('helpInputMode').textContent = instructions.join(' ');
}

function initializeViewport() {
  syncDisplayMode();
  syncLegacyViewportHeight();
  scheduleResize();
  const resizeObserver = new ResizeObserver(scheduleResize);
  resizeObserver.observe(app);
  resizeObserver.observe(canvas);
  resizeObserver.observe(toolbar);
  window.addEventListener('resize', scheduleResize, { passive: true });
  window.addEventListener('orientationchange', () => {
    window.setTimeout(scheduleResize, 60);
    window.setTimeout(scheduleResize, 300);
  }, { passive: true });
  window.visualViewport?.addEventListener('resize', scheduleResize, { passive: true });
  window.matchMedia('(display-mode: standalone)').addEventListener?.('change', syncDisplayMode);
  window.matchMedia('(display-mode: fullscreen)').addEventListener?.('change', syncDisplayMode);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleResize(); });
  document.addEventListener('gesturestart', (event) => event.preventDefault(), { passive: false });
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js', { updateViaCache: 'none' }).catch(() => {});
  }, { once: true });
}

byId('versionButton').textContent = `V${APP_VERSION} · ${APP_DATE}`;
setTool('draw');
syncExploreButton();
refreshSettings();
initializeViewport();
registerServiceWorker();
