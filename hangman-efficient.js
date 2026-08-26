'use strict';

const PROGRESSIVE_EXACT_WORD_LIMIT = 8;
const PROGRESSIVE_CACHE_LIMIT = 7000;
const progressiveChoiceCache = new Map();

function progressiveContextAfterYes(context, letter) {
  return {
    ...context,
    yesVowels: context.yesVowels + (VOWELS.has(letter) ? 1 : 0)
  };
}

function progressiveStateKey(prefix, words, context, depth = '') {
  return `${prefix}|${depth}|${context.vowelLimit || 0}|${context.yesVowels}|${words.slice().sort().join(',')}`;
}

function rememberProgressiveChoice(key, value) {
  if (progressiveChoiceCache.size >= PROGRESSIVE_CACHE_LIMIT) progressiveChoiceCache.clear();
  progressiveChoiceCache.set(key, value);
  return value;
}

function combineProgressiveCosts(yesCost, noCost, yesCount, noCount) {
  const total = yesCount + noCount;
  return {
    expectedNo: ((yesCount * yesCost.expectedNo) + (noCount * (1 + noCost.expectedNo))) / total,
    worstNo: Math.max(yesCost.worstNo, 1 + noCost.worstNo),
    expectedQuestions: 1 + ((yesCount * yesCost.expectedQuestions) + (noCount * noCost.expectedQuestions)) / total,
    worstQuestions: 1 + Math.max(yesCost.worstQuestions, noCost.worstQuestions)
  };
}

function compareProgressiveCosts(first, second) {
  if (first.worstNo !== second.worstNo) return first.worstNo - second.worstNo;
  if (Math.abs(first.expectedNo - second.expectedNo) > 0.000001) return first.expectedNo - second.expectedNo;
  if (Math.abs(first.expectedQuestions - second.expectedQuestions) > 0.000001) return first.expectedQuestions - second.expectedQuestions;
  if (first.worstQuestions !== second.worstQuestions) return first.worstQuestions - second.worstQuestions;
  return (first.maxBranch || 0) - (second.maxBranch || 0) || (first.letter || '').localeCompare(second.letter || '');
}

function progressiveOptions(words, context) {
  return candidateLetters(words, context)
    .map((letter) => {
      const { yes, no } = splitWords(words, letter);
      if (!yes.length || !no.length) return null;
      const expectedRemaining = ((yes.length ** 2) + (no.length ** 2)) / words.length;
      return {
        letter,
        yes,
        no,
        maxBranch: Math.max(yes.length, no.length),
        immediateRank: (no.length / words.length) * 1000 + expectedRemaining
      };
    })
    .filter(Boolean)
    .sort((a, b) =>
      a.immediateRank - b.immediateRank ||
      a.maxBranch - b.maxBranch ||
      a.letter.localeCompare(b.letter)
    );
}

function emptyProgressiveCost() {
  return { expectedNo: 0, worstNo: 0, expectedQuestions: 0, worstQuestions: 0 };
}

function exactProgressiveCost(words, context, memo) {
  if (words.length <= 1) return emptyProgressiveCost();
  const key = progressiveStateKey('exact', words, context);
  if (memo.has(key)) return memo.get(key);

  let best = null;
  progressiveOptions(words, context).forEach((option) => {
    const yesCost = exactProgressiveCost(option.yes, progressiveContextAfterYes(context, option.letter), memo);
    const noCost = exactProgressiveCost(option.no, context, memo);
    const cost = {
      ...combineProgressiveCosts(yesCost, noCost, option.yes.length, option.no.length),
      letter: option.letter,
      maxBranch: option.maxBranch
    };
    if (!best || compareProgressiveCosts(cost, best) < 0) best = cost;
  });

  const result = best || emptyProgressiveCost();
  memo.set(key, result);
  return result;
}

function rolloutProgressiveCost(words, context, memo) {
  if (words.length <= 1) return emptyProgressiveCost();
  if (words.length <= PROGRESSIVE_EXACT_WORD_LIMIT) return exactProgressiveCost(words, context, memo);
  const key = progressiveStateKey('rollout', words, context);
  if (memo.has(key)) return memo.get(key);

  const option = progressiveOptions(words, context)[0];
  if (!option) {
    const empty = emptyProgressiveCost();
    memo.set(key, empty);
    return empty;
  }

  const yesCost = rolloutProgressiveCost(option.yes, progressiveContextAfterYes(context, option.letter), memo);
  const noCost = rolloutProgressiveCost(option.no, context, memo);
  const result = combineProgressiveCosts(yesCost, noCost, option.yes.length, option.no.length);
  memo.set(key, result);
  return result;
}

function estimateProgressiveCost(words, context, plies, memo) {
  if (words.length <= 1) return emptyProgressiveCost();
  if (words.length <= PROGRESSIVE_EXACT_WORD_LIMIT) return exactProgressiveCost(words, context, memo);
  if (plies <= 0) return rolloutProgressiveCost(words, context, memo);
  const key = progressiveStateKey('lookahead', words, context, plies);
  if (memo.has(key)) return memo.get(key);

  let best = null;
  const width = 8;
  progressiveOptions(words, context).slice(0, width).forEach((option) => {
    const yesCost = estimateProgressiveCost(option.yes, progressiveContextAfterYes(context, option.letter), plies - 1, memo);
    const noCost = estimateProgressiveCost(option.no, context, plies - 1, memo);
    const cost = {
      ...combineProgressiveCosts(yesCost, noCost, option.yes.length, option.no.length),
      letter: option.letter,
      maxBranch: option.maxBranch
    };
    if (!best || compareProgressiveCosts(cost, best) < 0) best = cost;
  });

  const result = best || rolloutProgressiveCost(words, context, memo);
  memo.set(key, result);
  return result;
}

function chooseProgressiveSplit(words, context) {
  const key = progressiveStateKey('choice', words, context);
  if (progressiveChoiceCache.has(key)) return progressiveChoiceCache.get(key);

  const memo = new Map();
  const plies = 1;
  const options = progressiveOptions(words, context);
  const candidates = words.length <= PROGRESSIVE_EXACT_WORD_LIMIT ? options : options.slice(0, 8);
  let best = null;

  candidates.forEach((option) => {
    const yesCost = estimateProgressiveCost(option.yes, progressiveContextAfterYes(context, option.letter), plies - 1, memo);
    const noCost = estimateProgressiveCost(option.no, context, plies - 1, memo);
    const cost = combineProgressiveCosts(yesCost, noCost, option.yes.length, option.no.length);
    const candidate = {
      ...option,
      ...cost,
      score: cost.expectedNo
    };
    if (!best || compareProgressiveCosts(candidate, best) < 0) best = candidate;
  });

  return rememberProgressiveChoice(key, best);
}

chooseSplit = function chooseSplitWithProgressiveLookahead(words, mode, options, depth, currentNoRun, context) {
  return chooseProgressiveSplit(words, context);
};
