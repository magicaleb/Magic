'use strict';

const APP_VERSION = '2.7.0';
const APP_DATE = 'Aug 25, 2026';
const ADVANCE_DELAY = 650;
const LONG_PRESS_DELAY = 420;
const EXPLORE_ON = '1';
const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);
const DEFAULT_FRAMING = 'Think of a common physical object you could comfortably hold in one hand. Use the simplest one-word name for it—no brand names or plurals—and choose something you can spell confidently.';

const DEFAULT_LIST = [
  'AIRFRESHENER','AIRPODS','BACKPACK','BASKET','BATHTUB','BATTERY','BED','BENCH','BLANKET','BLENDER','BOOK','BOOKEND','BOTTLE','BOWL','BRACELET','BROOM','BRUSH','BUCKET','CABINET','CALENDAR','CAMERA','CANDLE','CARDS','CARPET','CHAIR','CHARGER','CLOCK','COASTER','COMB','COMPUTER','COUCH','DESK','DOORKNOB','DRAWER','DRESSER','DUSTPAN','ENVELOPE','FRIDGE','GLASS','GLASSES','GLUE','GRATER','GUITAR','HAIRBRUSH','HAIRDRYER','HAIRTIE','HAMMER','HANGER','HEADPHONES','HEATER','HIGHLIGHTER','IRON','KETTLE','KEYBOARD','KEYS','KNIFE','LADLE','LAMP','LIGHTBULB','LIGHTER','LIPBALM','LOTION','MAGAZINE','MARKER','MATCHES','MATTRESS','MIRROR','MOP','MOUSE','MUG','NAILCLIPPERS','NAPKIN','NECKLACE','NOTEBOOK','PAN','PANTRY','PEELER','PEN','PENCIL','PERFUME','PHONE','PICTURE','PILLOW','PLANT','PLATE','PLUNGER','PRINTER','RAZOR','REMOTE','RING','ROPE','SCALE','SCISSORS','SCREWDRIVER','SHAMPOO','SHARPIE','SINK','SOAP','SPEAKER','SPATULA','SPONGE','SPOON','TABLE','TELEVISION','TISSUES','TOASTER','TOILET','TOILETPAPER','TOOLBOX','TOOTHBRUSH','TOOTHPASTE','TOWEL','TRASHCAN','TUPPERWARE','TWEEZERS','UMBRELLA','VACUUM','WALLET','WASHCLOTH','WHISK','WRENCH'
];

const CAR_BRANDS = [
  'TOYOTA','HONDA','FORD','CHEVROLET','NISSAN','BMW','MERCEDES','AUDI','VOLKSWAGEN','HYUNDAI','KIA','SUBARU','MAZDA','TESLA','LEXUS','ACURA','INFINITI','VOLVO','JAGUAR','LANDROVER','PORSCHE','FERRARI','LAMBORGHINI','MASERATI','ALFAROMEO','FIAT','PEUGEOT','RENAULT','CITROEN','SKODA','SEAT','MINI','BENTLEY','ROLLSROYCE','ASTONMARTIN','BUGATTI','MCLAREN','GENESIS','RAM','DODGE','JEEP','CADILLAC','LINCOLN','BUICK','CHRYSLER','MITSUBISHI','SUZUKI','DAIHATSU','GEELY','TATA'
];

const STORAGE_KEYS = {
  lists: 'hangmanLists',
  activeList: 'hangmanActiveList',
  listMeta: 'hangmanListMeta',
  exploreMode: 'exploreMode'
};

const LARGE_OR_FIXED_OBJECTS = new Set([
  'BATHTUB','BED','BENCH','CABINET','CARPET','COUCH','DESK','DRESSER','FRIDGE','MATTRESS','PANTRY','SINK','TABLE','TELEVISION','TOILET'
]);
const LIKELY_BRANDS = new Set(['AIRPODS', 'SHARPIE', 'TUPPERWARE']);
const PLURAL_EXCEPTIONS = new Set(['GLASS']);

const OPTIMIZER_DESCRIPTIONS = {
  progressive: 'Looks ahead and minimizes the worst-case number of NO answers before optimizing typical NOs and total questions.'
};

function byId(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing required element: #${id}`);
  return element;
}

function normalizeWords(words) {
  if (!Array.isArray(words)) return [];
  return Array.from(new Set(words
    .map((word) => String(word).trim().toUpperCase().replace(/[^A-Z]/g, ''))
    .filter(Boolean)));
}

function safeParse(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || 'null');
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function loadLists() {
  const stored = safeParse(STORAGE_KEYS.lists, {});
  const result = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
  Object.keys(result).forEach((name) => { result[name] = normalizeWords(result[name]); });
  if (!result.default?.length) result.default = DEFAULT_LIST.slice();
  if (!result.cars?.length) result.cars = CAR_BRANDS.slice();
  return result;
}

function defaultMetaFor(name) {
  return {
    framing: name === 'cars'
      ? 'Think of a well-known car brand you can spell confidently. Use the common brand name, not a specific model.'
      : DEFAULT_FRAMING,
    optimizer: 'progressive',
    customTargetNos: 5,
    customMaxQuestions: 9,
    omitted: [],
    minLetters: 4,
    maxLetters: 0,
    omitPlurals: false,
    omitBrands: false,
    omitLarge: false,
    omitAmbiguous: false,
    lengthMode: 'none',
    shortMax: 5,
    mediumMax: 7,
    vowelMode: false,
    lateLieMode: false
  };
}

function loadListMeta(listNames) {
  const stored = safeParse(STORAGE_KEYS.listMeta, {});
  const result = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
  listNames.forEach((name) => {
    result[name] = { ...defaultMetaFor(name), ...(result[name] || {}) };
    result[name].omitted = normalizeWords(result[name].omitted || []);
    result[name].optimizer = 'progressive';
  });
  return result;
}

let lists = loadLists();
let listMeta = loadListMeta(Object.keys(lists));
let currentListName = localStorage.getItem(STORAGE_KEYS.activeList) || 'default';
if (!lists[currentListName]) currentListName = 'default';

function saveLists() {
  localStorage.setItem(STORAGE_KEYS.lists, JSON.stringify(lists));
}

function saveListMeta() {
  localStorage.setItem(STORAGE_KEYS.listMeta, JSON.stringify(listMeta));
}

function getAllWords() {
  return lists[currentListName] || [];
}

function getMeta() {
  if (!listMeta[currentListName]) listMeta[currentListName] = defaultMetaFor(currentListName);
  return listMeta[currentListName];
}

function uniqueLetterSignature(word) {
  return Array.from(new Set(word)).sort().join('');
}

function uniqueVowelCount(word) {
  return new Set(Array.from(word).filter((letter) => VOWELS.has(letter))).size;
}

function signatureGroups(words) {
  const groups = new Map();
  words.forEach((word) => {
    const signature = uniqueLetterSignature(word);
    if (!groups.has(signature)) groups.set(signature, []);
    groups.get(signature).push(word);
  });
  return groups;
}

function likelyPlural(word) {
  return word.endsWith('S') && !PLURAL_EXCEPTIONS.has(word);
}

function automaticOmissionReasons(word, words = getAllWords(), meta = getMeta(), groups = null) {
  const reasons = [];
  const minLetters = Math.max(1, Number(meta.minLetters) || 1);
  const maxLetters = Math.max(0, Number(meta.maxLetters) || 0);
  if (word.length < minLetters) reasons.push(`fewer than ${minLetters} letters`);
  if (maxLetters && word.length > maxLetters) reasons.push(`more than ${maxLetters} letters`);
  if (meta.omitPlurals && likelyPlural(word)) reasons.push('likely plural');
  if (meta.omitBrands && LIKELY_BRANDS.has(word)) reasons.push('likely brand');
  if (meta.omitLarge && LARGE_OR_FIXED_OBJECTS.has(word)) reasons.push('likely non-handheld');
  if (meta.omitAmbiguous) {
    const group = (groups || signatureGroups(words)).get(uniqueLetterSignature(word)) || [];
    if (group.length > 1) reasons.push('indistinguishable letter set');
  }
  return reasons;
}

function isManuallyOmitted(word, meta = getMeta()) {
  return new Set(meta.omitted || []).has(word);
}

function getActiveWords() {
  const words = getAllWords();
  const meta = getMeta();
  const groups = meta.omitAmbiguous ? signatureGroups(words) : null;
  return words.filter((word) => !isManuallyOmitted(word, meta) && !automaticOmissionReasons(word, words, meta, groups).length);
}

function framingFlags(word, comparisonWords = getActiveWords(), groups = null) {
  const flags = [];
  if (LARGE_OR_FIXED_OBJECTS.has(word)) flags.push('Likely outside the “comfortably held in one hand” framing.');
  if (LIKELY_BRANDS.has(word)) flags.push('Likely a brand or trademark rather than a generic object.');
  if (likelyPlural(word)) flags.push('Possibly plural; the suggested framing asks for a singular name.');
  if (word.length >= 12) flags.push('Long or compound spelling; it may be difficult for a spectator to spell confidently.');
  const group = (groups || signatureGroups(comparisonWords)).get(uniqueLetterSignature(word)) || [];
  if (group.length > 1) flags.push(`Indistinguishable by letter-presence questions from: ${group.filter((item) => item !== word).join(', ')}.`);
  return flags;
}

function hasLetter(word, letter) {
  return word.includes(letter);
}

function candidateLetters(words, context) {
  const letters = new Set();
  words.forEach((word) => new Set(word).forEach((letter) => letters.add(letter)));
  return Array.from(letters)
    .filter((letter) => !(context.vowelLimit && context.yesVowels >= context.vowelLimit && VOWELS.has(letter)))
    .sort();
}

function splitWords(words, letter) {
  return {
    yes: words.filter((word) => hasLetter(word, letter)),
    no: words.filter((word) => !hasLetter(word, letter))
  };
}

function scoreSplit(words, letter, mode, options, depth, currentNoRun) {
  const { yes, no } = splitWords(words, letter);
  if (!yes.length || !no.length) return null;
  const total = words.length;
  const noRatio = no.length / total;
  const maxBranch = Math.max(yes.length, no.length);
  const imbalance = Math.abs(yes.length - no.length);
  const expectedRemaining = ((yes.length ** 2) + (no.length ** 2)) / total;
  let score;

  if (mode === 'fastest') {
    score = expectedRemaining * 100 + maxBranch * 2 + imbalance;
  } else if (mode === 'balanced') {
    score = maxBranch * 100 + imbalance * 5 + expectedRemaining;
  } else if (mode === 'moreNos') {
    const target = currentNoRun > 0 ? 0.72 : 0.66;
    score = maxBranch * 32 + expectedRemaining * 13 + Math.abs(noRatio - target) * 120 - no.length * 1.5;
  } else if (mode === 'longNoRuns') {
    const target = currentNoRun > 0 ? 0.78 : 0.68;
    const continuationReward = Math.min(currentNoRun, 4) * noRatio * 22;
    score = maxBranch * 28 + expectedRemaining * 12 + Math.abs(noRatio - target) * 105 - no.length * 1.8 - continuationReward;
  } else {
    const maxQuestions = Math.max(2, Number(options.customMaxQuestions) || 9);
    const targetNos = Math.max(0, Number(options.customTargetNos) || 5);
    const targetRatio = Math.min(0.82, Math.max(0.35, targetNos / maxQuestions));
    const remainingBudget = Math.max(1, maxQuestions - depth);
    const idealMaxBranch = 2 ** Math.max(0, remainingBudget - 1);
    const budgetPenalty = Math.max(0, maxBranch - idealMaxBranch) * 180;
    score = maxBranch * 34 + expectedRemaining * 12 + Math.abs(noRatio - targetRatio) * 130 + budgetPenalty;
  }
  return { letter, yes, no, score, maxBranch };
}

function chooseSplit(words, mode, options, depth, currentNoRun, context) {
  return candidateLetters(words, context)
    .map((letter) => scoreSplit(words, letter, mode, options, depth, currentNoRun))
    .filter(Boolean)
    .sort((a, b) => a.score - b.score || a.maxBranch - b.maxBranch || a.letter.localeCompare(b.letter))[0] || null;
}

function makeLeaf(words, depth) {
  const sorted = words.slice().sort();
  return { leaf: true, word: sorted.length === 1 ? sorted[0] : null, words: sorted, depth };
}

function buildTree(words, mode, options, context = { vowelLimit: null, yesVowels: 0 }, depth = 0, currentNoRun = 0) {
  const candidates = words.slice();
  if (candidates.length <= 1) return makeLeaf(candidates, depth);
  const split = chooseSplit(candidates, mode, options, depth, currentNoRun, context);
  if (!split) return makeLeaf(candidates, depth);
  const yesContext = {
    ...context,
    yesVowels: context.yesVowels + (VOWELS.has(split.letter) ? 1 : 0)
  };
  return {
    leaf: false,
    ch: split.letter,
    words: candidates.slice(),
    depth,
    yesNode: buildTree(split.yes, mode, options, yesContext, depth + 1, 0),
    noNode: buildTree(split.no, mode, options, context, depth + 1, currentNoRun + 1)
  };
}

function buildRootFor(words, input = null) {
  const meta = getMeta();
  const vowelLimit = input?.vowelBucket === 1 || input?.vowelBucket === 2 ? input.vowelBucket : null;
  return buildTree(words, meta.optimizer, meta, { vowelLimit, yesVowels: 0 });
}

function lengthBucketFor(word, meta = getMeta()) {
  const shortMax = Math.max(2, Number(meta.shortMax) || 5);
  const mediumMax = Math.max(shortMax + 1, Number(meta.mediumMax) || 7);
  if (word.length <= shortMax) return 'short';
  if (word.length <= mediumMax) return 'medium';
  return 'long';
}

function filterByPerformanceInputs(words, input) {
  return words.filter((word) => {
    if (input.exactLength && word.length !== input.exactLength) return false;
    if (input.lengthBucket && lengthBucketFor(word) !== input.lengthBucket) return false;
    if (input.vowelBucket) {
      const count = uniqueVowelCount(word);
      if (input.vowelBucket < 3 && count !== input.vowelBucket) return false;
      if (input.vowelBucket === 3 && count < 3) return false;
    }
    return true;
  });
}

function analyzeWord(word, tree, comparisonWords, groups) {
  const path = [];
  let node = tree;
  let currentNoRun = 0;
  let longestNoRun = 0;
  let openingNoRun = 0;
  let seenYes = false;
  let totalNo = 0;
  let totalYes = 0;
  while (node && !node.leaf) {
    const yes = hasLetter(word, node.ch);
    path.push({ letter: node.ch, yes });
    if (yes) {
      totalYes += 1;
      currentNoRun = 0;
      seenYes = true;
      node = node.yesNode;
    } else {
      totalNo += 1;
      currentNoRun += 1;
      longestNoRun = Math.max(longestNoRun, currentNoRun);
      if (!seenYes) openingNoRun += 1;
      node = node.noNode;
    }
  }
  const ambiguousWords = node?.words?.length ? node.words : [word];
  return {
    word,
    path,
    questions: path.length,
    totalNo,
    totalYes,
    openingNoRun,
    longestNoRun,
    ambiguous: ambiguousWords.length > 1,
    ambiguousWords,
    flags: framingFlags(word, comparisonWords, groups)
  };
}

function analyzeTree(tree, words) {
  const groups = signatureGroups(words);
  const analyses = words.map((word) => analyzeWord(word, tree, words, groups));
  const count = analyses.length || 1;
  return {
    analyses,
    averageQuestions: analyses.reduce((sum, item) => sum + item.questions, 0) / count,
    maxQuestions: Math.max(0, ...analyses.map((item) => item.questions)),
    averageNos: analyses.reduce((sum, item) => sum + item.totalNo, 0) / count,
    averageLongestNo: analyses.reduce((sum, item) => sum + item.longestNoRun, 0) / count,
    threePlusNoRun: analyses.filter((item) => item.longestNoRun >= 3).length,
    fourPlusNoRun: analyses.filter((item) => item.longestNoRun >= 4).length,
    ambiguousWords: analyses.filter((item) => item.ambiguous).length,
    framingIssues: analyses.filter((item) => item.flags.length).length
  };
}
