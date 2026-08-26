'use strict';

const LATE_LIE_MIN_NORMAL_ANSWERS = 2;
const LATE_LIE_MAX_CANDIDATES = 7;
const LATE_LIE_MAX_RECOVERY_QUESTIONS = 7;
const LATE_LIE_SEARCH_LIMIT_MS = 55;
const LATE_LIE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

let lateLieArmed = false;
let lateLieOpportunity = null;
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

function refreshLateLieOpportunity() {
  lateLieOpportunity = null;
  if (!lateLieEnabled() || lateLieArmed || !perfMode || sessionPhase !== 'playing') {
    updateCandidateIndicator();
    return;
  }
  if (answerGroups.length < LATE_LIE_MIN_NORMAL_ANSWERS || !curNode || curNode.leaf || curNode.lateLie) {
    updateCandidateIndicator();
    return;
  }
  const words = curNode.words || [];
  if (words.length < 2 || words.length > LATE_LIE_MAX_CANDIDATES) {
    updateCandidateIndicator();
    return;
  }
  lateLieOpportunity = buildGuaranteedLateLiePlan(words, answeredLetterHistory());
  updateCandidateIndicator();
}

function armLateLieOpportunity() {
  if (!lateLieEnabled() || lateLieArmed || !lateLieOpportunity || sessionPhase !== 'playing') return;
  curNode = lateLieOpportunity;
  lateLieArmed = true;
  lateLieOpportunity = null;
  const activationGroup = answerGroups[answerGroups.length - 1];
  if (activationGroup) {
    activationGroup.lateLieActivated = true;
    activationGroup.nodeAfter = curNode;
  }
  const first = curNode?.leaf ? getLeafAnswer(curNode) : curNode?.ch;
  if (first) showTransientReveal(first, 950);
  updateCandidateIndicator();
}

candidateIndicatorState = function lateLieCandidateIndicatorState() {
  if (!lateLieEnabled()) return { suffix: '', interactive: false, armed: false };
  if (lateLieArmed) {
    return {
      suffix: '•',
      interactive: false,
      armed: true,
      label: `${curNode?.words?.length || 0} candidate words remaining; one-lie recovery armed`
    };
  }
  if (lateLieOpportunity) {
    return {
      suffix: '°',
      interactive: true,
      armed: false,
      label: `${curNode?.words?.length || 0} candidate words remaining; tap to arm one safe lie`
    };
  }
  return { suffix: '', interactive: false, armed: false };
};

function installLateLieIndicator() {
  if (perfDot.dataset.lieBound === '1') return;
  perfDot.dataset.lieBound = '1';
  perfDot.addEventListener('click', armLateLieOpportunity);
}

function resetLateLieSession() {
  lateLieArmed = false;
  lateLieOpportunity = null;
  updateCandidateIndicator();
}

const originalFinalizePendingGroupForLateLie = finalizePendingGroup;
finalizePendingGroup = function finalizePendingGroupWithLateLie() {
  const groupCount = answerGroups.length;
  originalFinalizePendingGroupForLateLie();
  if (answerGroups.length !== groupCount && !lateLieArmed) refreshLateLieOpportunity();
  else updateCandidateIndicator();
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
  lateLieOpportunity = null;
  if (!lateLieArmed) refreshLateLieOpportunity();
  else updateCandidateIndicator();
  return result;
};

const originalSolveForLateLie = solve;
solve = function solveWithLateLie() {
  const result = originalSolveForLateLie();
  resetLateLieSession();
  return result;
};

function installLateLieSettings() {
  const toggle = document.getElementById('lateLieModeToggle');
  const coverageButton = document.getElementById('lateLieCoverageButton');
  if (!toggle || !coverageButton || toggle.dataset.bound === '1') return;
  toggle.dataset.bound = '1';
  toggle.addEventListener('change', () => {
    getMeta().lateLieMode = toggle.checked;
    saveListMeta();
    lateLiePlanCache = new Map();
    clearAll();
    refreshSettings();
    if (toggle.checked) analyzeLateLieCoverage();
  });
  coverageButton.addEventListener('click', analyzeLateLieCoverage);
  refreshLateLieSettings();
}

function refreshLateLieSettings() {
  const toggle = document.getElementById('lateLieModeToggle');
  const description = document.getElementById('lateLieDescription');
  if (toggle) toggle.checked = lateLieEnabled();
  if (description) {
    description.textContent = lateLieEnabled()
      ? `A ° appears only after an exact recovery plan is guaranteed. Tap it to arm up to one false future answer; recovery uses at most ${LATE_LIE_MAX_RECOVERY_QUESTIONS} additional questions.`
      : 'Off. The Progressive Anagram tree runs normally and the remaining-word count stays informational.';
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
    output.textContent = `No guaranteed lie opportunity was found for this ${words.length}-word tree under the current safety limits. The normal performance still works unchanged.`;
  } else {
    const averageCue = available.reduce((sum, result) => sum + result.cueAfter, 0) / available.length;
    const worstRecovery = Math.max(...available.map((result) => result.recoveryDepth));
    const unavailable = results.filter((result) => result.cueAfter === null).slice(0, 8).map((result) => result.word);
    output.textContent = `Opportunity available for ${available.length} of ${words.length} words (${percent}%). It appears after ${averageCue.toFixed(1)} normal answers on average; the longest guaranteed recovery uses ${worstRecovery} more questions.${unavailable.length ? ` No opportunity found for examples: ${unavailable.join(', ')}${results.length - available.length > unavailable.length ? '…' : ''}.` : ''}`;
  }

  button.disabled = false;
  button.textContent = 'Check Opportunities';
  renderFirstLetter();
}

const originalRefreshSettingsForLateLie = refreshSettings;
refreshSettings = function refreshSettingsWithLateLie() {
  originalRefreshSettingsForLateLie();
  refreshLateLieSettings();
};

installLateLieIndicator();
installLateLieSettings();
refreshLateLieSettings();
btnClear.addEventListener('click', resetLateLieSession);
btnUndo.addEventListener('click', () => {
  lateLieArmed = Boolean(curNode?.lateLie || answerGroups.some((group) => group.lateLieActivated));
  lateLieOpportunity = null;
  if (!lateLieArmed) refreshLateLieOpportunity();
  else updateCandidateIndicator();
});
btnSolve.addEventListener('pointerup', () => requestAnimationFrame(resetLateLieSession));
