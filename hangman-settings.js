'use strict';

const SETTINGS_VERSION = APP_VERSION;
const SETTINGS_DATE = APP_DATE;

function showSettingsGroup(key) {
  document.querySelectorAll('#settingsPanel .settings-group').forEach((group) => {
    const active = group.dataset.group === key;
    group.classList.toggle('active', active);
    group.hidden = !active;
  });
  document.querySelectorAll('#settingsPanel .settings-tab').forEach((tab) => {
    const active = tab.dataset.group === key;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  document.querySelector('#settingsPanel .panel-scroll')?.scrollTo({ top: 0, behavior: 'auto' });
}

function installSettingsTabs() {
  const tabs = Array.from(document.querySelectorAll('#settingsPanel .settings-tab'));
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => showSettingsGroup(tab.dataset.group));
    tab.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      const next = tabs[(index + direction + tabs.length) % tabs.length];
      showSettingsGroup(next.dataset.group);
      next.focus();
    });
  });
  showSettingsGroup('performance');
}

function updateVersionForSettings() {
  const button = document.getElementById('versionButton');
  if (button) button.textContent = `V${SETTINGS_VERSION} · ${SETTINGS_DATE}`;
  const current = document.querySelector('#versionPanel .panel-header .version');
  if (current) current.textContent = `Current: V${SETTINGS_VERSION}`;
}

function loadPositionSwipeFeature() {
  if (document.querySelector('script[data-position-swipe]')) return;
  const script = document.createElement('script');
  script.src = './hangman-position.js?v=2.7.1';
  script.async = false;
  script.dataset.positionSwipe = '1';
  document.head.append(script);
}

installSettingsTabs();
updateVersionForSettings();
if (document.readyState === 'complete') loadPositionSwipeFeature();
else window.addEventListener('load', loadPositionSwipeFeature, { once: true });

