const LOAD_DURATION_MS = 5000;

const ZENIOS_WALLPAPERS = [
  'default_wallpapers/default_wallpaper_1',
  'default_wallpapers/default_wallpaper_2',
  'default_wallpapers/default_wallpaper_3',
  'default_wallpapers/default_wallpaper_4',
  'default_wallpapers/default_wallpaper_5',
  'default_wallpapers/default_wallpaper_6',
  'default_wallpapers/default_wallpaper_7'
];

const DEFAULT_WALLPAPER_INDEX = 6;
const BATTERY_PRESETS = [94, 65, 20, 100];

const LOCK_LABELS = {
  swipe: 'Przeciągnięcie',
  pin: 'PIN',
  password: 'Hasło',
  pattern: 'Wzór'
};

let loadTimer = null;
let clockTimer = null;
let currentWallpaperIndex = DEFAULT_WALLPAPER_INDEX;
let currentNavMode = 'gestures';
let currentBatteryLevel = 94;
let batteryPresetIndex = 0;
let gestureStartY = null;
let lockSwipeStartY = null;
let isLocked = false;
let currentLockMethod = 'swipe';
let pinCode = '1234';
let passwordCode = 'zenios';
let patternCode = '1-2-5-8-9';
let enteredPin = '';
let enteredPattern = [];
let pendingAppAfterUnlock = null;
let domRefs = {};

function formatCurrentClock() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function formatCurrentLockDate() {
  const now = new Date();
  const days = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
  const months = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'];
  return `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]}`;
}

function updateClock() {
  const timeText = formatCurrentClock();
  if (domRefs.statusClock) {
    domRefs.statusClock.textContent = timeText;
  }
  if (domRefs.lockClock) {
    domRefs.lockClock.textContent = timeText;
  }
  if (domRefs.lockDate) {
    domRefs.lockDate.textContent = formatCurrentLockDate();
  }
}

function applyBatteryLevel(level) {
  const clamped = Math.max(0, Math.min(100, Number(level) || 0));
  currentBatteryLevel = clamped;

  if (domRefs.batteryFill) {
    domRefs.batteryFill.style.width = `${clamped}%`;
  }

  if (domRefs.statusBattery) {
    domRefs.statusBattery.setAttribute('data-level', String(clamped));
    domRefs.statusBattery.classList.toggle('low', clamped <= 20);
    domRefs.statusBattery.classList.toggle('full', clamped === 100);
  }

  if (domRefs.batterySettingState) {
    domRefs.batterySettingState.textContent = `${clamped}%`;
  }
}

function initRealBatteryIfAvailable() {
  applyBatteryLevel(currentBatteryLevel);
  if (typeof navigator !== 'undefined' && typeof navigator.getBattery === 'function') {
    navigator.getBattery().then((battery) => {
      if (!battery) return;
      const syncFromDevice = () => {
        const pct = Math.round((battery.level || 0) * 100);
        const idx = BATTERY_PRESETS.indexOf(pct);
        if (idx >= 0) batteryPresetIndex = idx;
        applyBatteryLevel(pct);
      };
      syncFromDevice();
      battery.addEventListener('levelchange', syncFromDevice);
    }).catch(() => {});
  }
}

function showLayer(target) {
  const { stillLayer, lockscreenLayer, wallpaperLayer } = domRefs;
  [stillLayer, lockscreenLayer, wallpaperLayer].forEach((el) => {
    if (!el) return;
    el.classList.toggle('active', el === target);
  });
  syncStatusBarDisplay();
  syncNavBarDisplay();
}

function resolveWallpaperCandidates(basePath) {
  return [basePath, `${basePath}.png`, `${basePath}.jpg`, `${basePath}.webp`];
}

function loadImageWithFallback(imgEl, basePath) {
  if (!imgEl || !basePath) return;
  const candidates = resolveWallpaperCandidates(basePath);
  let attempt = 0;

  function tryNext() {
    if (attempt >= candidates.length) return;
    imgEl.src = candidates[attempt++];
  }

  imgEl.onerror = tryNext;
  tryNext();
}

function setWallpaper(index) {
  if (index < 0 || index >= ZENIOS_WALLPAPERS.length) return;
  currentWallpaperIndex = index;
  const wpName = `default_wallpaper_${index + 1}`;
  const basePath = ZENIOS_WALLPAPERS[index];

  if (domRefs.systemWallpaper) {
    loadImageWithFallback(domRefs.systemWallpaper, basePath);
  }
  if (domRefs.lockWallpaper) {
    loadImageWithFallback(domRefs.lockWallpaper, basePath);
  }
  if (domRefs.currentWpLabel) {
    domRefs.currentWpLabel.textContent = wpName;
  }
  if (domRefs.wallpaperPreviewImg) {
    loadImageWithFallback(domRefs.wallpaperPreviewImg, basePath);
  }
  if (domRefs.wallpaperPreviewName) {
    domRefs.wallpaperPreviewName.textContent = wpName;
  }
  renderWallpaperPicker();
}

function renderWallpaperPicker() {
  const { wpGrid } = domRefs;
  if (!wpGrid) return;

  wpGrid.innerHTML = '';
  ZENIOS_WALLPAPERS.forEach((basePath, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `wp-choice${idx === currentWallpaperIndex ? ' active' : ''}`;
    btn.title = `default_wallpaper_${idx + 1}`;

    const thumb = document.createElement('img');
    thumb.alt = `Tapeta ${idx + 1}`;
    loadImageWithFallback(thumb, basePath);

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      setWallpaper(idx);
    });

    btn.appendChild(thumb);
    wpGrid.appendChild(btn);
  });
}

function isAnyAppOpen() {
  return Array.from(domRefs.appViews || []).some((view) => view.classList.contains('open'));
}

function isHomeScreenVisible() {
  return !isLocked && !isAnyAppOpen() && Boolean(domRefs.wallpaperLayer?.classList.contains('active'));
}

function syncStatusBarDisplay() {
  const bar = domRefs.statusBarOverlay;
  if (!bar) return;

  const stillActive = Boolean(domRefs.stillLayer?.classList.contains('active'));
  bar.classList.toggle('visible', !stillActive);
}

function syncNavBarDisplay() {
  const overlay = domRefs.systemNavOverlay;
  if (!overlay) return;

  const appOpen = isAnyAppOpen();
  const homeVisible = isHomeScreenVisible();
  const shouldShowNav = !isLocked && (appOpen || homeVisible);
  const isButtons = currentNavMode === 'buttons';

  document.body.classList.toggle('zenios-in-app', appOpen && !isLocked);
  overlay.classList.toggle('in-app', shouldShowNav);
  overlay.classList.toggle('mode-gestures', !isButtons);
  overlay.classList.toggle('mode-buttons', isButtons);

  if (!shouldShowNav) {
    overlay.style.opacity = '0';
    overlay.style.visibility = 'hidden';
    overlay.style.pointerEvents = 'none';
    return;
  }

  overlay.style.opacity = '1';
  overlay.style.visibility = 'visible';
  overlay.style.pointerEvents = 'auto';

  if (domRefs.gestureHandle) {
    domRefs.gestureHandle.style.display = isButtons ? 'none' : 'inline-flex';
  }
  if (domRefs.sysButtonsRow) {
    domRefs.sysButtonsRow.style.display = isButtons ? 'flex' : 'none';
  }
}

function hideAllUnlockPanels() {
  [domRefs.unlockPinPanel, domRefs.unlockPasswordPanel, domRefs.unlockPatternPanel].forEach((panel) => {
    if (panel) panel.classList.remove('active');
  });
  if (domRefs.pinError) domRefs.pinError.textContent = '';
  if (domRefs.passwordError) domRefs.passwordError.textContent = '';
  if (domRefs.patternError) domRefs.patternError.textContent = '';
  if (domRefs.lockBottomArea) domRefs.lockBottomArea.classList.remove('dimmed');
}

function resetUnlockInputs() {
  enteredPin = '';
  enteredPattern = [];
  updatePinDots();
  clearPatternNodes();
  if (domRefs.lockPasswordInput) domRefs.lockPasswordInput.value = '';
}

function lockScreen() {
  isLocked = true;
  closeAllApps();
  hideAllUnlockPanels();
  resetUnlockInputs();
  updateLockHint();
  showLayer(domRefs.lockscreenLayer);
  if (domRefs.liquidDock) {
    domRefs.liquidDock.classList.remove('visible');
  }
}

function unlockScreenNow() {
  isLocked = false;
  pendingAppAfterUnlock = null;
  hideAllUnlockPanels();
  resetUnlockInputs();
  showLayer(domRefs.wallpaperLayer);
  if (domRefs.liquidDock) {
    domRefs.liquidDock.classList.add('visible');
  }
}

function updateLockHint() {
  if (!domRefs.lockHintText) return;
  if (currentLockMethod === 'swipe') {
    domRefs.lockHintText.textContent = 'Przeciągnij w górę, aby odblokować';
  } else if (currentLockMethod === 'pin') {
    domRefs.lockHintText.textContent = 'Przeciągnij w górę — wpisz PIN';
  } else if (currentLockMethod === 'password') {
    domRefs.lockHintText.textContent = 'Przeciągnij w górę — wpisz hasło';
  } else if (currentLockMethod === 'pattern') {
    domRefs.lockHintText.textContent = 'Przeciągnij w górę — narysuj wzór';
  }
}

function requestUnlockChallenge(targetAppId = null) {
  pendingAppAfterUnlock = targetAppId;

  if (currentLockMethod === 'swipe') {
    unlockScreenNow();
    if (targetAppId) openApp(targetAppId);
    return;
  }

  hideAllUnlockPanels();
  resetUnlockInputs();
  if (domRefs.lockBottomArea) domRefs.lockBottomArea.classList.add('dimmed');

  if (currentLockMethod === 'pin' && domRefs.unlockPinPanel) {
    domRefs.unlockPinPanel.classList.add('active');
  } else if (currentLockMethod === 'password' && domRefs.unlockPasswordPanel) {
    domRefs.unlockPasswordPanel.classList.add('active');
    setTimeout(() => domRefs.lockPasswordInput?.focus(), 50);
  } else if (currentLockMethod === 'pattern' && domRefs.unlockPatternPanel) {
    domRefs.unlockPatternPanel.classList.add('active');
  }
}

function updatePinDots() {
  const dots = domRefs.pinDots?.querySelectorAll('span') || [];
  dots.forEach((dot, i) => {
    dot.classList.toggle('filled', i < enteredPin.length);
  });
}

function handlePinDigit(digit) {
  if (enteredPin.length >= 4) return;
  enteredPin += digit;
  updatePinDots();
  if (domRefs.pinError) domRefs.pinError.textContent = '';

  if (enteredPin.length === 4) {
    if (enteredPin === pinCode) {
      const nextApp = pendingAppAfterUnlock;
      unlockScreenNow();
      if (nextApp) openApp(nextApp);
    } else {
      if (domRefs.pinError) domRefs.pinError.textContent = 'Nieprawidłowy PIN';
      setTimeout(() => {
        enteredPin = '';
        updatePinDots();
      }, 280);
    }
  }
}

function submitPasswordUnlock() {
  const val = domRefs.lockPasswordInput?.value || '';
  if (val === passwordCode) {
    const nextApp = pendingAppAfterUnlock;
    unlockScreenNow();
    if (nextApp) openApp(nextApp);
  } else if (domRefs.passwordError) {
    domRefs.passwordError.textContent = 'Nieprawidłowe hasło';
  }
}

function clearPatternNodes() {
  enteredPattern = [];
  domRefs.patternNodes?.forEach((node) => node.classList.remove('selected'));
}

function handlePatternNode(nodeEl) {
  const id = nodeEl.getAttribute('data-node');
  if (!id || enteredPattern.includes(id)) return;

  enteredPattern.push(id);
  nodeEl.classList.add('selected');
  if (domRefs.patternError) domRefs.patternError.textContent = '';

  const seq = enteredPattern.join('-');
  if (seq === patternCode) {
    const nextApp = pendingAppAfterUnlock;
    unlockScreenNow();
    if (nextApp) openApp(nextApp);
  } else if (enteredPattern.length >= 9 || seq.length > patternCode.length) {
    if (domRefs.patternError) domRefs.patternError.textContent = 'Nieprawidłowy wzór';
    setTimeout(clearPatternNodes, 350);
  }
}

function syncSecretEditorUi() {
  if (!domRefs.secretEditInput || !domRefs.secretEditorLabel) return;
  if (currentLockMethod === 'pin') {
    domRefs.secretEditorLabel.textContent = 'Kod PIN (4 cyfry)';
    domRefs.secretEditInput.value = pinCode;
  } else if (currentLockMethod === 'password') {
    domRefs.secretEditorLabel.textContent = 'Hasło odblokowania';
    domRefs.secretEditInput.value = passwordCode;
  } else if (currentLockMethod === 'pattern') {
    domRefs.secretEditorLabel.textContent = 'Wzór (punkty 1–9 oddzielone myślnikiem)';
    domRefs.secretEditInput.value = patternCode;
  } else {
    domRefs.secretEditorLabel.textContent = 'Zapisany kod / wzór (do użycia po zmianie metody)';
    domRefs.secretEditInput.value = pinCode;
  }
}

function setLockMethod(method) {
  const valid = ['swipe', 'pin', 'password', 'pattern'].includes(method) ? method : 'swipe';
  currentLockMethod = valid;

  if (domRefs.currentLockLabel) {
    domRefs.currentLockLabel.textContent = LOCK_LABELS[valid];
  }

  domRefs.lockMethodOptions?.forEach((row) => {
    row.classList.toggle('active', row.getAttribute('data-lock-method') === valid);
  });

  updateLockHint();
  syncSecretEditorUi();
}

function saveSecretFromEditor() {
  const raw = (domRefs.secretEditInput?.value || '').trim();
  if (!raw) return;

  if (currentLockMethod === 'pin') {
    pinCode = raw;
    if (domRefs.secretStatusHint) domRefs.secretStatusHint.textContent = `Zapisano PIN: ${pinCode}`;
  } else if (currentLockMethod === 'password') {
    passwordCode = raw;
    if (domRefs.secretStatusHint) domRefs.secretStatusHint.textContent = `Zapisano hasło: ${passwordCode}`;
  } else if (currentLockMethod === 'pattern') {
    patternCode = raw;
    if (domRefs.secretStatusHint) domRefs.secretStatusHint.textContent = `Zapisano wzór: ${patternCode}`;
  } else {
    pinCode = raw;
    if (domRefs.secretStatusHint) domRefs.secretStatusHint.textContent = `Zapisano kod PIN: ${pinCode}`;
  }
}

function bindLockscreenFeatures() {
  const layer = domRefs.lockscreenLayer;
  if (layer) {
    layer.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.unlock-panel') || e.target.closest('.lock-circle-btn')) return;
      lockSwipeStartY = e.clientY;
    });

    layer.addEventListener('pointerup', (e) => {
      if (e.target.closest('.unlock-panel') || e.target.closest('.lock-circle-btn')) return;
      if (lockSwipeStartY === null) return;
      const deltaY = lockSwipeStartY - e.clientY;
      lockSwipeStartY = null;
      if (deltaY >= 14) {
        requestUnlockChallenge(null);
      }
    });
  }

  domRefs.lockSwipeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    requestUnlockChallenge(null);
  });

  domRefs.lockTorchBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    domRefs.lockTorchBtn.classList.toggle('torch-on');
  });

  domRefs.lockCameraBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    requestUnlockChallenge('app-gallery');
  });

  domRefs.pinKeys?.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const digit = btn.getAttribute('data-pin');
      if (digit) handlePinDigit(digit);
    });
  });

  domRefs.pinClearBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    enteredPin = '';
    updatePinDots();
    if (domRefs.pinError) domRefs.pinError.textContent = '';
  });

  domRefs.pinCancelBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    hideAllUnlockPanels();
    resetUnlockInputs();
  });

  domRefs.passwordSubmitBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    submitPasswordUnlock();
  });

  domRefs.lockPasswordInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitPasswordUnlock();
    }
  });

  domRefs.passwordCancelBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    hideAllUnlockPanels();
    resetUnlockInputs();
  });

  domRefs.patternNodes?.forEach((node) => {
    node.addEventListener('click', (e) => {
      e.stopPropagation();
      handlePatternNode(node);
    });
  });

  domRefs.patternResetBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    clearPatternNodes();
  });

  domRefs.patternCancelBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    hideAllUnlockPanels();
    resetUnlockInputs();
  });
}

function openSettingsSubscreen(screenId) {
  [
    domRefs.settingsMain,
    domRefs.settingsWallpaper,
    domRefs.settingsSystemNav,
    domRefs.settingsPasscode
  ].forEach((el) => {
    if (!el) return;
    el.classList.toggle('active', el.id === screenId);
  });
}

function setSystemNavMode(mode) {
  currentNavMode = mode === 'buttons' ? 'buttons' : 'gestures';

  if (domRefs.currentNavLabel) {
    domRefs.currentNavLabel.textContent = currentNavMode === 'buttons' ? 'Przyciski' : 'Gesty';
  }

  domRefs.navModeOptions.forEach((row) => {
    row.classList.toggle('active', row.getAttribute('data-nav-mode') === currentNavMode);
  });

  syncNavBarDisplay();
}

function handleBackAction() {
  const settingsOpen = domRefs.settingsView?.classList.contains('open');
  const subscreenActive =
    domRefs.settingsWallpaper?.classList.contains('active') ||
    domRefs.settingsSystemNav?.classList.contains('active') ||
    domRefs.settingsPasscode?.classList.contains('active');

  if (settingsOpen && subscreenActive) {
    openSettingsSubscreen('settings-main');
  } else {
    closeAllApps();
  }
}

function openApp(appId) {
  if (!appId) return;
  if (isLocked) {
    requestUnlockChallenge(appId);
    return;
  }
  if (appId === 'app-settings') {
    openSettingsSubscreen('settings-main');
  }
  domRefs.appViews.forEach((view) => {
    view.classList.toggle('open', view.id === appId);
  });
  syncNavBarDisplay();
  syncStatusBarDisplay();
}

function closeAllApps() {
  domRefs.appViews.forEach((view) => {
    view.classList.remove('open');
  });
  openSettingsSubscreen('settings-main');
  syncNavBarDisplay();
  syncStatusBarDisplay();
}

function bindAppNavigation() {
  domRefs.openAppTriggers.forEach((el) => {
    const targetId = el.getAttribute('data-open-app');
    if (!targetId) return;

    el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openApp(targetId);
    });
  });

  if (domRefs.gestureHandle) {
    domRefs.gestureHandle.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      gestureStartY = e.clientY;
    });

    domRefs.gestureHandle.addEventListener('pointerup', (e) => {
      e.stopPropagation();
      if (gestureStartY === null) {
        if (isAnyAppOpen()) closeAllApps();
        return;
      }
      const deltaY = gestureStartY - e.clientY;
      gestureStartY = null;
      if ((deltaY >= 8 || Math.abs(deltaY) < 10) && isAnyAppOpen()) {
        closeAllApps();
      }
    });

    domRefs.gestureHandle.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isAnyAppOpen()) {
        closeAllApps();
      }
    });
  }

  domRefs.sysBtnHome?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeAllApps();
  });

  domRefs.sysBtnRecents?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeAllApps();
  });

  domRefs.sysBtnBack?.addEventListener('click', (e) => {
    e.stopPropagation();
    handleBackAction();
  });
}

function setGalleryView(viewMode) {
  const isTimeline = viewMode === 'timeline';

  if (domRefs.galPaneCollections) {
    domRefs.galPaneCollections.classList.toggle('active', !isTimeline);
  }
  if (domRefs.galPaneTimeline) {
    domRefs.galPaneTimeline.classList.toggle('active', isTimeline);
  }

  domRefs.galSegButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-gal-view') === viewMode);
  });

  const messages = {
    collections: 'Brak pozycji',
    photos: 'Brak obrazów',
    albums: 'Brak kolekcji',
    search: 'Brak wyników'
  };

  if (domRefs.galleryEmptyText && messages[viewMode]) {
    domRefs.galleryEmptyText.textContent = messages[viewMode];
  }
  if (domRefs.galleryRecentCount) {
    domRefs.galleryRecentCount.textContent = '0 obrazów, 0 klipów';
  }
}

function bindGalleryFeatures() {
  domRefs.galSegButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-gal-view');
      if (mode) setGalleryView(mode);
    });
  });

  domRefs.galNavButtons.forEach((btn, index) => {
    btn.addEventListener('click', () => {
      const nav = btn.getAttribute('data-gal-nav');
      domRefs.galNavButtons.forEach((b, i) => b.classList.toggle('active', i === index));

      if (nav === 'timeline') {
        setGalleryView('timeline');
      } else if (nav === 'search') {
        setGalleryView('collections');
        domRefs.gallerySearchWrap?.classList.add('open');
        domRefs.gallerySearchInput?.focus();
      } else {
        setGalleryView(nav || 'collections');
      }
    });
  });

  if (domRefs.gallerySearchToggle && domRefs.gallerySearchWrap) {
    domRefs.gallerySearchToggle.addEventListener('click', () => {
      const opened = domRefs.gallerySearchWrap.classList.toggle('open');
      if (opened) domRefs.gallerySearchInput?.focus();
    });
  }

  if (domRefs.gallerySearchInput && domRefs.galleryEmptyText) {
    domRefs.gallerySearchInput.addEventListener('input', () => {
      const q = domRefs.gallerySearchInput.value.trim();
      domRefs.galleryEmptyText.textContent = q
        ? `Brak wyników dla „${q}”`
        : 'Brak pozycji';
    });
  }

  domRefs.zoomPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      domRefs.zoomPills.forEach((p) => p.classList.toggle('active', p === pill));
    });
  });
}

function bindSettingsFeatures() {
  const {
    settingsSearch,
    openWallpaperPicker,
    openSystemNavPicker,
    openPasscodePicker,
    settingsBackButtons,
    airplaneToggle,
    wifiStatusValue,
    btStatusValue,
    navModeOptions,
    lockMethodOptions,
    saveSecretBtn,
    testLockNowBtn,
    batteryCycleRow
  } = domRefs;

  if (settingsSearch) {
    settingsSearch.addEventListener('input', () => {
      const q = settingsSearch.value.trim().toLowerCase();
      document.querySelectorAll('#settings-main .settings-group[data-group]').forEach((group) => {
        const rows = group.querySelectorAll('.settings-row');
        let visibleCount = 0;

        rows.forEach((row) => {
          const titleText = (row.querySelector('.row-title')?.textContent || '').toLowerCase();
          const extra = (row.getAttribute('data-search') || '').toLowerCase();
          const match = !q || titleText.includes(q) || extra.includes(q);
          row.classList.toggle('hidden-by-search', !match);
          if (match) visibleCount++;
        });

        group.classList.toggle('all-hidden', visibleCount === 0);
      });
    });
  }

  if (airplaneToggle) {
    airplaneToggle.addEventListener('change', () => {
      const on = airplaneToggle.checked;
      if (wifiStatusValue) wifiStatusValue.textContent = on ? 'Wyłączone' : 'ZeniNet';
      if (btStatusValue) btStatusValue.textContent = on ? 'Wyłączony' : 'Włączony';
    });
  }

  if (batteryCycleRow) {
    batteryCycleRow.addEventListener('click', () => {
      batteryPresetIndex = (batteryPresetIndex + 1) % BATTERY_PRESETS.length;
      applyBatteryLevel(BATTERY_PRESETS[batteryPresetIndex]);
    });
  }

  if (openPasscodePicker) {
    openPasscodePicker.addEventListener('click', () => {
      syncSecretEditorUi();
      openSettingsSubscreen('settings-passcode');
    });
  }

  if (openWallpaperPicker) {
    openWallpaperPicker.addEventListener('click', () => {
      openSettingsSubscreen('settings-wallpaper');
    });
  }

  if (openSystemNavPicker) {
    openSystemNavPicker.addEventListener('click', () => {
      openSettingsSubscreen('settings-system-nav');
    });
  }

  settingsBackButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      openSettingsSubscreen('settings-main');
    });
  });

  navModeOptions.forEach((row) => {
    row.addEventListener('click', () => {
      const mode = row.getAttribute('data-nav-mode');
      if (mode) setSystemNavMode(mode);
    });
  });

  lockMethodOptions?.forEach((row) => {
    row.addEventListener('click', () => {
      const method = row.getAttribute('data-lock-method');
      if (method) setLockMethod(method);
    });
  });

  saveSecretBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    saveSecretFromEditor();
  });

  testLockNowBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    lockScreen();
  });
}

function finishLoading() {
  if (loadTimer) {
    clearTimeout(loadTimer);
    loadTimer = null;
  }
  if (domRefs.loadingStill) {
    domRefs.loadingStill.style.animation = 'none';
  }
  lockScreen();
}

function cacheDom() {
  domRefs = {
    statusBarOverlay: document.getElementById('status-bar-overlay'),
    statusClock: document.getElementById('status-clock'),
    statusBattery: document.getElementById('status-battery'),
    batteryFill: document.getElementById('battery-fill'),
    batteryCycleRow: document.getElementById('battery-cycle-row'),
    batterySettingState: document.getElementById('battery-setting-state'),
    stillLayer: document.getElementById('still-layer'),
    lockscreenLayer: document.getElementById('lockscreen-layer'),
    lockWallpaper: document.getElementById('lock-wallpaper'),
    lockDate: document.getElementById('lock-date'),
    lockClock: document.getElementById('lock-clock'),
    lockBottomArea: document.getElementById('lock-bottom-area'),
    lockSwipeBtn: document.getElementById('lock-swipe-btn'),
    lockHintText: document.getElementById('lock-hint-text'),
    lockTorchBtn: document.getElementById('lock-torch-btn'),
    lockCameraBtn: document.getElementById('lock-camera-btn'),
    unlockPinPanel: document.getElementById('unlock-pin-panel'),
    pinDots: document.getElementById('pin-dots'),
    pinError: document.getElementById('pin-error'),
    pinKeys: document.querySelectorAll('#pin-keypad .pin-key[data-pin]'),
    pinClearBtn: document.getElementById('pin-clear-btn'),
    pinCancelBtn: document.getElementById('pin-cancel-btn'),
    unlockPasswordPanel: document.getElementById('unlock-password-panel'),
    lockPasswordInput: document.getElementById('lock-password-input'),
    passwordError: document.getElementById('password-error'),
    passwordSubmitBtn: document.getElementById('password-submit-btn'),
    passwordCancelBtn: document.getElementById('password-cancel-btn'),
    unlockPatternPanel: document.getElementById('unlock-pattern-panel'),
    patternNodes: document.querySelectorAll('#pattern-grid .pattern-node'),
    patternError: document.getElementById('pattern-error'),
    patternResetBtn: document.getElementById('pattern-reset-btn'),
    patternCancelBtn: document.getElementById('pattern-cancel-btn'),
    wallpaperLayer: document.getElementById('wallpaper-layer'),
    loadingStill: document.getElementById('loading-still'),
    systemWallpaper: document.getElementById('system-wallpaper'),
    liquidDock: document.getElementById('liquid-dock'),
    appViews: document.querySelectorAll('.app-view'),
    settingsView: document.getElementById('app-settings'),
    openAppTriggers: document.querySelectorAll('[data-open-app]'),
    galSegButtons: document.querySelectorAll('[data-gal-view]'),
    galNavButtons: document.querySelectorAll('[data-gal-nav]'),
    galPaneCollections: document.getElementById('gal-pane-collections'),
    galPaneTimeline: document.getElementById('gal-pane-timeline'),
    gallerySearchToggle: document.getElementById('gallery-search-toggle'),
    gallerySearchWrap: document.getElementById('gallery-search-wrap'),
    gallerySearchInput: document.getElementById('gallery-search-input'),
    zoomPills: document.querySelectorAll('[data-zoom]'),
    galleryEmptyText: document.getElementById('gallery-empty-text'),
    galleryRecentCount: document.getElementById('gallery-recent-count'),
    settingsMain: document.getElementById('settings-main'),
    settingsWallpaper: document.getElementById('settings-wallpaper'),
    settingsSystemNav: document.getElementById('settings-system-nav'),
    settingsPasscode: document.getElementById('settings-passcode'),
    settingsBackButtons: document.querySelectorAll('[data-settings-back]'),
    settingsSearch: document.getElementById('settings-search'),
    airplaneToggle: document.getElementById('airplane-toggle'),
    wifiStatusValue: document.getElementById('wifi-status-value'),
    btStatusValue: document.getElementById('bt-status-value'),
    openPasscodePicker: document.getElementById('open-passcode-picker'),
    currentLockLabel: document.getElementById('current-lock-label'),
    lockMethodOptions: document.querySelectorAll('#lock-method-options .selectable-option'),
    secretEditorLabel: document.getElementById('secret-editor-label'),
    secretEditInput: document.getElementById('secret-edit-input'),
    saveSecretBtn: document.getElementById('save-secret-btn'),
    testLockNowBtn: document.getElementById('test-lock-now-btn'),
    secretStatusHint: document.getElementById('secret-status-hint'),
    openWallpaperPicker: document.getElementById('open-wallpaper-picker'),
    openSystemNavPicker: document.getElementById('open-system-nav-picker'),
    currentNavLabel: document.getElementById('current-nav-label'),
    navModeOptions: document.querySelectorAll('#nav-mode-options .selectable-option'),
    wpGrid: document.getElementById('wp-grid'),
    wallpaperPreviewImg: document.getElementById('wallpaper-preview-img'),
    wallpaperPreviewName: document.getElementById('wallpaper-preview-name'),
    currentWpLabel: document.getElementById('current-wp-label'),
    systemNavOverlay: document.getElementById('system-nav-overlay'),
    gestureHandle: document.getElementById('gesture-home-btn'),
    sysButtonsRow: document.getElementById('sys-buttons-row'),
    sysBtnBack: document.getElementById('sys-btn-back'),
    sysBtnHome: document.getElementById('sys-btn-home'),
    sysBtnRecents: document.getElementById('sys-btn-recents')
  };
}

function initSystem() {
  cacheDom();
  updateClock();
  clockTimer = setInterval(updateClock, 1000);
  initRealBatteryIfAvailable();
  bindLockscreenFeatures();
  bindAppNavigation();
  bindGalleryFeatures();
  bindSettingsFeatures();
  setWallpaper(DEFAULT_WALLPAPER_INDEX);
  setSystemNavMode(currentNavMode);
  setLockMethod(currentLockMethod);
  showLayer(domRefs.stillLayer);

  if (domRefs.liquidDock) {
    domRefs.liquidDock.classList.remove('visible');
  }

  loadTimer = setTimeout(finishLoading, LOAD_DURATION_MS);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSystem, { once: true });
} else {
  initSystem();
}
