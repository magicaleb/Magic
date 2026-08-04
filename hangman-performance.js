'use strict';

let activeWords = getActiveWords();
let root = buildRootFor(activeWords);
let treeAnalysis = analyzeTree(root, activeWords);
let curNode = root;

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
const lengthModeSelect = byId('lengthMode');
const vowelModeToggle = byId('vowelModeToggle');

let DPR = Math.max(1, window.devicePixelRatio || 1);
let strokes = [];
let answerGroups = [];
let pendingGroup = null;
let currentStroke = null;
let perfMode = false;
let scaffold = false;
let sessionPhase = 'idle';
let stagedInputs = { exactLength: null, lengthBucket: null, vowelBucket: null };
let advanceTimer = null;
let revealTimer = null;
let revealIsTransient = false;
let toolMode = 'draw';
let activePointerId = null;
let pointerMode = null;
let isDrawing = false;
let resizeFrame = null;
let groupSequence = 0;
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

function setRevealText(text) {
  peek.textContent = text || '';
  peek.classList.toggle('show', Boolean(text));
}

function clearReveal(force = false) {
  if (revealIsTransient && !force) return;
  window.clearTimeout(revealTimer);
  revealTimer = null;
  revealIsTransient = false;
  setRevealText('');
}

function showTransientReveal(text, duration = 950) {
  window.clearTimeout(revealTimer);
  revealIsTransient = true;
  setRevealText(text);
  revealTimer = window.setTimeout(() => {
    revealIsTransient = false;
    setRevealText('');
  }, duration);
}

function showPeek(text) {
  if (text?.length === 1) {
    btnSolve.textContent = `Solv${text}`;
    return;
  }
  revealIsTransient = false;
  window.clearTimeout(revealTimer);
  setRevealText(text || '');
}

function hidePeek() {
  btnSolve.textContent = 'Solve';
  clearReveal(false);
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
  answerGroups.push({ ...pendingGroup, nodeAfter });
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
    pendingGroup = { id: `g${++groupSequence}`, isYes, nodeBefore: curNode, strokes: [] };
  }
  cancelPendingTimer();
  return pendingGroup;
}

function resetInputState() {
  stagedInputs = { exactLength: null, lengthBucket: null, vowelBucket: null };
}

function resetBoard({ preserveLength = false } = {}) {
  cancelPendingTimer();
  strokes = preserveLength ? strokes.filter((stroke) => stroke.kind === 'length') : [];
  answerGroups = [];
  pendingGroup = null;
  curNode = root;
  hidePeek();
  redraw();
}

function startLengthCapture() {
  const retainedVowelBucket = stagedInputs.vowelBucket;
  resetInputState();
  stagedInputs.vowelBucket = retainedVowelBucket;
  resetBoard();
  sessionPhase = 'lengthCapture';
  perfMode = false;
  scaffold = true;
  perfDot.classList.add('show');
  redraw();
}

function requiredInputsReady() {
  const meta = getMeta();
  if (meta.lengthMode === 'bucket' && !stagedInputs.lengthBucket) return false;
  if (meta.vowelMode && !stagedInputs.vowelBucket) return false;
  return true;
}

function startPlaying({ preserveLength = false } = {}) {
  const candidates = filterByPerformanceInputs(getActiveWords(), stagedInputs);
  if (!candidates.length) {
    showTransientReveal('NO MATCH', 1400);
    return false;
  }
  root = buildRootFor(candidates, stagedInputs);
  treeAnalysis = analyzeTree(buildRootFor(getActiveWords()), getActiveWords());
  resetBoard({ preserveLength });
  curNode = root;
  sessionPhase = 'playing';
  perfMode = true;
  scaffold = true;
  perfDot.classList.add('show');
  redraw();
  const assisted = Boolean(stagedInputs.exactLength || stagedInputs.lengthBucket || stagedInputs.vowelBucket);
  const first = root?.leaf ? getLeafAnswer(root) : root?.ch;
  if (assisted && first) showTransientReveal(first, 1100);
  return true;
}

function handleHangmanTap() {
  const meta = getMeta();
  if (sessionPhase === 'playing') {
    clearAll();
  }

  if (meta.lengthMode === 'exact') {
    if (sessionPhase !== 'lengthCapture') {
      startLengthCapture();
      return;
    }
    const exactLength = strokes.filter((stroke) => stroke.kind === 'length').length;
    if (!exactLength) {
      showTransientReveal('DRAW BLANKS', 1100);
      return;
    }
    stagedInputs.exactLength = exactLength;
    if (meta.vowelMode && !stagedInputs.vowelBucket) {
      showTransientReveal('SET VOWELS', 1100);
      return;
    }
    startPlaying({ preserveLength: true });
    return;
  }

  if (!requiredInputsReady()) {
    if (meta.lengthMode === 'bucket' && !stagedInputs.lengthBucket) showTransientReveal('HOLD HANGMAN', 1100);
    else if (meta.vowelMode && !stagedInputs.vowelBucket) showTransientReveal('HOLD SOLVE', 1100);
    return;
  }
  resetBoard();
  startPlaying();
}

function clearAll() {
  cancelPendingTimer();
  resetInputState();
  strokes = [];
  answerGroups = [];
  pendingGroup = null;
  activeWords = getActiveWords();
  root = buildRootFor(activeWords);
  treeAnalysis = analyzeTree(root, activeWords);
  curNode = root;
  perfMode = false;
  scaffold = false;
  sessionPhase = 'idle';
  perfDot.classList.remove('show');
  clearReveal(true);
  btnSolve.textContent = 'Solve';
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
      updateHelp();
      showPanel(helpOverlay);
    } else openSettings();
  } else lastCornerTap[corner] = now;
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
  let kind = 'free';
  if (sessionPhase === 'lengthCapture') {
    kind = 'length';
  } else if (perfMode) {
    kind = 'answer';
    const isYes = isYesZone(y);
    const group = beginPendingGroup(isYes);
    groupId = group.id;
    showPeek(nextPromptFor(group.nodeBefore, group.isYes));
  }

  isDrawing = true;
  currentStroke = { points: [[x, y]], lineWidth: 4, groupId, kind };
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
  if (sessionPhase === 'lengthCapture') {
    const index = strokes.map((stroke) => stroke.kind).lastIndexOf('length');
    if (index >= 0) strokes.splice(index, 1);
    redraw();
    return;
  }
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
  if (sessionPhase !== 'playing') return;
  finalizePendingGroup();
  perfMode = false;
  sessionPhase = 'idle';
  hidePeek();
  perfDot.classList.remove('show');
  const yesIds = new Set(answerGroups.filter((group) => group.isYes).map((group) => group.id));
  strokes = strokes.filter((stroke) => !yesIds.has(stroke.groupId));
  answerGroups = answerGroups.filter((group) => !group.isYes);
  redraw();
}

function triZone(clientX) {
  const ratio = Math.max(0, Math.min(0.999, clientX / Math.max(1, window.innerWidth)));
  return Math.floor(ratio * 3);
}

function bindPressGesture(button, canLongPress, onTap, onLongSelect, previewForZone) {
  let pointerId = null;
  let lastX = 0;
  let longActive = false;
  let timer = null;

  button.style.touchAction = 'none';
  button.addEventListener('pointerdown', (event) => {
    if (event.button > 0 || pointerId !== null) return;
    event.preventDefault();
    pointerId = event.pointerId;
    lastX = event.clientX;
    longActive = false;
    button.setPointerCapture?.(pointerId);
    if (canLongPress()) {
      timer = window.setTimeout(() => {
        longActive = true;
        setRevealText(previewForZone(triZone(lastX)));
      }, LONG_PRESS_DELAY);
    }
  });
  button.addEventListener('pointermove', (event) => {
    if (event.pointerId !== pointerId) return;
    lastX = event.clientX;
    if (longActive) setRevealText(previewForZone(triZone(lastX)));
  });
  const finish = (event) => {
    if (event.pointerId !== pointerId) return;
    event.preventDefault();
    window.clearTimeout(timer);
    timer = null;
    if (longActive) onLongSelect(triZone(lastX));
    else onTap();
    pointerId = null;
    longActive = false;
    try { button.releasePointerCapture?.(event.pointerId); } catch { /* already released */ }
  };
  const cancel = (event) => {
    if (event.pointerId !== pointerId) return;
    window.clearTimeout(timer);
    timer = null;
    pointerId = null;
    longActive = false;
    clearReveal(true);
  };
  button.addEventListener('pointerup', finish);
  button.addEventListener('pointercancel', cancel);
  button.addEventListener('click', (event) => event.preventDefault());
}

canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
canvas.addEventListener('pointermove', onPointerMove, { passive: false });
canvas.addEventListener('pointerup', onPointerEnd, { passive: false });
canvas.addEventListener('pointercancel', onPointerEnd, { passive: false });
canvas.addEventListener('contextmenu', (event) => event.preventDefault());
btnDraw.addEventListener('click', () => setTool('draw'));
btnErase.addEventListener('click', () => setTool('erase'));
btnClear.addEventListener('click', clearAll);
btnUndo.addEventListener('click', undo);

bindPressGesture(
  btnHangman,
  () => getMeta().lengthMode === 'bucket' && sessionPhase !== 'playing',
  handleHangmanTap,
  (zone) => {
    stagedInputs.lengthBucket = ['short', 'medium', 'long'][zone];
    showTransientReveal(`LENGTH ${['S', 'M', 'L'][zone]}`, 850);
  },
  (zone) => `LENGTH ${['S', 'M', 'L'][zone]}`
);

bindPressGesture(
  btnSolve,
  () => getMeta().vowelMode && sessionPhase !== 'playing',
  solve,
  (zone) => {
    stagedInputs.vowelBucket = zone + 1;
    showTransientReveal(`VOWELS ${zone === 2 ? '3+' : zone + 1}`, 850);
  },
  (zone) => `VOWELS ${zone === 2 ? '3+' : zone + 1}`
);
