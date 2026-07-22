'use strict';

const DEFAULT_LIST = [
  'AIRFRESHENER','AIRPODS','BACKPACK','BASKET','BATHTUB','BATTERY','BED','BENCH','BLANKET','BLENDER','BOOK','BOOKEND','BOTTLE','BOWL','BRACELET','BROOM','BRUSH','BUCKET','CABINET','CALENDAR','CAMERA','CANDLE','CARDS','CARPET','CHAIR','CHARGER','CLOCK','COASTER','COMB','COMPUTER','COUCH','DESK','DOORKNOB','DRAWER','DRESSER','DUSTPAN','ENVELOPE','FRIDGE','GLASS','GLASSES','GLUE','GRATER','GUITAR','HAIRBRUSH','HAIRDRYER','HAIRTIE','HAMMER','HANGER','HEADPHONES','HEATER','HIGHLIGHTER','IRON','KETTLE','KEYBOARD','KEYS','KNIFE','LADLE','LAMP','LIGHTBULB','LIGHTER','LIPBALM','LOTION','MAGAZINE','MARKER','MATCHES','MATTRESS','MIRROR','MOP','MOUSE','MUG','NAILCLIPPERS','NAPKIN','NECKLACE','NOTEBOOK','PAN','PANTRY','PEELER','PEN','PENCIL','PERFUME','PHONE','PICTURE','PILLOW','PLANT','PLATE','PLUNGER','PRINTER','RAZOR','REMOTE','RING','ROPE','SCALE','SCISSORS','SCREWDRIVER','SHAMPOO','SHARPIE','SINK','SOAP','SPEAKER','SPATULA','SPONGE','SPOON','TABLE','TELEVISION','TISSUES','TOASTER','TOILET','TOILETPAPER','TOOLBOX','TOOTHBRUSH','TOOTHPASTE','TOWEL','TRASHCAN','TUPPERWARE','TWEEZERS','UMBRELLA','VACUUM','WALLET','WASHCLOTH','WHISK','WRENCH'
];

const CAR_BRANDS = [
  'TOYOTA','HONDA','FORD','CHEVROLET','NISSAN','BMW','MERCEDES','AUDI','VOLKSWAGEN','HYUNDAI','KIA','SUBARU','MAZDA','TESLA','LEXUS','ACURA','INFINITI','VOLVO','JAGUAR','LANDROVER','PORSCHE','FERRARI','LAMBORGHINI','MASERATI','ALFAROMEO','FIAT','PEUGEOT','RENAULT','CITROEN','SKODA','SEAT','MINI','BENTLEY','ROLLSROYCE','ASTONMARTIN','BUGATTI','MCLAREN','GENESIS','RAM','DODGE','JEEP','CADILLAC','LINCOLN','BUICK','CHRYSLER','MITSUBISHI','SUZUKI','DAIHATSU','GEELY','TATA'
];

const STORAGE_KEYS = {
  lists: 'hangmanLists',
  activeList: 'hangmanActiveList',
  exploreMode: 'exploreMode'
};

const EXPLORE_ON = '1';
const ADVANCE_DELAY = 450;

function byId(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing required element: #${id}`);
  return element;
}

function normalizeWords(words) {
  if (!Array.isArray(words)) return [];
  return Array.from(new Set(
    words
      .map((word) => String(word).trim().toUpperCase().replace(/[^A-Z]/g, ''))
      .filter(Boolean)
  ));
}

function loadLists() {
  let stored = {};
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.lists) || '{}');
  } catch {
    stored = {};
  }

  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) stored = {};
  Object.keys(stored).forEach((name) => {
    stored[name] = normalizeWords(stored[name]);
  });

  if (!stored.default?.length) stored.default = DEFAULT_LIST.slice();
  if (!stored.cars?.length) stored.cars = CAR_BRANDS.slice();
  return stored;
}

let lists = loadLists();
let currentListName = localStorage.getItem(STORAGE_KEYS.activeList) || 'default';
if (!lists[currentListName]) currentListName = 'default';

function saveLists() {
  localStorage.setItem(STORAGE_KEYS.lists, JSON.stringify(lists));
}

function getWords() {
  return lists[currentListName] || [];
}

function hasLetter(word, letter) {
  return word.includes(letter);
}

function bestSplit(candidates) {
  const counts = {};

  candidates.forEach((word) => {
    new Set(word).forEach((letter) => {
      counts[letter] = (counts[letter] || 0) + 1;
    });
  });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  for (const [letter, count] of sorted) {
    if (count === 0 || count === candidates.length) continue;
    const yes = candidates.filter((word) => hasLetter(word, letter));
    const no = candidates.filter((word) => !hasLetter(word, letter));
    if (yes.length && no.length) return { ch: letter, yes, no };
  }

  return null;
}

function makeLeaf(candidates) {
  const words = candidates.slice().sort();
  return {
    leaf: true,
    word: words.length === 1 ? words[0] : null,
    words
  };
}

function buildTree(candidates) {
  if (candidates.length <= 1) return makeLeaf(candidates);
  const split = bestSplit(candidates);
  if (!split) return makeLeaf(candidates);

  return {
    leaf: false,
    ch: split.ch,
    yesNode: buildTree(split.yes),
    noNode: buildTree(split.no)
  };
}

function buildRoot() {
  return buildTree(getWords());
}

function getFirstLetter(words) {
  const split = bestSplit(words);
  return split ? split.ch : '?';
}

let root = buildRoot();
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
const settingsPanel = byId('settingsPanel');
const explorePanel = byId('explorePanel');
const helpOverlay = byId('helpOverlay');
const listSelect = byId('listSelect');
const useList = byId('useList');
const addWordInput = byId('addWordInput');
const createListBtn = byId('createListBtn');
const exploreModeToggle = byId('exploreModeToggle');

let DPR = Math.max(1, window.devicePixelRatio || 1);
let strokes = [];
let currentStroke = null;
let treeHistory = [];
let perfMode = false;
let scaffold = false;
let advanceTimer = null;
let strokeGroupStartY = null;
let toolMode = 'draw';
let activePointerId = null;
let isDrawing = false;
let resizeFrame = null;

function syncDisplayMode() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches;
  const fullscreen = window.matchMedia('(display-mode: fullscreen)').matches;
  const iosStandalone = Boolean(window.navigator.standalone);
  document.documentElement.dataset.displayMode = fullscreen
    ? 'fullscreen'
    : (standalone || iosStandalone ? 'standalone' : 'browser');
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
    const toolbarHeight = toolbar.getBoundingClientRect().height;
    document.documentElement.style.setProperty('--toolbar-height', `${Math.round(toolbarHeight)}px`);
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
    for (let index = 1; index < stroke.points.length; index += 1) {
      ctx.lineTo(stroke.points[index][0], stroke.points[index][1]);
    }
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

function advanceTree(isYes) {
  if (!curNode || curNode.leaf) return;
  treeHistory.push(curNode);
  curNode = isYes ? curNode.yesNode : curNode.noNode;
}

function cancelPendingAdvance() {
  window.clearTimeout(advanceTimer);
  advanceTimer = null;
  strokeGroupStartY = null;
}

function scheduleAdvance() {
  window.clearTimeout(advanceTimer);
  advanceTimer = window.setTimeout(() => {
    if (perfMode && strokeGroupStartY !== null && !curNode.leaf) {
      advanceTree(isYesZone(strokeGroupStartY));
    }
    strokeGroupStartY = null;
    advanceTimer = null;
  }, ADVANCE_DELAY);
}

function newSession() {
  cancelPendingAdvance();
  strokes = [];
  treeHistory = [];
  root = buildRoot();
  curNode = root;
  perfMode = true;
  scaffold = true;
  perfDot.classList.add('show');
  redraw();
}

function clearAll() {
  cancelPendingAdvance();
  strokes = [];
  treeHistory = [];
  root = buildRoot();
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
    const hit = strokes[index].points.some(([pointX, pointY]) => (
      Math.hypot(pointX - x, pointY - y) <= radius
    ));

    if (hit) {
      strokes.splice(index, 1);
      redraw();
      return;
    }
  }
}

function onPointerDown(event) {
  if (activePointerId !== null || event.button > 0) return;
  event.preventDefault();

  activePointerId = event.pointerId;
  canvas.setPointerCapture?.(event.pointerId);
  window.clearTimeout(advanceTimer);

  const [x, y] = getPointerPosition(event);

  if (toolMode === 'erase') {
    eraseAt(x, y);
    isDrawing = true;
    return;
  }

  if (strokeGroupStartY === null) strokeGroupStartY = y;
  isDrawing = true;

  if (perfMode) {
    if (curNode.leaf) {
      showPeek(getLeafAnswer(curNode));
    } else {
      const nextNode = isYesZone(strokeGroupStartY) ? curNode.yesNode : curNode.noNode;
      showPeek(nextNode?.leaf ? getLeafAnswer(nextNode) : nextNode?.ch || '');
    }
  }

  currentStroke = { points: [[x, y]], lineWidth: 4 };
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
  if (!isDrawing || event.pointerId !== activePointerId) return;
  event.preventDefault();

  const [x, y] = getPointerPosition(event);

  if (toolMode === 'erase') {
    eraseAt(x, y);
    return;
  }

  currentStroke.points.push([x, y]);
  ctx.lineTo(x, y);
  ctx.stroke();
}

function onPointerEnd(event) {
  if (event.pointerId !== activePointerId) return;
  event.preventDefault();
  hidePeek();

  if (toolMode !== 'erase' && isDrawing && currentStroke) {
    strokes.push(currentStroke);
    scheduleAdvance();
  }

  isDrawing = false;
  currentStroke = null;
  activePointerId = null;
  try {
    canvas.releasePointerCapture?.(event.pointerId);
  } catch {
    // The pointer may already have been released by the browser.
  }
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
  cancelPendingAdvance();
  strokes.pop();
  if (treeHistory.length) curNode = treeHistory.pop();
  redraw();
}

function solve() {
  cancelPendingAdvance();
  perfMode = false;
  hidePeek();
  perfDot.classList.remove('show');
  const cutoff = canvas.clientHeight * 0.55;
  strokes = strokes.filter((stroke) => stroke.points.some((point) => point[1] <= cutoff));
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

function closeSettings() {
  hidePanel(settingsPanel);
}

byId('closeSettings').addEventListener('click', closeSettings);

function pluralWords(number) {
  return `${number} word${number === 1 ? '' : 's'}`;
}

function renderWords() {
  const container = byId('wordView');
  container.replaceChildren();

  getWords().slice().sort().forEach((word) => {
    const row = document.createElement('div');
    row.className = 'word-row';
    row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid #eee';

    const label = document.createElement('span');
    label.textContent = word;

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Remove ${word}`);
    remove.style.cssText = 'min-width:32px;min-height:32px;border:0;background:none;color:#a00;font-size:18px;font-weight:700;cursor:pointer';
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
  const letter = getFirstLetter(getWords());
  byId('firstLetter').textContent = letter === '?'
    ? 'No first question available'
    : `First question: contains ${letter}?`;
}

function depthCount(node, depth, counts) {
  if (!node) return;
  if (node.leaf) {
    const total = node.words?.length || (node.word ? 1 : 0);
    counts[depth] = (counts[depth] || 0) + total;
    return;
  }
  depthCount(node.yesNode, depth + 1, counts);
  depthCount(node.noNode, depth + 1, counts);
}

function getTreeStats(node, depth = 0, stats = {
  words: 0,
  totalDepth: 0,
  maxDepth: 0,
  ambiguousGroups: 0,
  ambiguousWords: 0
}) {
  if (!node) return stats;

  if (node.leaf) {
    const total = node.words?.length || (node.word ? 1 : 0);
    stats.words += total;
    stats.totalDepth += total * depth;
    stats.maxDepth = Math.max(stats.maxDepth, depth);
    if (total > 1) {
      stats.ambiguousGroups += 1;
      stats.ambiguousWords += total;
    }
    return stats;
  }

  getTreeStats(node.yesNode, depth + 1, stats);
  getTreeStats(node.noNode, depth + 1, stats);
  return stats;
}

function renderTreeSummary() {
  const stats = getTreeStats(buildRoot());
  const average = stats.words ? (stats.totalDepth / stats.words).toFixed(1) : '0';
  let summary = `${pluralWords(stats.words)} in “${currentListName}” · about ${average} questions on average · ${stats.maxDepth} maximum`;
  if (stats.ambiguousGroups) {
    summary += ` · ${stats.ambiguousWords} words share an indistinguishable letter pattern`;
  }
  byId('treeSummary').textContent = summary;
}

function renderDepthStats() {
  const counts = {};
  depthCount(buildRoot(), 0, counts);
  const depths = Object.keys(counts).map(Number).sort((a, b) => a - b);
  const container = byId('depthStats');

  if (!depths.length) {
    container.textContent = 'Add at least one word to build a tree.';
    return;
  }

  container.replaceChildren(...depths.map((depth) => {
    const row = document.createElement('div');
    row.textContent = `${depth} questions: ${pluralWords(counts[depth])}`;
    return row;
  }));
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
  exploreModeToggle.checked = isExploreModeEnabled();
  refreshListSelect();
  renderWords();
  renderDepthStats();
  renderFirstLetter();
  renderTreeSummary();
}

function rebuildTree() {
  root = buildRoot();
  curNode = root;
  treeHistory = [];
}

useList.addEventListener('click', () => {
  currentListName = listSelect.value;
  localStorage.setItem(STORAGE_KEYS.activeList, currentListName);
  rebuildTree();
  clearAll();
  refreshSettings();
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
  redraw();
  event.currentTarget.value = '';
  refreshSettings();
});

createListBtn.addEventListener('click', () => {
  const name = byId('newListName').value.trim();
  const words = normalizeWords(byId('newListWords').value.split(/\r?\n/));
  if (!name || !words.length) return;

  lists[name] = words;
  saveLists();
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

function openExplore(returnToSettings = false) {
  exploreReturnToSettings = returnToSettings;
  exploreHistory = [];
  exploreNode = root;
  exploreWords = getWords().slice();
  settingsPanel.hidden = true;
  renderExplore();
  showPanel(explorePanel);
}

function closeExplore() {
  hidePanel(explorePanel);
  if (exploreReturnToSettings) {
    exploreReturnToSettings = false;
    openSettings();
  }
}

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

  if (exploreHistory.length) {
    requestAnimationFrame(() => {
      path.scrollLeft = path.scrollWidth;
    });
  }
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

  byId(`explore${prefix}Card`).setAttribute(
    'aria-label',
    `${prefix}, the word ${contains ? 'contains' : 'does not contain'} ${exploreNode.ch}. ${pluralWords(words.length)} remain.`
  );
}

function renderExplore() {
  const node = exploreNode;
  const words = exploreWords;
  const question = byId('exploreQuestion');
  const branches = byId('exploreBranches');
  const leafCard = byId('exploreLeafCard');
  const hint = byId('exploreHint');
  const back = byId('exploreBack');

  renderExplorePath();
  byId('exploreTitle').textContent = 'Tree Explorer';
  byId('exploreStatus').textContent = `${currentListName} · ${pluralWords(words.length)} remaining`;
  back.textContent = exploreHistory.length ? 'Back' : 'Done';

  if (node?.leaf) {
    question.style.display = 'none';
    branches.style.display = 'none';
    leafCard.style.display = 'block';

    const leafWords = node.words?.length ? node.words : words;
    const hasOne = leafWords.length === 1;
    byId('exploreLeafLabel').textContent = hasOne ? 'MATCH' : (leafWords.length ? 'POSSIBLE MATCHES' : 'NO MATCH');
    byId('exploreLeafWord').textContent = hasOne ? leafWords[0] : `${leafWords.length} WORDS`;
    byId('exploreLeafDetail').textContent = hasOne
      ? 'The path has identified the word.'
      : (leafWords.length
        ? 'These words contain exactly the same set of letters, so Yes/No letter questions cannot separate them.'
        : 'This list does not contain a matching word.');
    hint.textContent = hasOne
      ? `Finished in ${exploreHistory.length} questions.`
      : 'The remaining word chips are the unresolved possibilities.';
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
byId('exploreBack').addEventListener('click', () => {
  if (!exploreHistory.length) {
    closeExplore();
    return;
  }
  exploreHistory.pop();
  replayExploreHistory();
  renderExplore();
});

let settingsTap = 0;
let helpTap = 0;

canvas.addEventListener('pointerdown', (event) => {
  const rect = canvas.getBoundingClientRect();
  const now = Date.now();
  const inTopQuarter = event.clientY < rect.top + rect.height * 0.25;

  if (inTopQuarter && event.clientX > rect.left + rect.width * 0.75) {
    if (now - settingsTap < 320) openSettings();
    settingsTap = now;
  }

  if (inTopQuarter && event.clientX < rect.left + rect.width * 0.25) {
    if (now - helpTap < 320) showPanel(helpOverlay);
    helpTap = now;
  }
});

byId('closeHelp').addEventListener('click', () => hidePanel(helpOverlay));

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

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) scheduleResize();
  });

  document.addEventListener('gesturestart', (event) => event.preventDefault(), { passive: false });
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js', { updateViaCache: 'none' }).catch(() => {});
  }, { once: true });
}

setTool('draw');
syncExploreButton();
refreshSettings();
initializeViewport();
registerServiceWorker();
