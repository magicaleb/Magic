'use strict';

const LATE_LIE_MIN_NORMAL_ANSWERS = 2;
const LATE_LIE_MAX_CANDIDATES = 7;
const LATE_LIE_MAX_RECOVERY_QUESTIONS = 7;
const LATE_LIE_SEARCH_LIMIT_MS = 55;
const LATE_LIE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

let lateLieArmed = false;
let lateLiePlanCache = new Map();
let lateLieCoverageRun = 0;

function lateLieEnabled() {
  return Boolean(getMeta().lateLieMode);
}

function lateLieUniqueWords(states) {
  return Array.from(new Set((states || []).map((state) => state.word))).sort();
}

function lateLieStateKey(states) {
  return (states || [])
    .map((state) => `${state.word}:${state.lieUsed ? 1 : 0}`)
    .sort()
    .join(',');
}

function dedupeLateLieStates(states) {
  const seen = new Set();
  return states.filter((state) => {
    const key = `${state.word}:${state.lieUsed ? 1 : 0}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function transitionLateLieStates(states, letter, answerYes) {
  const next = [];
  states.forEach((state) => {
    const truthfulYes = state.word.includes(letter);
    if (truthfulYes === answerYes) next.push({ word: state.word, lieUsed: state.lieUsed });
    if (!state.lieUsed && truthfulYes !== answerYes) next.push({ word: state.word, lieUsed: true });
  });
  return dedupeLateLieStates(next);
}

function makeLateLieLeaf(states) {
  const words = lateLieUniqueWords(states);
  return {
    leaf: true,
    lateLie: true,
    word: words.length === 1 ? words[0] : null,
    words,
    lieStates: states
  };
}

function lateLieQuestionOptions(states, letters) {
  const words = lateLieUniqueWords(states);
  const patterns = new Set();
  const options = [];

  letters.forEach((letter) => {
    const pattern = words.map((word) => word.includes(letter) ? '1' : '0').join('');
    if (!pattern.includes('1') || !pattern.includes('0')) return;
    const inverse = pattern.replace(/[01]/g, (bit) => bit === '1' ? '0' : '1');
    const canonical = pattern < inverse ? pattern : inverse;
    if (patterns.has(canonical)) return;
    patterns.add(canonical);

    const yesStates = transitionLateLieStates(states, letter, true);
    const noStates = transitionLateLieStates(states, letter, false);
    const yesWords = lateLieUniqueWords(yesStates).length;
    const noWords = lateLieUniqueWords(noStates).length;
    const worstWords = Math.max(yesWords, noWords);
    const worstStates = Math.max(yesStates.length, noStates.length);
    const imbalance = Math.abs(yesWords - noWords);
    options.push({ letter, yesStates, noStates, worstWords, worstStates, imbalance });
  });

  return options.sort((a, b) =>
    a.worstWords - b.worstWords ||
    a.worstStates - b.worstStates ||
    a.imbalance - b.imbalance ||
    a.letter.localeCompare(b.letter)
  );
}

function lateLiePairDistanceIsSufficient(words, letters) {
  for (let first = 0; first < words.length; first += 1) {
    for (let second = first + 1; second < words.length; second += 1) {
      let distance = 0;
      for (const letter of letters) {
        if (words[first].includes(letter) !== words[second].includes(letter)) distance += 1;
        if (distance >= 3) break;
      }
      if (distance < 3) return false;
    }
  }
  return true;
}

function buildGuaranteedLateLiePlan(inputWords, usedLetters = []) {
  const words = Array.from(new Set(inputWords || [])).sort();
  if (words.length < 2 || words.length > LATE_LIE_MAX_CANDIDATES) return null;

  const used = new Set(usedLetters || []);
  const letters = LATE_LIE_ALPHABET.filter((letter) => !used.has(letter));
  if (!lateLiePairDistanceIsSufficient(words, letters)) return null;

  const cacheKey = `${words.join('|')}::${Array.from(used).sort().join('')}`;
  if (lateLiePlanCache.has(cacheKey)) return lateLiePlanCache.get(cacheKey);

  const initialStates = words.map((word) => ({ word, lieUsed: false }));
  const memo = new Map();
  const start = window.performance?.now ? window.performance.now() : Date.now();
  const deadline = start + LATE_LIE_SEARCH_LIMIT_MS;
  let timedOut = false;

  function search(states, availableLetters, remainingDepth) {
    const uniqueWords = lateLieUniqueWords(states);
    if (uniqueWords.length <= 1) return makeLateLieLeaf(states);
    if (remainingDepth <= 0 || !availableLetters.length) return null;
    if (Math.ceil(Math.log2(uniqueWords.length)) > remainingDepth) return null;

    const now = window.performance?.now ? window.performance.now() : Date.now();
    if (now > deadline) {
      timedOut = true;
      return null;
    }

    const memoKey = `${remainingDepth}|${availableLetters.join('')}|${lateLieStateKey(states)}`;
    if (memo.has(memoKey)) return memo.get(memoKey);

    const currentKey = lateLieStateKey(states);
    const options = lateLieQuestionOptions(states, availableLetters);
    for (const option of options) {
      if (timedOut) break;
      const yesKey = lateLieStateKey(option.yesStates);
      const noKey = lateLieStateKey(option.noStates);
      if (yesKey === currentKey || noKey === currentKey) continue;

      const nextLetters = availableLetters.filter((letter) => letter !== option.letter);
      const yesNode = option.yesStates.length
        ? search(option.yesStates, nextLetters, remainingDepth - 1)
        : makeLateLieLeaf([]);
      if (!yesNode) continue;
      const noNode = option.noStates.length
        ? search(option.noStates, nextLetters, remainingDepth - 1)
        : makeLateLieLeaf([]);
      if (!noNode) continue;

      const node = {
        leaf: false,
        lateLie: true,
        ch: option.letter,
        words: uniqueWords,
        lieStates: states,
        yesNode,
        noNode
      };
      memo.set(memoKey, node);
      return node;
    }

    memo.set(memoKey, null);
    return null;
  }

  let plan = null;
  const minimumDepth = Math.max(3, Math.ceil(Math.log2(words.length)) + 1);
  for (let depth = minimumDepth; depth <= LATE_LIE_MAX_RECOVERY_QUESTIONS && !timedOut; depth += 1) {
    plan = search(initialStates, letters, depth);
    if (plan) break;
  }

  lateLiePlanCache.set(cacheKey, plan);
  return plan;
}

function lateLieWorstDepth(node) {
  if (!node || node.leaf) return 0;
  return 1 + Math.max(lateLieWorstDepth(node.yesNode), lateLieWorstDepth(node.noNode));
}

function answeredLetterHistory(extraLetter = '') {
  const letters = answerGroups
    .map((group) => group.nodeBefore?.ch)
    .filter((letter) => typeof letter === 'string' && letter.length === 1);
  if (extraLetter && !letters.includes(extraLetter)) letters.push(extraLetter);
  return letters;
}

function planAfterNormalAnswer(nodeBefore, isYes) {
  if (!lateLieEnabled() || lateLieArmed || !nodeBefore || nodeBefore.leaf || nodeBefore.lateLie) return null;
  if (answerGroups.length + 1 < LATE_LIE_MIN_NORMAL_ANSWERS) return null;
  const branch = isYes ? nodeBefore.yesNode : nodeBefore.noNode;
  if (!branch || branch.leaf || !branch.words?.length) return null;
  return buildGuaranteedLateLiePlan(branch.words, answeredLetterHistory(nodeBefore.ch));
}

function installLateLieDot() {
  if (document.getElementById('lateLieDot')) return;
  const dot = document.createElement('div');
  dot.id = 'lateLieDot';
  dot.setAttribute('aria-hidden', 'true');
  app.append(dot);

  const style = document.createElement('style');
  style.id = 'lateLieStyles';
  style.textContent = `
    #lateLieDot{position:absolute;left:25px;bottom:17px;z-index:3;width:7px;height:7px;border-radius:50%;background:#2e6f3e;box-shadow:0 0 0 2px rgba(46,111,62,.18);opacity:0;transform:scale(.7);transition:opacity .18s ease,transform .18s ease;pointer-events:none}
    #lateLieDot.show{opacity:.86;transform:scale(1)}
    #lateLieDot.detected{background:#9a6a10;box-shadow:0 0 0 2px rgba(154,106,16,.18)}
    .late-lie-section .info-box{margin-top:10px}
    .late-lie-legend{display:flex;align-items:flex-start;gap:8px;margin-top:9px;color:#6f6a61;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9px;line-height:1.45}
    .late-lie-legend-dot{flex:0 0 auto;width:7px;height:7px;margin-top:3px;border-radius:50%;background:#2e6f3e;box-shadow:0 0 0 2px rgba(46,111,62,.18)}
    .late-lie-coverage{margin-top:9px;padding:9px 10px;border:1px solid var(--faint);border-radius:8px;background:#fff;color:#5f5a53;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;line-height:1.5}
  `;
  document.head.append(style);
}

function syncLateLieDot() {
  const dot = document.getElementById('lateLieDot');
  if (!dot) return;
  const visible = lateLieEnabled() && lateLieArmed && sessionPhase === 'playing' && perfMode && curNode && !curNode.leaf;
  dot.classList.toggle('show', Boolean(visible));
  const states = curNode?.lieStates || [];
  const lieMustBeUsed = states.length > 0 && states.every((state) => state.lieUsed);
  dot.classList.toggle('detected', Boolean(visible && lieMustBeUsed));
}

function resetLateLieSession() {
  lateLieArmed = false;
  syncLateLieDot();
}

const originalNextPromptForLateLie = nextPromptFor;
nextPromptFor = function nextPromptWithLateLie(node, isYes) {
  if (node?.lateLie) return originalNextPromptForLateLie(node, isYes);
  const plan = planAfterNormalAnswer(node, isYes);
  if (plan) return plan.leaf ? getLeafAnswer(plan) : plan.ch;
  return originalNextPromptForLateLie(node, isYes);
};

finalizePendingGroup = function finalizePendingGroupWithLateLie() {
  cancelPendingTimer();
  if (!pendingGroup) return;
  if (!pendingGroup.strokes.length) {
    pendingGroup = null;
    return;
  }

  const nodeBefore = pendingGroup.nodeBefore;
  let nodeAfter = nodeBefore && !nodeBefore.leaf
    ? (pendingGroup.isYes ? nodeBefore.yesNode : nodeBefore.noNode)
    : nodeBefore;
  let lateLieActivated = false;

  if (!lateLieArmed) {
    const plan = planAfterNormalAnswer(nodeBefore, pendingGroup.isYes);
    if (plan) {
      nodeAfter = plan;
      lateLieArmed = true;
      lateLieActivated = true;
    }
  }

  answerGroups.push({ ...pendingGroup, nodeAfter, lateLieActivated });
  curNode = nodeAfter;
  pendingGroup = null;
  syncLateLieDot();
};

const originalResetBoardForLateLie = resetBoard;
resetBoard = function resetBoardWithLateLie(options) {
  resetLateLieSession();
  return originalResetBoardForLateLie(options);
};

const originalClearAllForLateLie = clearAll;
clearAll = function clearAllWithLateLie() {
  const result = originalClearAllForLateLie();
  resetLateLieSession();
  return result;
};

const originalRebuildTreeForLateLie = rebuildTree;
rebuildTree = function rebuildTreeWithLateLie() {
  lateLiePlanCache = new Map();
  resetLateLieSession();
  return originalRebuildTreeForLateLie();
};

const originalUndoForLateLie = undo;
undo = function undoWithLateLie() {
  const result = originalUndoForLateLie();
  lateLieArmed = Boolean(curNode?.lateLie || answerGroups.some((group) => group.lateLieActivated));
  syncLateLieDot();
  return result;
};

const originalSolveForLateLie = solve;
solve = function solveWithLateLie() {
  const result = originalSolveForLateLie();
  syncLateLieDot();
  return result;
};

function installLateLieSettings() {
  if (document.getElementById('lateLieModeToggle')) return;
  const group = document.querySelector('.settings-group[data-group="performance"]');
  if (!group) return;

  const section = document.createElement('section');
  section.className = 'section late-lie-section';
  section.innerHTML = `
    <h2>Late Lie Recovery</h2>
    <p class="section-copy">Optionally offer one false letter answer only after the app has narrowed the word enough to guarantee recovery.</p>
    <label class="setting-toggle">
      <input type="checkbox" id="lateLieModeToggle">
      <span><strong>Enable the late-lie cue</strong><small>The spectator may reverse one future YES or NO. You never need to know which answer was false.</small></span>
    </label>
    <div class="late-lie-legend"><span class="late-lie-legend-dot"></span><span>When this discreet green dot appears on the performance screen, you may say they can lie once from the next letter onward. If it turns amber, every surviving path says the lie has already been used. No dot means the app has not found a guaranteed recovery path yet.</span></div>
    <div id="lateLieDescription" class="info-box"></div>
    <button id="lateLieCoverageButton" class="settings-action secondary" type="button">Check Cue Coverage</button>
    <div id="lateLieCoverage" class="late-lie-coverage">Coverage has not been checked for this list.</div>
  `;
  group.append(section);

  const toggle = document.getElementById('lateLieModeToggle');
  toggle.addEventListener('change', () => {
    getMeta().lateLieMode = toggle.checked;
    saveListMeta();
    lateLiePlanCache = new Map();
    clearAll();
    refreshLateLieSettings();
  });
  document.getElementById('lateLieCoverageButton').addEventListener('click', analyzeLateLieCoverage);
  refreshLateLieSettings();
}

function refreshLateLieSettings() {
  const toggle = document.getElementById('lateLieModeToggle');
  const description = document.getElementById('lateLieDescription');
  if (toggle) toggle.checked = lateLieEnabled();
  if (description) {
    description.textContent = lateLieEnabled()
      ? `Active. The cue waits for at least ${LATE_LIE_MIN_NORMAL_ANSWERS} normal answers, no more than ${LATE_LIE_MAX_CANDIDATES} remaining candidates, and an exact recovery plan requiring at most ${LATE_LIE_MAX_RECOVERY_QUESTIONS} additional letter questions.`
      : 'Off. Performances continue to use the selected normal decision tree.';
  }
}

async function analyzeLateLieCoverage() {
  const runId = ++lateLieCoverageRun;
  const button = document.getElementById('lateLieCoverageButton');
  const output = document.getElementById('lateLieCoverage');
  const words = getActiveWords();
  if (!button || !output || !words.length) return;

  button.disabled = true;
  button.textContent = 'Checking…';
  output.textContent = 'Testing truthful paths and looking for the first guaranteed point where one future lie becomes safe.';
  lateLiePlanCache = new Map();
  const analysisRoot = buildRootFor(words);
  const results = [];

  for (let index = 0; index < words.length; index += 1) {
    if (runId !== lateLieCoverageRun) return;
    const word = words[index];
    let node = analysisRoot;
    const usedLetters = [];
    let answered = 0;
    let result = null;

    while (node && !node.leaf) {
      const letter = node.ch;
      const yes = word.includes(letter);
      node = yes ? node.yesNode : node.noNode;
      usedLetters.push(letter);
      answered += 1;

      if (answered >= LATE_LIE_MIN_NORMAL_ANSWERS && node && !node.leaf && node.words?.length <= LATE_LIE_MAX_CANDIDATES) {
        const plan = buildGuaranteedLateLiePlan(node.words, usedLetters);
        if (plan) {
          result = { word, cueAfter: answered, recoveryDepth: lateLieWorstDepth(plan) };
          break;
        }
      }
    }

    results.push(result || { word, cueAfter: null, recoveryDepth: null });
    if (index % 5 === 4) {
      output.textContent = `Checked ${index + 1} of ${words.length} words…`;
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    }
  }

  const available = results.filter((result) => result.cueAfter !== null);
  const percent = Math.round((available.length / words.length) * 100);
  if (!available.length) {
    output.textContent = `No guaranteed late-lie cue was found for this ${words.length}-word tree under the current safety limits. The normal performance still works unchanged.`;
  } else {
    const averageCue = available.reduce((sum, result) => sum + result.cueAfter, 0) / available.length;
    const worstRecovery = Math.max(...available.map((result) => result.recoveryDepth));
    const unavailable = results.filter((result) => result.cueAfter === null).slice(0, 8).map((result) => result.word);
    output.textContent = `Cue available for ${available.length} of ${words.length} words (${percent}%). It appears after ${averageCue.toFixed(1)} normal answers on average; the longest guaranteed recovery uses ${worstRecovery} more questions.${unavailable.length ? ` No cue found for examples: ${unavailable.join(', ')}${results.length - available.length > unavailable.length ? '…' : ''}.` : ''}`;
  }

  button.disabled = false;
  button.textContent = 'Check Cue Coverage';
}

const originalRefreshSettingsForLateLie = refreshSettings;
refreshSettings = function refreshSettingsWithLateLie() {
  originalRefreshSettingsForLateLie();
  refreshLateLieSettings();
};

installLateLieDot();
installLateLieSettings();
refreshLateLieSettings();
