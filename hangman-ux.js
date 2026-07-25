'use strict';

const UX_VERSION = '2.3.0';
const UX_DATE = 'Jul 25, 2026';
let uxSaveTimer = null;
let impactCache = { key: '', rows: [] };

function debounceUxSave(action, delay = 180) {
  window.clearTimeout(uxSaveTimer);
  uxSaveTimer = window.setTimeout(action, delay);
}

function clickIfPresent(id) {
  const button = document.getElementById(id);
  if (button && !button.disabled) button.click();
}

function installImmediateSettings() {
  const hideIds = ['useList', 'saveInputMode', 'applyEligibility', 'saveFraming', 'applyOptimizer'];
  hideIds.forEach((id) => document.getElementById(id)?.classList.add('ux-hidden-action'));

  document.getElementById('listSelect')?.addEventListener('change', () => clickIfPresent('useList'));

  ['lengthMode', 'vowelModeToggle', 'shortMax', 'mediumMax'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener(el.matches('select,input[type="checkbox"]') ? 'change' : 'input', () => {
      debounceUxSave(() => clickIfPresent('saveInputMode'));
    });
  });

  ['minLetters', 'maxLetters', 'omitPlurals', 'omitBrands', 'omitLarge', 'omitAmbiguous'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener(el.matches('input[type="checkbox"]') ? 'change' : 'input', () => {
      debounceUxSave(() => clickIfPresent('applyEligibility'));
    });
  });

  ['optimizerSelect', 'customTargetNos', 'customMaxQuestions'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener(el.matches('select') ? 'change' : 'input', () => {
      debounceUxSave(() => clickIfPresent('applyOptimizer'));
    });
  });

  document.getElementById('framingInput')?.addEventListener('input', () => {
    debounceUxSave(() => clickIfPresent('saveFraming'), 450);
  });

  document.getElementById('closeSettings')?.addEventListener('click', () => {
    window.clearTimeout(uxSaveTimer);
    clickIfPresent('saveInputMode');
    clickIfPresent('applyEligibility');
    clickIfPresent('saveFraming');
    clickIfPresent('applyOptimizer');
  }, { capture: true });

  const settingsScroll = document.querySelector('#settingsPanel .panel-scroll');
  if (settingsScroll && !document.getElementById('settingsAutosaveNote')) {
    const note = document.createElement('div');
    note.id = 'settingsAutosaveNote';
    note.className = 'autosave-note';
    note.textContent = 'Changes apply automatically. Delete is the only destructive action.';
    settingsScroll.prepend(note);
  }
}

function yesStats(path) {
  let run = 0;
  let longest = 0;
  let opening = 0;
  let stillOpening = true;
  let total = 0;
  path.forEach((step) => {
    if (step.yes) {
      total += 1;
      run += 1;
      longest = Math.max(longest, run);
      if (stillOpening) opening += 1;
    } else {
      run = 0;
      stillOpening = false;
    }
  });
  return { totalYes: total, longestYesRun: longest, openingYesRun: opening };
}

function candidateProgress(word, tree) {
  let node = tree;
  const rows = [];
  let question = 0;
  while (node && !node.leaf) {
    question += 1;
    const yes = word.includes(node.ch);
    node = yes ? node.yesNode : node.noNode;
    rows.push({ question, remaining: node?.words?.length || 0, yes });
  }
  return rows;
}

function impactKey() {
  const meta = getMeta();
  return JSON.stringify({ list: currentListName, words: getActiveWords(), optimizer: meta.optimizer, no: meta.customTargetNos, max: meta.customMaxQuestions });
}

function computeImpactRows() {
  const key = impactKey();
  if (impactCache.key === key) return impactCache.rows;
  const words = getActiveWords();
  const baselineTree = buildRootFor(words);
  const baseline = analyzeTree(baselineTree, words);
  const baselineByWord = new Map(baseline.analyses.map((item) => [item.word, item]));
  const rows = words.map((word) => {
    const remainingWords = words.filter((item) => item !== word);
    const baseRemaining = remainingWords.map((item) => baselineByWord.get(item)).filter(Boolean);
    const baseRemainingAverage = baseRemaining.reduce((sum, item) => sum + item.questions, 0) / Math.max(1, baseRemaining.length);
    const baseRemainingMax = Math.max(0, ...baseRemaining.map((item) => item.questions));
    const trialTree = buildRootFor(remainingWords);
    const trial = analyzeTree(trialTree, remainingWords);
    const structuralGain = baseRemainingAverage - trial.averageQuestions;
    const worstCaseGain = baseRemainingMax - trial.maxQuestions;
    const analysis = baselineByWord.get(word);
    const ys = yesStats(analysis.path);
    const progress = candidateProgress(word, baselineTree);
    const earlyNarrow = progress.find((step) => step.remaining <= 3 && step.question < analysis.questions);
    const selfBurden = analysis.questions - baseline.averageQuestions;
    const score = structuralGain * 20 + Math.max(0, worstCaseGain) * 3 + Math.max(0, selfBurden) + (analysis.ambiguous ? 3 : 0);
    let recommendation = 'Low structural impact. Keep or remove based on how well it fits the premise.';
    if (analysis.ambiguous) recommendation = 'Collision: omit one of the indistinguishable words unless both are essential.';
    else if (structuralGain >= 0.12 || worstCaseGain >= 1) recommendation = 'Structural drag: temporarily omit it and compare the new tree.';
    else if (selfBurden >= 1.25) recommendation = 'Hard mainly for itself. Keep it if it is common; omitting it will not help the rest much.';
    const presentationRisk = ys.longestYesRun >= 3 || (earlyNarrow && analysis.questions - earlyNarrow.question >= 2);
    return { word, analysis, ...ys, structuralGain, worstCaseGain, selfBurden, score, recommendation, presentationRisk, earlyNarrow };
  }).sort((a, b) => b.score - a.score || b.analysis.questions - a.analysis.questions || a.word.localeCompare(b.word));
  impactCache = { key, rows };
  return rows;
}

function ensureLabControls() {
  const sort = document.getElementById('labSort');
  if (sort && !sort.querySelector('[value="treeDrag"]')) {
    [
      ['treeDrag', 'Highest tree drag'],
      ['longestYes', 'Longest YES streak'],
      ['totalYes', 'Total YESes'],
      ['openingYes', 'Opening YES streak']
    ].forEach(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      sort.append(option);
    });
  }

  const labView = document.getElementById('labView');
  if (labView && !document.getElementById('labActionCenter')) {
    const center = document.createElement('section');
    center.id = 'labActionCenter';
    center.className = 'lab-action-center';
    labView.insertBefore(center, document.getElementById('labFraming')?.nextSibling || labView.firstChild);
  }
}

const originalFilteredAnalyses = filteredAnalyses;
filteredAnalyses = function enhancedFilteredAnalyses() {
  const items = originalFilteredAnalyses();
  const sort = document.getElementById('labSort')?.value;
  const impacts = new Map(computeImpactRows().map((row) => [row.word, row]));
  items.forEach((item) => Object.assign(item, yesStats(item.path), impacts.get(item.word) || {}));
  if (sort === 'treeDrag') items.sort((a, b) => (b.score || 0) - (a.score || 0) || a.word.localeCompare(b.word));
  if (sort === 'longestYes') items.sort((a, b) => b.longestYesRun - a.longestYesRun || b.totalYes - a.totalYes || a.word.localeCompare(b.word));
  if (sort === 'totalYes') items.sort((a, b) => b.totalYes - a.totalYes || b.longestYesRun - a.longestYesRun || a.word.localeCompare(b.word));
  if (sort === 'openingYes') items.sort((a, b) => b.openingYesRun - a.openingYesRun || b.longestYesRun - a.longestYesRun || a.word.localeCompare(b.word));
  return items;
};

function renderActionCenter() {
  const center = document.getElementById('labActionCenter');
  if (!center) return;
  const rows = computeImpactRows();
  const meaningful = rows.filter((row) => row.structuralGain >= 0.08 || row.worstCaseGain >= 1 || row.analysis.ambiguous || row.selfBurden >= 1.25).slice(0, 6);
  center.replaceChildren();
  const header = document.createElement('div');
  header.className = 'action-center-header';
  header.innerHTML = '<strong>Decision Assistant</strong><span>Separates words that burden only themselves from words that worsen paths for the rest of the list.</span>';
  center.append(header);
  if (!meaningful.length) {
    const clear = document.createElement('div');
    clear.className = 'action-clear';
    clear.textContent = 'No single word is creating a meaningful structural problem in this tree.';
    center.append(clear);
    return;
  }
  meaningful.forEach((row) => {
    const card = document.createElement('div');
    card.className = 'impact-card';
    const main = document.createElement('div');
    main.className = 'impact-main';
    const gains = [];
    if (row.structuralGain > 0.01) gains.push(`${row.structuralGain.toFixed(2)} fewer questions for other words`);
    if (row.worstCaseGain > 0) gains.push(`worst case improves by ${row.worstCaseGain}`);
    if (!gains.length) gains.push(`${row.selfBurden >= 0 ? '+' : ''}${row.selfBurden.toFixed(1)} questions versus average for itself`);
    main.innerHTML = `<strong>${row.word}</strong><span>${gains.join(' · ')}</span><small>${row.recommendation}</small>`;
    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'word-action omit';
    action.textContent = 'Omit';
    action.addEventListener('click', () => {
      const meta = getMeta();
      meta.omitted = Array.from(new Set([...(meta.omitted || []), row.word]));
      saveListMeta();
      rebuildTree();
      impactCache.key = '';
      renderLab();
    });
    card.append(main, action);
    center.append(card);
  });
}

function decorateLabCards() {
  const impacts = new Map(computeImpactRows().map((row) => [row.word, row]));
  document.querySelectorAll('#labWordList .lab-word-card').forEach((card) => {
    const name = card.querySelector('.lab-word-name span')?.textContent;
    const row = impacts.get(name);
    if (!row) return;
    const metrics = card.querySelector('.lab-metrics');
    if (metrics && !metrics.querySelector('[data-ux-yes]')) {
      [['YES', row.totalYes], ['Y RUN', row.longestYesRun]].forEach(([label, value]) => {
        const metric = document.createElement('div');
        metric.className = 'metric-mini';
        metric.dataset.uxYes = '1';
        metric.innerHTML = `<strong>${value}</strong><span>${label}</span>`;
        metrics.append(metric);
      });
    }
    if (row.presentationRisk) {
      const badge = document.createElement('span');
      badge.className = 'perception-badge';
      badge.textContent = 'MAY FEEL SOLVED EARLY';
      card.querySelector('.lab-word-name')?.append(badge);
    }
  });
}

const originalRenderLab = renderLab;
renderLab = function enhancedRenderLab() {
  ensureLabControls();
  originalRenderLab();
  const stats = treeAnalysis.analyses.map((item) => yesStats(item.path));
  const avgYes = stats.reduce((sum, item) => sum + item.totalYes, 0) / Math.max(1, stats.length);
  const maxRun = Math.max(0, ...stats.map((item) => item.longestYesRun));
  const statGrid = document.getElementById('labStats');
  if (statGrid) {
    statGrid.append(makeStatCard(avgYes.toFixed(1), 'Average YESes'), makeStatCard(maxRun, 'Longest YES streak'));
  }
  renderActionCenter();
  decorateLabCards();
};

const originalOpenWordDetail = openWordDetail;
openWordDetail = function enhancedOpenWordDetail(word) {
  originalOpenWordDetail(word);
  const row = computeImpactRows().find((item) => item.word === word);
  if (!row) return;
  const scroll = document.querySelector('#wordDetailPanel .panel-scroll');
  let section = document.getElementById('detailDecisionSupport');
  if (!section) {
    section = document.createElement('section');
    section.id = 'detailDecisionSupport';
    section.className = 'section';
    scroll?.prepend(section);
  }
  const early = row.earlyNarrow ? `Only ${row.earlyNarrow.remaining} candidates remain by question ${row.earlyNarrow.question}, with ${row.analysis.questions - row.earlyNarrow.question} questions still to go.` : 'The candidate pool does not collapse unusually early.';
  section.innerHTML = `<h2>Decision Support</h2><div class="decision-box"><strong>${row.recommendation}</strong><span>Tree effect: ${row.structuralGain > 0 ? row.structuralGain.toFixed(2) + ' fewer average questions for the other words if omitted' : 'little measurable improvement for the other words if omitted'}.</span><span>YES profile: ${row.totalYes} total, longest run ${row.longestYesRun}. ${early}</span><small>A high question count by itself does not necessarily mean the word is harming the rest of the list.</small></div>`;
};

function updateVersionUi() {
  const versionButton = document.getElementById('versionButton');
  if (versionButton) versionButton.textContent = `V${UX_VERSION} · ${UX_DATE}`;
  const current = document.querySelector('#versionPanel .panel-header .version');
  if (current) current.textContent = `Current: V${UX_VERSION}`;
  const changelog = document.querySelector('#versionPanel .changelog');
  if (changelog && !changelog.querySelector('[data-version="2.3.0"]')) {
    const article = document.createElement('article');
    article.dataset.version = '2.3.0';
    article.innerHTML = `<h2>V${UX_VERSION} · ${UX_DATE}</h2><p>Made settings apply automatically, added Decision Assistant tree-impact analysis, added YES and YES-streak analytics, added early-solve perception warnings, and slightly increased reveal legibility without changing its background.</p>`;
    changelog.prepend(article);
  }
}

installImmediateSettings();
ensureLabControls();
updateVersionUi();
