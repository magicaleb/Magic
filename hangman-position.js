'use strict';

const POSITION_SWIPE_MIN_PX = 64;
const POSITION_SWIPE_WIDTH_RATIO = 0.18;
const POSITION_SWIPE_AXIS_RATIO = 1.65;
const POSITION_SWIPE_MAX_MS = 1400;

let positionHistory = [];
let positionToolbarGesture = null;
let positionSuppressNativeClickUntil = 0;
let positionForwardingClick = false;

function positionCountsEnabled() {
  return Boolean(getMeta().positionSplitCounts);
}

function committedYesLetters() {
  const seen = new Set();
  const letters = [];
  answerGroups.forEach((group) => {
    if (!group?.isYes) return;
    const letter = group.nodeBefore?.ch;
    if (typeof letter !== 'string' || letter.length !== 1 || seen.has(letter)) return;
    seen.add(letter);
    letters.push(letter);
  });
  return letters;
}

function positionCandidateWords(node = curNode) {
  if (!node) return [];
  if (node.lateLie && Array.isArray(node.lieStates) && typeof lateLieUniqueWords === 'function') {
    return lateLieUniqueWords(node.lieStates);
  }
  return Array.from(new Set(node.words || (node.word ? [node.word] : []))).sort();
}

function positionKnownKey(letters = committedYesLetters()) {
  return letters.slice().sort().join('');
}

function wordHasKnownLetterInPrefix(word, letters) {
  if (!word || !letters.length) return false;
  const boundary = letters.length;
  const known = new Set(letters);
  for (let index = 0; index < Math.min(boundary, word.length); index += 1) {
    if (known.has(word[index])) return true;
  }
  return false;
}

function positionSplitFor(words = positionCandidateWords(), letters = committedYesLetters()) {
  const inside = [];
  const outside = [];
  if (!letters.length || !words.length) return { inside, outside };
  words.forEach((word) => {
    (wordHasKnownLetterInPrefix(word, letters) ? inside : outside).push(word);
  });
  return { inside, outside };
}

function positionQuestionAlreadyApplied(letters = committedYesLetters()) {
  const key = positionKnownKey(letters);
  return Boolean(key && positionHistory.some((entry) => entry.knownKey === key));
}

function installPositionUi() {
  if (!document.getElementById('positionSplitCount')) {
    const count = document.createElement('div');
    count.id = 'positionSplitCount';
    count.setAttribute('aria-hidden', 'true');
    app.append(count);
  }

  if (!document.getElementById('positionSplitStyles')) {
    const style = document.createElement('style');
    style.id = 'positionSplitStyles';
    style.textContent = `
      #positionSplitCount{position:absolute;z-index:4;display:none;transform:translateX(-50%);pointer-events:none;color:rgba(26,24,20,.42);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:7px;font-weight:700;line-height:9px;letter-spacing:.04em;white-space:nowrap}
      #positionSplitCount.show{display:block}
      .position-split-section .info-box{margin-top:9px}
      .position-swipe-key{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:9px}
      .position-swipe-key span{padding:7px 8px;border:1px solid var(--faint);border-radius:7px;background:#fff;color:#6f6a61;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9px;line-height:1.35;text-align:center}
    `;
    document.head.append(style);
  }
}

function syncPositionCountLocation() {
  const count = document.getElementById('positionSplitCount');
  if (!count || !btnSolve?.isConnected) return;
  const appRect = app.getBoundingClientRect();
  const solveRect = btnSolve.getBoundingClientRect();
  count.style.left = `${solveRect.left - appRect.left + solveRect.width / 2}px`;
  count.style.top = `${solveRect.bottom - appRect.top + 1}px`;
}

function syncPositionSplitCount() {
  const count = document.getElementById('positionSplitCount');
  if (!count) return;
  syncPositionCountLocation();

  const letters = committedYesLetters();
  const words = positionCandidateWords();
  const visible = positionCountsEnabled()
    && sessionPhase === 'playing'
    && perfMode
    && !curNode?.leaf
    && letters.length > 0
    && words.length > 1
    && !positionQuestionAlreadyApplied(letters);

  if (!visible) {
    count.textContent = '';
    count.classList.remove('show');
    return;
  }

  const split = positionSplitFor(words, letters);
  count.textContent = `${split.inside.length}/${split.outside.length}`;
  count.classList.add('show');
}

function bestEffortPositionHaptic() {
  try {
    if (typeof navigator.vibrate === 'function') navigator.vibrate(12);
  } catch {
    // Best effort only; iOS Safari generally does not expose the Vibration API.
  }
}

function pruneLateLiePlanForPosition(node, states) {
  if (typeof lateLieUniqueWords !== 'function' || typeof makeLateLieLeaf !== 'function' || typeof transitionLateLieStates !== 'function') return null;
  const uniqueWords = lateLieUniqueWords(states);
  if (uniqueWords.length <= 1) return makeLateLieLeaf(states);
  if (!node || node.leaf || !node.ch) return null;

  const yesStates = transitionLateLieStates(states, node.ch, true);
  const noStates = transitionLateLieStates(states, node.ch, false);
  const yesNode = yesStates.length ? pruneLateLiePlanForPosition(node.yesNode, yesStates) : makeLateLieLeaf([]);
  const noNode = noStates.length ? pruneLateLiePlanForPosition(node.noNode, noStates) : makeLateLieLeaf([]);
  if (!yesNode || !noNode) return null;

  return {
    leaf: false,
    lateLie: true,
    ch: node.ch,
    words: uniqueWords,
    lieStates: states,
    yesNode,
    noNode
  };
}

function refreshPositionDependentIndicators() {
  if (typeof lateLieOpportunity !== 'undefined') lateLieOpportunity = null;
  if (typeof lateLieArmed !== 'undefined' && !lateLieArmed && typeof refreshLateLieOpportunity === 'function') {
    refreshLateLieOpportunity();
  } else if (typeof updateCandidateIndicator === 'function') {
    updateCandidateIndicator();
  }
  syncPositionSplitCount();
}

function applyKnownLetterPosition(insidePrefix) {
  if (sessionPhase !== 'playing' || !perfMode) return false;
  finalizePendingGroup();

  const letters = committedYesLetters();
  if (!letters.length || !curNode || curNode.leaf) {
    showTransientReveal('POSITION NOT READY', 900);
    return false;
  }
  if (positionQuestionAlreadyApplied(letters)) {
    showTransientReveal('POSITION ALREADY SET', 900);
    return false;
  }

  const nodeBefore = curNode;
  const wordsBefore = positionCandidateWords(nodeBefore);
  const filteredWords = wordsBefore.filter((word) => wordHasKnownLetterInPrefix(word, letters) === insidePrefix);
  if (!filteredWords.length) {
    showTransientReveal('POSITION CONFLICT', 1100);
    return false;
  }

  let nodeAfter = null;
  if (nodeBefore.lateLie && Array.isArray(nodeBefore.lieStates)) {
    const allowed = new Set(filteredWords);
    const filteredStates = nodeBefore.lieStates.filter((state) => allowed.has(state.word));
    nodeAfter = pruneLateLiePlanForPosition(nodeBefore, filteredStates);
  } else {
    nodeAfter = buildRootFor(filteredWords, stagedInputs);
  }

  if (!nodeAfter) {
    showTransientReveal('POSITION UNSAFE', 1100);
    return false;
  }

  positionHistory.push({
    nodeBefore,
    answerCountAtApply: answerGroups.length,
    knownKey: positionKnownKey(letters),
    insidePrefix,
    lateLieArmedBefore: typeof lateLieArmed !== 'undefined' ? Boolean(lateLieArmed) : false
  });

  curNode = nodeAfter;
  refreshPositionDependentIndicators();
  bestEffortPositionHaptic();

  const label = insidePrefix ? 'POSITION IN' : 'POSITION OUT';
  const answer = nodeAfter.leaf ? getLeafAnswer(nodeAfter) : `${filteredWords.length} LEFT`;
  showTransientReveal(`${label} · ${answer}`, nodeAfter.leaf ? 1500 : 950);
  return true;
}

function resetPositionSession() {
  positionHistory = [];
  positionToolbarGesture = null;
  positionSuppressNativeClickUntil = 0;
  const count = document.getElementById('positionSplitCount');
  if (count) {
    count.textContent = '';
    count.classList.remove('show');
  }
}

function undoPositionIfLatest() {
  if (pendingGroup || !positionHistory.length) return false;
  const latest = positionHistory[positionHistory.length - 1];
  if (answerGroups.length !== latest.answerCountAtApply) return false;

  positionHistory.pop();
  curNode = latest.nodeBefore;
  if (typeof lateLieArmed !== 'undefined') lateLieArmed = latest.lateLieArmedBefore;
  refreshPositionDependentIndicators();
  showTransientReveal('POSITION UNDONE', 700);
  return true;
}

function positionSwipeThreshold() {
  return Math.max(POSITION_SWIPE_MIN_PX, toolbar.getBoundingClientRect().width * POSITION_SWIPE_WIDTH_RATIO);
}

function canCapturePositionToolbarGesture() {
  if (sessionPhase !== 'playing' || !perfMode) return false;
  finalizePendingGroup();
  const letters = committedYesLetters();
  return letters.length > 0 && Boolean(curNode) && !curNode.leaf && !positionQuestionAlreadyApplied(letters);
}

function toolbarButtonFromEvent(event) {
  const target = event.target instanceof Element ? event.target.closest('.tool-btn') : null;
  return target && toolbar.contains(target) ? target : null;
}

function forwardToolbarTap(button) {
  if (!button) return;
  positionForwardingClick = true;
  try {
    if (button === btnHangman) handleHangmanTap();
    else if (button === btnSolve) solve();
    else button.click();
  } finally {
    positionForwardingClick = false;
  }
  requestAnimationFrame(syncPositionSplitCount);
}

function onPositionToolbarPointerDown(event) {
  if (event.button > 0 || positionToolbarGesture || !canCapturePositionToolbarGesture()) return;
  event.preventDefault();
  event.stopPropagation();
  positionToolbarGesture = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    lastX: event.clientX,
    lastY: event.clientY,
    startedAt: performance.now(),
    button: toolbarButtonFromEvent(event)
  };
  toolbar.setPointerCapture?.(event.pointerId);
}

function onPositionToolbarPointerMove(event) {
  if (!positionToolbarGesture || event.pointerId !== positionToolbarGesture.pointerId) return;
  event.preventDefault();
  event.stopPropagation();
  positionToolbarGesture.lastX = event.clientX;
  positionToolbarGesture.lastY = event.clientY;
}

function releasePositionToolbarPointer(event) {
  try { toolbar.releasePointerCapture?.(event.pointerId); } catch { /* already released */ }
  positionToolbarGesture = null;
}

function onPositionToolbarPointerUp(event) {
  if (!positionToolbarGesture || event.pointerId !== positionToolbarGesture.pointerId) return;
  event.preventDefault();
  event.stopPropagation();

  const gesture = positionToolbarGesture;
  gesture.lastX = event.clientX;
  gesture.lastY = event.clientY;
  const dx = gesture.lastX - gesture.startX;
  const dy = gesture.lastY - gesture.startY;
  const elapsed = performance.now() - gesture.startedAt;
  const horizontalEnough = Math.abs(dx) >= positionSwipeThreshold()
    && Math.abs(dx) >= Math.abs(dy) * POSITION_SWIPE_AXIS_RATIO;
  const swipe = horizontalEnough && elapsed <= POSITION_SWIPE_MAX_MS;

  positionSuppressNativeClickUntil = Date.now() + 450;
  releasePositionToolbarPointer(event);

  if (swipe) {
    // Right-to-left = at least one YES letter is in the first X positions.
    // Left-to-right = none of the YES letters is in the first X positions.
    applyKnownLetterPosition(dx < 0);
  } else {
    forwardToolbarTap(gesture.button);
  }
}

function onPositionToolbarPointerCancel(event) {
  if (!positionToolbarGesture || event.pointerId !== positionToolbarGesture.pointerId) return;
  event.preventDefault();
  event.stopPropagation();
  positionSuppressNativeClickUntil = Date.now() + 300;
  releasePositionToolbarPointer(event);
}

function suppressCapturedNativeToolbarClick(event) {
  if (positionForwardingClick || Date.now() > positionSuppressNativeClickUntil) return;
  event.preventDefault();
  event.stopImmediatePropagation();
}

function installPositionToolbarGesture() {
  toolbar.addEventListener('pointerdown', onPositionToolbarPointerDown, { capture: true, passive: false });
  toolbar.addEventListener('pointermove', onPositionToolbarPointerMove, { capture: true, passive: false });
  toolbar.addEventListener('pointerup', onPositionToolbarPointerUp, { capture: true, passive: false });
  toolbar.addEventListener('pointercancel', onPositionToolbarPointerCancel, { capture: true, passive: false });
  toolbar.addEventListener('click', suppressCapturedNativeToolbarClick, true);

  btnUndo.addEventListener('click', (event) => {
    if (!undoPositionIfLatest()) {
      requestAnimationFrame(syncPositionSplitCount);
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  // These listeners cover controls whose original callbacks were bound before this module loaded.
  btnClear.addEventListener('click', () => requestAnimationFrame(resetPositionSession));
  btnSolve.addEventListener('pointerup', () => requestAnimationFrame(syncPositionSplitCount));
  window.addEventListener('resize', () => requestAnimationFrame(syncPositionCountLocation), { passive: true });
  window.addEventListener('orientationchange', () => requestAnimationFrame(syncPositionCountLocation), { passive: true });
}

function installPositionSettings() {
  if (document.getElementById('positionSplitCountToggle')) return;
  const group = document.querySelector('.settings-group[data-group="performance"]');
  if (!group) return;

  const section = document.createElement('section');
  section.className = 'section position-split-section';
  section.innerHTML = `
    <h2>Known-Letter Position</h2>
    <p class="section-copy">After any YES, you can ask whether any letter that has received YES appears in the first X spaces, where X is the number of distinct YES letters so far.</p>
    <div class="position-swipe-key"><span><strong>RIGHT → LEFT</strong><br>one is IN the first X</span><span><strong>LEFT → RIGHT</strong><br>none are in the first X</span></div>
    <div class="info-box">Swipe horizontally across the bottom toolbar during a performance. The answer filters the current candidates and rebuilds the remaining Progressive Anagram tree. Confirmation appears in the same faint reveal strip used for the word.</div>
    <label class="setting-toggle compact-toggle">
      <input type="checkbox" id="positionSplitCountToggle">
      <span><strong>Show position split counts</strong><small>Shows IN/OUT counts as X/X directly below Solve. Left is right-to-left (IN); right is left-to-right (OUT).</small></span>
    </label>
  `;

  const lieSection = group.querySelector('.late-lie-section');
  if (lieSection) group.insertBefore(section, lieSection);
  else group.append(section);

  const toggle = document.getElementById('positionSplitCountToggle');
  toggle.addEventListener('change', () => {
    getMeta().positionSplitCounts = toggle.checked;
    saveListMeta();
    syncPositionSplitCount();
  });
  refreshPositionSettings();
}

function refreshPositionSettings() {
  const toggle = document.getElementById('positionSplitCountToggle');
  if (toggle) toggle.checked = positionCountsEnabled();
  syncPositionSplitCount();
}

const originalFinalizePendingGroupForPosition = finalizePendingGroup;
finalizePendingGroup = function finalizePendingGroupWithPositionCount() {
  const result = originalFinalizePendingGroupForPosition();
  syncPositionSplitCount();
  return result;
};

const originalResetBoardForPosition = resetBoard;
resetBoard = function resetBoardWithPosition(options) {
  resetPositionSession();
  const result = originalResetBoardForPosition(options);
  requestAnimationFrame(syncPositionSplitCount);
  return result;
};

const originalClearAllForPosition = clearAll;
clearAll = function clearAllWithPosition() {
  resetPositionSession();
  const result = originalClearAllForPosition();
  requestAnimationFrame(syncPositionSplitCount);
  return result;
};

const originalRebuildTreeForPosition = rebuildTree;
rebuildTree = function rebuildTreeWithPosition() {
  resetPositionSession();
  const result = originalRebuildTreeForPosition();
  requestAnimationFrame(syncPositionSplitCount);
  return result;
};

const originalRefreshSettingsForPosition = refreshSettings;
refreshSettings = function refreshSettingsWithPosition() {
  originalRefreshSettingsForPosition();
  refreshPositionSettings();
};

installPositionUi();
installPositionToolbarGesture();
installPositionSettings();
refreshPositionSettings();
