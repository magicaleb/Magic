'use strict';

const APP_VERSION = '2.1.0';
const APP_DATE = 'Jul 22, 2026';
const ADVANCE_DELAY = 650;
const EXPLORE_ON = '1';
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
const LIKELY_BRANDS = new Set(['AIRPODS','SHARPIE','TUPPERWARE']);
const PLURAL_EXCEPTIONS = new Set(['GLASS']);

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
  const listsObject = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
  Object.keys(listsObject).forEach((name) => { listsObject[name] = normalizeWords(listsObject[name]); });
  if (!listsObject.default?.length) listsObject.default = DEFAULT_LIST.slice();
  if (!listsObject.cars?.length) listsObject.cars = CAR_BRANDS.slice();
  return listsObject;
}

function defaultMetaFor(name) {
  return {
    framing: name === 'cars'
      ? 'Think of a well-known car brand you can spell confidently. Use the common brand name, not a specific model.'
      : DEFAULT_FRAMING,
    optimizer: name === 'cars' ? 'balanced' : 'longNoRuns',
    customTargetNos: 5,
    customMaxQuestions: 9
  };
}

function loadListMeta(listNames) {
  const stored = safeParse(STORAGE_KEYS.listMeta, {});
  const metaObject = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
  listNames.forEach((name) => {
    metaObject[name] = { ...defaultMetaFor(name), ...(metaObject[name] || {}) };
  });
  return metaObject;
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

function getWords() {
  return lists[currentListName] || [];
}

function getMeta() {
  if (!listMeta[currentListName]) listMeta[currentListName] = defaultMetaFor(currentListName);
  return listMeta[currentListName];
}

function hasLetter(word, letter) {
  return word.includes(letter);
}

function candidateLetters(words) {
  const letters = new Set();
  words.forEach((word) => new Set(word).forEach((letter) => letters.add(letter)));
  return Array.from(letters).sort();
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
  const yesCount = yes.length;
  const noCount = no.length;
  const noRatio = noCount / total;
  const maxBranch = Math.max(yesCount, noCount);
  const imbalance = Math.abs(yesCount - noCount);
  const expectedRemaining = ((yesCount * yesCount) + (noCount * noCount)) / total;
  let score;

  if (mode === 'fastest') {
    score = expectedRemaining * 100 + maxBranch * 2 + imbalance;
  } else if (mode === 'balanced') {
    score = maxBranch * 100 + imbalance * 5 + expectedRemaining;
  } else if (mode === 'moreNos') {
    const target = currentNoRun > 0 ? 0.72 : 0.66;
    score = maxBranch * 32 + expectedRemaining * 13 + Math.abs(noRatio - target) * 120 - noCount * 1.5;
  } else if (mode === 'longNoRuns') {
    const target = currentNoRun > 0 ? 0.78 : 0.68;
    const continuationReward = Math.min(currentNoRun, 4) * noRatio * 22;
    score = maxBranch * 28 + expectedRemaining * 12 + Math.abs(noRatio - target) * 105 - noCount * 1.8 - continuationReward;
  } else {
    const maxQuestions = Math.max(2, Number(options.customMaxQuestions) || 9);
    const targetNos = Math.max(0, Number(options.customTargetNos) || 5);
    const targetRatio = Math.min(0.82, Math.max(0.35, targetNos / maxQuestions));
    const remainingBudget = Math.max(1, maxQuestions - depth);
    const idealMaxBranch = Math.pow(2, Math.max(0, remainingBudget - 1));
    const budgetPenalty = Math.max(0, maxBranch - idealMaxBranch) * 180;
    score = maxBranch * 34 + expectedRemaining * 12 + Math.abs(noRatio - targetRatio) * 130 + budgetPenalty;
  }

  return { letter, yes, no, score, noRatio, maxBranch };
}

function chooseSplit(words, mode, options, depth, currentNoRun) {
  return candidateLetters(words)
    .map((letter) => scoreSplit(words, letter, mode, options, depth, currentNoRun))
    .filter(Boolean)
    .sort((a, b) => a.score - b.score || a.maxBranch - b.maxBranch || a.letter.localeCompare(b.letter))[0] || null;
}

function makeLeaf(words, depth) {
  const sorted = words.slice().sort();
  return { leaf: true, word: sorted.length === 1 ? sorted[0] : null, words: sorted, depth };
}

function buildTree(words, mode, options, depth = 0, currentNoRun = 0) {
  const candidates = words.slice();
  if (candidates.length <= 1) return makeLeaf(candidates, depth);
  const split = chooseSplit(candidates, mode, options, depth, currentNoRun);
  if (!split) return makeLeaf(candidates, depth);

  return {
    leaf: false,
    ch: split.letter,
    words: candidates.slice(),
    depth,
    yesNode: buildTree(split.yes, mode, options, depth + 1, 0),
    noNode: buildTree(split.no, mode, options, depth + 1, currentNoRun + 1)
  };
}

function buildRoot() {
  const meta = getMeta();
  return buildTree(getWords(), meta.optimizer, meta, 0, 0);
}

function uniqueLetterSignature(word) {
  return Array.from(new Set(word)).sort().join('');
}

function framingFlags(word, ambiguousWords = []) {
  const flags = [];
  if (LARGE_OR_FIXED_OBJECTS.has(word)) flags.push('Likely outside the “comfortably held in one hand” framing.');
  if (LIKELY_BRANDS.has(word)) flags.push('Likely a brand or trademark rather than a generic object.');
  if (word.endsWith('S') && !PLURAL_EXCEPTIONS.has(word)) flags.push('Possibly plural; the framing asks for a singular name.');
  if (word.length >= 12) flags.push('Long or compound spelling; may be harder for a spectator to spell confidently.');
  if (ambiguousWords.length > 1) flags.push(`Indistinguishable by letter-presence questions from: ${ambiguousWords.filter((item) => item !== word).join(', ')}.`);
  return flags;
}

function analyzeWord(word, tree) {
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
  const flags = framingFlags(word, ambiguousWords);
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
    flags,
    signature: uniqueLetterSignature(word)
  };
}

function analyzeTree(tree) {
  const analyses = getWords().map((word) => analyzeWord(word, tree));
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

let root = buildRoot();
let treeAnalysis = analyzeTree(root);
let curNode = root;

const frame = byId('frame');
const app = byId('app');
const canvas = byId('drawCanvas');
const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
const toolbar = byId('toolbar');
const btnDraw = byId('btnDraw');
const btnErase = byId('btnErase');
const btnUndo = byId('btnUndo');
const btnClear = byId('btnClear');
const btnHangman = byId('btnHangman');
const btnSolve = byId('btnSolve');
const btnExplore = byId('btnExplore');
const peek = byId('peek');
const perfDot = byId('perfDot');
const promptToast = byId('promptToast');
const settingsPanel = byId('settingsPanel');
const explorePanel = byId('explorePanel');
const wordDetailPanel = byId('wordDetailPanel');
const versionPanel = byId('versionPanel');
const helpOverlay = byId('helpOverlay');
const listSelect = byId('listSelect');
const useList = byId('useList');
const addWordInput = byId('addWordInput');
const createListBtn = byId('createListBtn');
const exploreModeToggle = byId('exploreModeToggle');
const framingInput = byId('framingInput');
const optimizerSelect = byId('optimizerSelect');
const customOptimizerFields = byId('customOptimizerFields');

let DPR = Math.max(1, window.devicePixelRatio || 1);
let strokes = [];
let answerGroups = [];
let pendingGroup = null;
let currentStroke = null;
let perfMode = false;
let scaffold = false;
let advanceTimer = null;
let toolMode = 'draw';
let activePointerId = null;
let pointerMode = null;
let isDrawing = false;
let resizeFrame = null;
let groupSequence = 0;
let promptTimer = null;
let gestureCandidate = null;
let lastCornerTap = { left: 0, right: 0 };

function syncDisplayMode() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches;
  const fullscreen = window.matchMedia('(display-mode: fullscreen)').matches;
  const iosStandalone = Boolean(window.navigator.standalone);
  document.documentElement.dataset.displayMode = fullscreen ? 'fullscreen' : (standalone || iosStandalone ? 'standalone' : 'browser');
}

function syncLegacyViewportHeight() {
  if (CSS.supports('height', '100dvh')) return;
  const height = Math.round(window.visualViewport?.height || window.innerHeight);
  document.documentElement.style.setProperty('--app-height', `${height}px`);
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return;
  DPR = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
  const nextWidth = Math.round(rect.width * DPR);
  const nextHeight = Math.round(rect.height * DPR);
  if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
    canvas.width = nextWidth;
    canvas.height = nextHeight;
  }
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  redraw();
}

function scheduleResize() {
  if (resizeFrame) cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => {
    resizeFrame = null;
    syncLegacyViewportHeight();
    document.documentElement.style.setProperty('--toolbar-height', `${Math.round(toolbar.getBoundingClientRect().height)}px`);
    resizeCanvas();
  });
}

function drawScaffold() {
  if (!scaffold) return;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  ctx.strokeStyle = '#1a1814';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(width * 0.15, height * 0.55);
  ctx.lineTo(width * 0.45, height * 0.55);
  ctx.moveTo(width * 0.22, height * 0.55);
  ctx.lineTo(width * 0.22, height * 0.12);
  ctx.moveTo(width * 0.22, height * 0.12);
  ctx.lineTo(width * 0.40, height * 0.12);
  ctx.moveTo(width * 0.40, height * 0.12);
  ctx.lineTo(width * 0.40, height * 0.18);
  ctx.stroke();
}

function redraw() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (width < 1 || height < 1) return;
  ctx.save();
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#f8f4ec';
  ctx.fillRect(0, 0, width, height);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#1a1814';
  drawScaffold();
  strokes.forEach((stroke) => {
    if (!stroke.points.length) return;
    ctx.lineWidth = stroke.lineWidth;
    ctx.beginPath();
    ctx.moveTo(stroke.points[0][0], stroke.points[0][1]);
    for (let index = 1; index < stroke.points.length; index += 1) ctx.lineTo(stroke.points[index][0], stroke.points[index][1]);
    if (stroke.points.length === 1) {
      const [x, y] = stroke.points[0];
      ctx.lineTo(x + 0.01, y + 0.01);
    }
    ctx.stroke();
  });
  ctx.restore();
}

function isYesZone(y) {
  return y > canvas.clientHeight * 0.65;
}

function getLeafAnswer(node) {
  if (!node?.leaf) return '';
  if (node.word) return node.word;
  return node.words?.length ? node.words.join('/') : '?';
}

function nextPromptFor(node, isYes) {
  if (!node) return '';
  if (node.leaf) return getLeafAnswer(node);
  const nextNode = isYes ? node.yesNode : node.noNode;
  return nextNode?.leaf ? getLeafAnswer(nextNode) : nextNode?.ch || '';
}

function showPeek(text) {
  if (text?.length === 1) {
    btnSolve.textContent = `Solv${text}`;
    return;
  }
  peek.textContent = text || '';
  peek.classList.toggle('show', Boolean(text));
}

function hidePeek() {
  peek.classList.remove('show');
  btnSolve.textContent = 'Solve';
}

function showPrompt(text, duration = 1800) {
  window.clearTimeout(promptTimer);
  promptToast.textContent = text;
  promptToast.classList.add('show');
  promptTimer = window.setTimeout(() => promptToast.classList.remove('show'), duration);
}

function cancelPendingTimer() {
  window.clearTimeout(advanceTimer);
  advanceTimer = null;
}

function removeStrokesForGroup(groupId) {
  strokes = strokes.filter((stroke) => stroke.groupId !== groupId);
}

function finalizePendingGroup() {
  cancelPendingTimer();
  if (!pendingGroup) return;
  if (!pendingGroup.strokes.length) {
    pendingGroup = null;
    return;
  }
  const nodeBefore = pendingGroup.nodeBefore;
  const nodeAfter = nodeBefore && !nodeBefore.leaf
    ? (pendingGroup.isYes ? nodeBefore.yesNode : nodeBefore.noNode)
    : nodeBefore;
  const committed = { ...pendingGroup, nodeAfter };
  answerGroups.push(committed);
  curNode = nodeAfter;
  pendingGroup = null;
}

function scheduleGroupCommit() {
  cancelPendingTimer();
  advanceTimer = window.setTimeout(finalizePendingGroup, ADVANCE_DELAY);
}

function beginPendingGroup(isYes) {
  if (pendingGroup && pendingGroup.isYes !== isYes) finalizePendingGroup();
  if (!pendingGroup) {
    pendingGroup = {
      id: `g${++groupSequence}`,
      isYes,
      nodeBefore: curNode,
      strokes: []
    };
  }
  cancelPendingTimer();
  return pendingGroup;
}

function newSession() {
  cancelPendingTimer();
  strokes = [];
  answerGroups = [];
  pendingGroup = null;
  root = buildRoot();
  treeAnalysis = analyzeTree(root);
  curNode = root;
  perfMode = true;
  scaffold = true;
  perfDot.classList.add('show');
  hidePeek();
  redraw();
  const first = root?.leaf ? getLeafAnswer(root) : root?.ch;
  showPrompt(first ? `First question: ${first}` : 'No question available');
}

function clearAll() {
  cancelPendingTimer();
  strokes = [];
  answerGroups = [];
  pendingGroup = null;
  root = buildRoot();
  treeAnalysis = analyzeTree(root);
  curNode = root;
  perfMode = false;
  scaffold = false;
  perfDot.classList.remove('show');
  hidePeek();
  redraw();
}

function getPointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  return [event.clientX - rect.left, event.clientY - rect.top];
}

function eraseAt(x, y) {
  const radius = 20;
  for (let index = strokes.length - 1; index >= 0; index -= 1) {
    const hit = strokes[index].points.some(([pointX, pointY]) => Math.hypot(pointX - x, pointY - y) <= radius);
    if (!hit) continue;
    const [removed] = strokes.splice(index, 1);
    if (pendingGroup?.id === removed.groupId) pendingGroup.strokes = pendingGroup.strokes.filter((stroke) => stroke !== removed);
    answerGroups.forEach((group) => { group.strokes = group.strokes.filter((stroke) => stroke !== removed); });
    redraw();
    return;
  }
}

function detectCorner(event) {
  const rect = canvas.getBoundingClientRect();
  const inTop = event.clientY < rect.top + rect.height * 0.20;
  if (!inTop) return null;
  if (event.clientX < rect.left + rect.width * 0.20) return 'left';
  if (event.clientX > rect.right - rect.width * 0.20) return 'right';
  return null;
}

function handleCornerTap(corner) {
  const now = Date.now();
  if (now - lastCornerTap[corner] < 360) {
    lastCornerTap[corner] = 0;
    if (corner === 'left') {
      updateHelpFraming();
      showPanel(helpOverlay);
    } else {
      openSettings();
    }
  } else {
    lastCornerTap[corner] = now;
  }
}

function onPointerDown(event) {
  if (activePointerId !== null || event.button > 0) return;
  event.preventDefault();
  activePointerId = event.pointerId;
  canvas.setPointerCapture?.(event.pointerId);

  const corner = detectCorner(event);
  if (corner) {
    pointerMode = 'gesture';
    gestureCandidate = { corner, startX: event.clientX, startY: event.clientY, moved: false };
    return;
  }

  pointerMode = toolMode === 'erase' ? 'erase' : 'draw';
  const [x, y] = getPointerPosition(event);

  if (pointerMode === 'erase') {
    eraseAt(x, y);
    isDrawing = true;
    return;
  }

  let groupId = null;
  if (perfMode) {
    const isYes = isYesZone(y);
    const group = beginPendingGroup(isYes);
    groupId = group.id;
    showPeek(nextPromptFor(group.nodeBefore, group.isYes));
  }

  isDrawing = true;
  currentStroke = { points: [[x, y]], lineWidth: 4, groupId };
  ctx.strokeStyle = '#1a1814';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 0.01, y + 0.01);
  ctx.stroke();
}

function onPointerMove(event) {
  if (event.pointerId !== activePointerId) return;
  event.preventDefault();

  if (pointerMode === 'gesture') {
    if (gestureCandidate && Math.hypot(event.clientX - gestureCandidate.startX, event.clientY - gestureCandidate.startY) > 12) gestureCandidate.moved = true;
    return;
  }
  if (!isDrawing) return;
  const [x, y] = getPointerPosition(event);
  if (pointerMode === 'erase') {
    eraseAt(x, y);
    return;
  }
  currentStroke.points.push([x, y]);
  ctx.lineTo(x, y);
  ctx.stroke();
}

function releasePointer(event) {
  activePointerId = null;
  pointerMode = null;
  try { canvas.releasePointerCapture?.(event.pointerId); } catch { /* already released */ }
}

function onPointerEnd(event) {
  if (event.pointerId !== activePointerId) return;
  event.preventDefault();

  if (pointerMode === 'gesture') {
    if (gestureCandidate && !gestureCandidate.moved) handleCornerTap(gestureCandidate.corner);
    gestureCandidate = null;
    releasePointer(event);
    return;
  }

  hidePeek();
  if (pointerMode === 'draw' && isDrawing && currentStroke) {
    strokes.push(currentStroke);
    if (pendingGroup && currentStroke.groupId === pendingGroup.id) {
      pendingGroup.strokes.push(currentStroke);
      scheduleGroupCommit();
    }
  }
  isDrawing = false;
  currentStroke = null;
  releasePointer(event);
}

function setTool(mode) {
  toolMode = mode;
  const drawing = mode === 'draw';
  btnDraw.classList.toggle('active', drawing);
  btnErase.classList.toggle('active', !drawing);
  btnDraw.setAttribute('aria-pressed', String(drawing));
  btnErase.setAttribute('aria-pressed', String(!drawing));
  canvas.style.cursor = drawing ? 'crosshair' : 'cell';
}

function undo() {
  hidePeek();
  if (pendingGroup) {
    const groupId = pendingGroup.id;
    cancelPendingTimer();
    removeStrokesForGroup(groupId);
    curNode = pendingGroup.nodeBefore;
    pendingGroup = null;
    redraw();
    return;
  }
  if (answerGroups.length) {
    const group = answerGroups.pop();
    removeStrokesForGroup(group.id);
    curNode = group.nodeBefore;
    redraw();
    return;
  }
  strokes.pop();
  redraw();
}

function solve() {
  finalizePendingGroup();
  perfMode = false;
  hidePeek();
  perfDot.classList.remove('show');
  const yesIds = new Set(answerGroups.filter((group) => group.isYes).map((group) => group.id));
  strokes = strokes.filter((stroke) => !yesIds.has(stroke.groupId));
  answerGroups = answerGroups.filter((group) => !group.isYes);
  redraw();
}

canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
canvas.addEventListener('pointermove', onPointerMove, { passive: false });
canvas.addEventListener('pointerup', onPointerEnd, { passive: false });
canvas.addEventListener('pointercancel', onPointerEnd, { passive: false });
canvas.addEventListener('contextmenu', (event) => event.preventDefault());
btnDraw.addEventListener('click', () => setTool('draw'));
btnErase.addEventListener('click', () => setTool('erase'));
btnHangman.addEventListener('click', newSession);
btnClear.addEventListener('click', clearAll);
btnUndo.addEventListener('click', undo);
btnSolve.addEventListener('click', solve);

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
  return {
    fastest: 'Fastest Average',
    balanced: 'Balanced Worst Case',
    moreNos: 'More NOs',
    longNoRuns: 'Theatrical NOs',
    custom: 'Custom'
  }[mode] || mode;
}

function renderWords() {
  const container = byId('wordView');
  container.replaceChildren();
  getWords().slice().sort().forEach((word) => {
    const row = document.createElement('div');
    row.className = 'word-row';
    const label = document.createElement('span');
    label.textContent = word;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'word-remove';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Remove ${word}`);
    remove.addEventListener('click', () => {
      lists[currentListName] = getWords().filter((item) => item !== word);
      saveLists();
      rebuildTree();
      refreshSettings();
    });
    row.append(label, remove);
    container.append(row);
  });
}

function renderFirstLetter() {
  const first = root?.leaf ? getLeafAnswer(root) : root?.ch;
  byId('firstLetter').textContent = first ? `First question: contains ${first}?` : 'No first question available';
}

function renderTreeSummary() {
  const stats = treeAnalysis;
  const meta = getMeta();
  byId('treeSummary').textContent = `${optimizerLabel(meta.optimizer)} · ${pluralWords(stats.analyses.length)} · ${stats.averageQuestions.toFixed(1)} questions average · ${stats.maxQuestions} maximum · ${stats.averageNos.toFixed(1)} NOs average · ${stats.threePlusNoRun} words reach a 3+ NO streak${stats.ambiguousWords ? ` · ${stats.ambiguousWords} ambiguous` : ''}`;
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
  renderWords();
  renderFirstLetter();
  renderTreeSummary();
  updateHelpFraming();
}

function rebuildTree() {
  root = buildRoot();
  treeAnalysis = analyzeTree(root);
  curNode = root;
  answerGroups = [];
  pendingGroup = null;
  cancelPendingTimer();
}

useList.addEventListener('click', () => {
  currentListName = listSelect.value;
  localStorage.setItem(STORAGE_KEYS.activeList, currentListName);
  rebuildTree();
  clearAll();
  refreshSettings();
});

byId('saveFraming').addEventListener('click', () => {
  getMeta().framing = framingInput.value.trim() || DEFAULT_FRAMING;
  saveListMeta();
  updateHelpFraming();
  showPrompt('Framing saved');
});

optimizerSelect.addEventListener('change', () => {
  customOptimizerFields.hidden = optimizerSelect.value !== 'custom';
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
  showPrompt(`${optimizerLabel(meta.optimizer)} applied`);
});

addWordInput.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  const [word] = normalizeWords([event.currentTarget.value]);
  if (!word) return;
  if (!getWords().includes(word)) lists[currentListName].push(word);
  saveLists();
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
  saveLists();
  saveListMeta();
  byId('newListName').value = '';
  byId('newListWords').value = '';
  refreshSettings();
});

function isExploreModeEnabled() {
  return localStorage.getItem(STORAGE_KEYS.exploreMode) === EXPLORE_ON;
}

function syncExploreButton() {
  const enabled = isExploreModeEnabled();
  btnExplore.hidden = !enabled;
  toolbar.classList.toggle('explore-enabled', enabled);
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
  exploreHistory = [];
  exploreNode = root;
  exploreWords = getWords().slice();
  settingsPanel.hidden = true;
  setExploreView('lab');
  showPanel(explorePanel);
}

function closeExplore() {
  hidePanel(explorePanel);
  if (exploreReturnToSettings) {
    exploreReturnToSettings = false;
    openSettings();
  }
}

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
  byId('labFraming').textContent = `Framing: ${getMeta().framing}`;
  const stats = treeAnalysis;
  byId('labStats').replaceChildren(
    makeStatCard(stats.averageQuestions.toFixed(1), 'Average questions'),
    makeStatCard(stats.maxQuestions, 'Worst case'),
    makeStatCard(stats.averageNos.toFixed(1), 'Average NOs'),
    makeStatCard(stats.threePlusNoRun, 'Words with 3+ NO streak')
  );

  const analyses = filteredAnalyses();
  byId('labResultCount').textContent = `${pluralWords(analyses.length)} shown · ${stats.framingIssues} total framing flags · ${stats.ambiguousWords} ambiguous words`;
  const list = byId('labWordList');
  list.replaceChildren();

  if (!analyses.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No words match these filters.';
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
  const pattern = byId('detailPattern');
  pattern.replaceChildren(makePattern(analysis.path));
  const path = byId('detailPath');
  path.replaceChildren(...analysis.path.map((step, index) => {
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
    clear.textContent = 'No automatic framing issues detected. These checks are heuristic, so use your performance judgment.';
    flags.replaceChildren(clear);
  }
  showPanel(wordDetailPanel);
}

['labSearch','labSort','filterMinNoRun','filterMaxQuestions','filterAmbiguous','filterFraming'].forEach((id) => {
  byId(id).addEventListener(id.startsWith('filter') && (id === 'filterAmbiguous' || id === 'filterFraming') ? 'change' : 'input', renderLab);
});

function resetExplore() {
  exploreHistory = [];
  exploreNode = root;
  exploreWords = getWords().slice();
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
  byId(`explore${prefix}Card`).setAttribute('aria-label', `${prefix}, the word ${contains ? 'contains' : 'does not contain'} ${exploreNode.ch}. ${pluralWords(words.length)} remain.`);
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
    byId('exploreLeafDetail').textContent = hasOne ? 'The path has identified the word.' : (leafWords.length ? 'These words contain the same unique set of letters and cannot be separated by letter-presence questions.' : 'This list does not contain a matching word.');
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
  exploreWords = getWords().slice();
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

function updateHelpFraming() {
  byId('helpFraming').textContent = `Suggested framing: “${getMeta().framing}”`;
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
