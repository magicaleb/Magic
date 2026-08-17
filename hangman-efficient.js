'use strict';

const LOOKAHEAD_MODE = 'lookahead';
const originalChooseSplitForEfficiency = chooseSplit;

OPTIMIZER_DESCRIPTIONS[LOOKAHEAD_MODE] = 'Experimental. Looks several questions ahead instead of judging only the next split. It primarily minimizes average questions, then uses worst-case depth as a tie-breaker. It may take a moment longer to rebuild large lists.';

function immediateEfficiencyRank(words, letter) {
  const { yes, no } = splitWords(words, letter);
  if (!yes.length || !no.length) return Infinity;
  const total = words.length;
  return 1 + ((yes.length * Math.log2(Math.max(1, yes.length))) + (no.length * Math.log2(Math.max(1, no.length)))) / total;
}

function lookaheadContextAfterYes(context, letter) {
  return {
    ...context,
    yesVowels: context.yesVowels + (VOWELS.has(letter) ? 1 : 0)
  };
}

function estimateLookaheadCost(words, context, plies, memo) {
  if (words.length <= 1) return { expected: 0, worst: 0 };
  if (plies <= 0) {
    const lowerBound = Math.log2(words.length);
    return { expected: lowerBound, worst: Math.ceil(lowerBound) };
  }

  const key = `${plies}|${context.vowelLimit || 0}|${context.yesVowels}|${words.slice().sort().join(',')}`;
  if (memo.has(key)) return memo.get(key);

  const letters = candidateLetters(words, context)
    .map((letter) => ({ letter, rank: immediateEfficiencyRank(words, letter) }))
    .filter((item) => Number.isFinite(item.rank))
    .sort((a, b) => a.rank - b.rank || a.letter.localeCompare(b.letter))
    .slice(0, plies >= 3 ? 9 : 12);

  let best = { expected: Infinity, worst: Infinity };
  letters.forEach(({ letter }) => {
    const { yes, no } = splitWords(words, letter);
    const yesCost = estimateLookaheadCost(yes, lookaheadContextAfterYes(context, letter), plies - 1, memo);
    const noCost = estimateLookaheadCost(no, context, plies - 1, memo);
    const expected = 1 + ((yes.length * yesCost.expected) + (no.length * noCost.expected)) / words.length;
    const worst = 1 + Math.max(yesCost.worst, noCost.worst);
    if (expected < best.expected - 0.0001 || (Math.abs(expected - best.expected) < 0.0001 && worst < best.worst)) {
      best = { expected, worst };
    }
  });

  if (!Number.isFinite(best.expected)) {
    const lowerBound = Math.log2(words.length);
    best = { expected: lowerBound, worst: Math.ceil(lowerBound) };
  }
  memo.set(key, best);
  return best;
}

function chooseLookaheadSplit(words, context) {
  const memo = new Map();
  const plies = words.length <= 70 ? 3 : 2;
  const candidates = candidateLetters(words, context)
    .map((letter) => ({ letter, rank: immediateEfficiencyRank(words, letter) }))
    .filter((item) => Number.isFinite(item.rank))
    .sort((a, b) => a.rank - b.rank || a.letter.localeCompare(b.letter))
    .slice(0, 14);

  return candidates.map(({ letter }) => {
    const { yes, no } = splitWords(words, letter);
    const yesCost = estimateLookaheadCost(yes, lookaheadContextAfterYes(context, letter), plies - 1, memo);
    const noCost = estimateLookaheadCost(no, context, plies - 1, memo);
    const expected = 1 + ((yes.length * yesCost.expected) + (no.length * noCost.expected)) / words.length;
    const worst = 1 + Math.max(yesCost.worst, noCost.worst);
    const score = expected + worst * 0.018;
    return { letter, yes, no, score, maxBranch: Math.max(yes.length, no.length), expected, worst };
  }).sort((a, b) => a.score - b.score || a.worst - b.worst || a.maxBranch - b.maxBranch || a.letter.localeCompare(b.letter))[0] || null;
}

chooseSplit = function chooseSplitWithExperimentalMode(words, mode, options, depth, currentNoRun, context) {
  if (mode === LOOKAHEAD_MODE) return chooseLookaheadSplit(words, context);
  return originalChooseSplitForEfficiency(words, mode, options, depth, currentNoRun, context);
};

// Lookahead remains available for internal analysis, but is intentionally not
// exposed as a separate performance setting. Performers choose an outcome,
// while the app owns the underlying algorithm.
