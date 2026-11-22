const LOAD_DURATION_MS = 5000;
const LONG_PRESS_MS = 450;

const ZENIOS_WALLPAPERS = [
  'default_wallpapers/default_wallpaper_1',
  'default_wallpapers/default_wallpaper_2',
  'default_wallpapers/default_wallpaper_3',
  'default_wallpapers/default_wallpaper_4',
  'default_wallpapers/default_wallpaper_5',
  'default_wallpapers/default_wallpaper_6',
  'default_wallpapers/default_wallpaper_7'
];

const INSTALLED_APPS = [
  { id: 'app-messages', title: 'Wiadomości', icon: 'Icons/Messages_icon.png', badge: 'W' },
  { id: 'app-phone', title: 'Telefon', icon: 'Icons/Phone_Icon.png', badge: 'T' },
  { id: 'app-gallery', title: 'Galeria', icon: 'Icons/gallery_icon.png', badge: 'G' },
  { id: 'app-settings', title: 'Ustawienia', icon: 'Icons/Settings_Icon.png', badge: 'U', scaleIcon: true },
  { id: 'app-calculator', title: 'Kalkulator', icon: 'Icons/calculator_icon.png', badge: 'K' },
  { id: 'app-calendar', title: 'Kalendarz', icon: 'Icons/calendar_icon.png', badge: 'KAL' },
  { id: 'app-clock', title: 'Zegar', icon: 'Icons/clock_icons.png', badge: 'Z' },
  { id: 'app-files', title: 'Pliki', icon: 'Icons/files_icons.png', badge: 'P' },
  { id: 'app-notebook', title: 'Notatnik', icon: 'Icons/notebook_icon.png', badge: 'N' }
];

const AVAILABLE_WIDGETS = [
  {
    id: 'music',
    name: 'Muzyka',
    subtitle: 'Chromatica • Lady Gaga',
    caption: 'Music',
    theme: 'music-widget',
    artText: '♪',
    badge: '♫'
  },
  {
    id: 'calendar',
    name: 'Kalendarz',
    subtitle: 'Wydarzenia i data',
    caption: 'Calendar',
    theme: 'calendar-widget',
    artText: '22',
    badge: 'KAL'
  },
  {
    id: 'weather',
    name: 'Pogoda',
    subtitle: '14°C • Bezchmurnie',
    caption: 'Weather',
    theme: 'weather-widget',
    artText: '14°',
    badge: '☀'
  }
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
let homeSwipeStartX = null;
let homeSwipeStartY = null;
let longPressTimer = null;
let longPressTriggered = false;
let isHomeEditMode = false;
let selectedSwapAppId = null;
let isLocked = false;
let currentLockMethod = 'swipe';
let pinCode = '1234';
let passwordCode = 'zenios';
let patternCode = '1-2-5-8-9';
let enteredPin = '';
let enteredPattern = [];
let pendingAppAfterUnlock = null;
let domRefs = {};

let homeAppOrder = INSTALLED_APPS.map((a) => a.id);
let activeWidgets = [
  { id: 'music', wide: false },
  { id: 'calendar', wide: false }
];

/* Stan kalkulatora */
let calcExpression = '0';
let calcResetNext = false;

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
  const dateText = formatCurrentLockDate();
  if (domRefs.statusClock) domRefs.statusClock.textContent = timeText;
  if (domRefs.lockClock) domRefs.lockClock.textContent = timeText;
  if (domRefs.lockDate) domRefs.lockDate.textContent = dateText;
  if (domRefs.clockAppBig) domRefs.clockAppBig.textContent = timeText;
  if (domRefs.clockAppSub) domRefs.clockAppSub.textContent = dateText;
  if (domRefs.calendarAppDate) domRefs.calendarAppDate.textContent = dateText;
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

function attachAppIconFallback(imgEl, badgeText) {
  if (!imgEl) return;
  imgEl.onerror = () => {
    const parent = imgEl.parentElement;
    if (!parent) return;
    imgEl.remove();
    const span = document.createElement('span');
    span.className = 'home-app-fallback';
    span.textContent = badgeText;
    parent.appendChild(span);
  };
}

function setWallpaper(index) {
  if (index < 0 || index >= ZENIOS_WALLPAPERS.length) return;
  currentWallpaperIndex = index;
  const wpName = `default_wallpaper_${index + 1}`;
  const basePath = ZENIOS_WALLPAPERS[index];

  if (domRefs.systemWallpaper) loadImageWithFallback(domRefs.systemWallpaper, basePath);
  if (domRefs.lockWallpaper) loadImageWithFallback(domRefs.lockWallpaper, basePath);
  if (domRefs.currentWpLabel) domRefs.currentWpLabel.textContent = wpName;
  if (domRefs.wallpaperPreviewImg) loadImageWithFallback(domRefs.wallpaperPreviewImg, basePath);
  if (domRefs.wallpaperPreviewName) domRefs.wallpaperPreviewName.textContent = wpName;
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

/* Widżety i tryb przytrzymania na pulpicie */
function renderWidgets() {
  const grid = domRefs.widgetsGrid;
  if (!grid) return;
  grid.innerHTML = '';

  activeWidgets.forEach((entry, index) => {
    const meta = AVAILABLE_WIDGETS.find((w) => w.id === entry.id);
    if (!meta) return;

    const wrap = document.createElement('div');
    wrap.className = `zen-widget ${meta.theme}${entry.wide ? ' wide' : ''}`;

    const topRow = document.createElement('div');
    topRow.className = 'widget-top-row';

    const art = document.createElement('div');
    art.className = 'widget-art';
    art.textContent = meta.artText;

    const badge = document.createElement('span');
    badge.className = 'widget-badge-icon';
    badge.textContent = meta.badge;

    topRow.appendChild(art);
    topRow.appendChild(badge);

    const infoCol = document.createElement('div');
    const titleEl = document.createElement('div');
    titleEl.className = 'widget-title';
    titleEl.textContent = meta.id === 'calendar' ? `${new Date().getDate()} ${formatCurrentLockDate().split(',')[1] || ''}` : meta.name;

    const subEl = document.createElement('div');
    subEl.className = 'widget-sub';
    subEl.textContent = meta.subtitle;

    infoCol.appendChild(titleEl);
    infoCol.appendChild(subEl);

    const editBar = document.createElement('div');
    editBar.className = 'widget-edit-bar';

    const sizeBtn = document.createElement('button');
    sizeBtn.type = 'button';
    sizeBtn.className = 'widget-mini-btn';
    sizeBtn.textContent = entry.wide ? 'Mały' : 'Szeroki';
    sizeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      activeWidgets[index].wide = !activeWidgets[index].wide;
      renderWidgets();
    });

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'widget-mini-btn';
    delBtn.textContent = 'Usuń';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      activeWidgets.splice(index, 1);
      renderWidgets();
    });

    editBar.appendChild(sizeBtn);
    editBar.appendChild(delBtn);

    const caption = document.createElement('div');
    caption.className = 'widget-caption';
    caption.textContent = meta.caption;

    wrap.appendChild(topRow);
    wrap.appendChild(infoCol);
    wrap.appendChild(editBar);
    wrap.appendChild(caption);

    wrap.addEventListener('click', () => {
      if (longPressTriggered || isHomeEditMode) return;
      if (meta.id === 'calendar') openApp('app-calendar');
    });

    grid.appendChild(wrap);
  });

  renderWidgetPicker();
}

function renderWidgetPicker() {
  const list = domRefs.widgetPickerList;
  if (!list) return;
  list.innerHTML = '';

  AVAILABLE_WIDGETS.forEach((w) => {
    const exists = activeWidgets.some((item) => item.id === w.id);
    const row = document.createElement('div');
    row.className = 'widget-picker-item';

    const col = document.createElement('div');
    col.className = 'option-text-col';
    col.innerHTML = `<span class="row-title">${w.name}</span><span class="option-sub">${w.subtitle}</span>`;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `glass-action-btn ${exists ? '' : 'primary'}`;
    btn.textContent = exists ? 'Usuń' : 'Dodaj';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (exists) {
        activeWidgets = activeWidgets.filter((item) => item.id !== w.id);
      } else {
        activeWidgets.push({ id: w.id, wide: false });
      }
      renderWidgets();
    });

    row.appendChild(col);
    row.appendChild(btn);
    list.appendChild(row);
  });
}

function renderHomeApps() {
  const grid = domRefs.homeAppsGrid;
  if (!grid) return;
  grid.innerHTML = '';

  homeAppOrder.forEach((appId) => {
    const app = INSTALLED_APPS.find((item) => item.id === appId);
    if (!app) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `home-app-tile${selectedSwapAppId === app.id ? ' swap-selected' : ''}`;
    btn.setAttribute('data-app-id', app.id);

    const iconBox = document.createElement('div');
    iconBox.className = 'home-app-icon-box';

    const img = document.createElement('img');
    img.src = app.icon;
    img.alt = app.title;
    if (app.scaleIcon) img.style.transform = 'scale(1.24)';
    attachAppIconFallback(img, app.badge);

    const label = document.createElement('span');
    label.className = 'home-app-label';
    label.textContent = app.title;

    iconBox.appendChild(img);
    btn.appendChild(iconBox);
    btn.appendChild(label);

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (longPressTriggered) return;

      if (isHomeEditMode) {
        if (!selectedSwapAppId) {
          selectedSwapAppId = app.id;
          if (domRefs.homeEditStatus) domRefs.homeEditStatus.textContent = `Wybrano: ${app.title} — kliknij inne`;
          renderHomeApps();
        } else if (selectedSwapAppId === app.id) {
          selectedSwapAppId = null;
          if (domRefs.homeEditStatus) domRefs.homeEditStatus.textContent = 'Tryb edycji — kliknij 2 ikony';
          renderHomeApps();
        } else {
          const i1 = homeAppOrder.indexOf(selectedSwapAppId);
          const i2 = homeAppOrder.indexOf(app.id);
          if (i1 !== -1 && i2 !== -1) {
            [homeAppOrder[i1], homeAppOrder[i2]] = [homeAppOrder[i2], homeAppOrder[i1]];
          }
          selectedSwapAppId = null;
          if (domRefs.homeEditStatus) domRefs.homeEditStatus.textContent = 'Zamieniono miejscami';
          renderHomeApps();
        }
        return;
      }

      openApp(app.id);
    });

    grid.appendChild(btn);
  });
}

function setHomeEditMode(enabled) {
  isHomeEditMode = Boolean(enabled);
  selectedSwapAppId = null;
  domRefs.wallpaperLayer?.classList.toggle('editing', isHomeEditMode);
  if (!isHomeEditMode) {
    domRefs.widgetPickerSheet?.classList.remove('open');
  } else if (domRefs.homeEditStatus) {
    domRefs.homeEditStatus.textContent = 'Widżety i zamiana pozycji ikon';
  }
  renderWidgets();
  renderHomeApps();
}

function renderInstalledAppsSearch(query = '') {
  const list = domRefs.installedAppsList;
  if (!list) return;
  const q = query.trim().toLowerCase();
  list.innerHTML = '';

  const filtered = INSTALLED_APPS.filter((app) => !q || app.title.toLowerCase().includes(q));
  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-label" style="text-align:center;padding:18px;">Brak zainstalowanej aplikacji</div>';
    return;
  }

  filtered.forEach((app) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'installed-app-item';

    const thumb = document.createElement('div');
    thumb.className = 'installed-app-thumb';
    const img = document.createElement('img');
    img.src = app.icon;
    img.alt = app.title;
    attachAppIconFallback(img, app.badge);
    thumb.appendChild(img);

    const name = document.createElement('span');
    name.className = 'row-title';
    name.textContent = app.title;

    const tag = document.createElement('span');
    tag.className = 'row-value';
    tag.textContent = 'Zainstalowana';

    item.appendChild(thumb);
    item.appendChild(name);
    item.appendChild(tag);

    item.addEventListener('click', () => {
      closeSearchDrawer();
      openApp(app.id);
    });

    list.appendChild(item);
  });
}

function openSearchDrawer() {
  if (isHomeEditMode) return;
  domRefs.appSearchDrawer?.classList.add('open');
  renderInstalledAppsSearch(domRefs.installedAppsSearch?.value || '');
  setTimeout(() => domRefs.installedAppsSearch?.focus(), 60);
}

function closeSearchDrawer() {
  domRefs.appSearchDrawer?.classList.remove('open');
}

function bindHomeGesturesAndLongPress() {
  const home = domRefs.wallpaperLayer;
  if (!home) return;

  home.addEventListener('pointerdown', (e) => {
    if (isLocked || isAnyAppOpen()) return;
    if (e.target.closest('.widget-picker-sheet') || e.target.closest('.app-search-drawer') || e.target.closest('.liquid-dock')) {
      return;
    }

    homeSwipeStartX = e.clientX;
    homeSwipeStartY = e.clientY;
    longPressTriggered = false;

    clearTimeout(longPressTimer);
    longPressTimer = setTimeout(() => {
      longPressTriggered = true;
      setHomeEditMode(true);
    }, LONG_PRESS_MS);
  });

  home.addEventListener('pointermove', (e) => {
    if (homeSwipeStartX === null || homeSwipeStartY === null) return;
    if (Math.hypot(e.clientX - homeSwipeStartX, e.clientY - homeSwipeStartY) > 10) {
      clearTimeout(longPressTimer);
    }
  });

  home.addEventListener('pointerup', (e) => {
    clearTimeout(longPressTimer);
    if (homeSwipeStartX === null || homeSwipeStartY === null) return;

    const dx = e.clientX - homeSwipeStartX;
    const dy = e.clientY - homeSwipeStartY;
    homeSwipeStartX = null;
    homeSwipeStartY = null;

    if (longPressTriggered || isHomeEditMode) return;

    /* Przesunięcie z prawej do lewej -> otwiera wyszukiwanie zainstalowanych aplikacji */
    if (dx <= -45 && Math.abs(dx) > Math.abs(dy)) {
      openSearchDrawer();
    } else if (dx >= 45 && Math.abs(dx) > Math.abs(dy) && domRefs.appSearchDrawer?.classList.contains('open')) {
      closeSearchDrawer();
    }
  });

  home.addEventListener('pointercancel', () => {
    clearTimeout(longPressTimer);
    homeSwipeStartX = null;
    homeSwipeStartY = null;
  });

  domRefs.openWidgetDrawerBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    domRefs.widgetPickerSheet?.classList.toggle('open');
  });

  domRefs.closeWidgetDrawerBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    domRefs.widgetPickerSheet?.classList.remove('open');
  });

  domRefs.doneEditModeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    setHomeEditMode(false);
  });

  domRefs.closeSearchDrawerBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeSearchDrawer();
  });

  domRefs.installedAppsSearch?.addEventListener('input', () => {
    renderInstalledAppsSearch(domRefs.installedAppsSearch.value);
  });
}

function bindCalculator() {
  domRefs.calcPad?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-calc]');
    if (!btn || !domRefs.calcDisplay) return;
    const token = btn.getAttribute('data-calc');

    if (token === 'C') {
      calcExpression = '0';
      calcResetNext = false;
    } else if (token === '±') {
      calcExpression = calcExpression.startsWith('-') ? calcExpression.slice(1) : `-${calcExpression}`;
    } else if (token === '%') {
      const num = parseFloat(calcExpression);
      calcExpression = Number.isNaN(num) ? '0' : String(num / 100);
    } else if (token === '=') {
      try {
        const safeExpr = calcExpression.replace(/[^0-9+\-*/.]/g, '');
        const res = Function(`"use strict"; return (${safeExpr || 0});`)();
        calcExpression = String(res);
        calcResetNext = true;
      } catch {
        calcExpression = 'Błąd';
        calcResetNext = true;
      }
    } else {
      if (calcResetNext && /[0-9.]/.test(token)) {
        calcExpression = token;
        calcResetNext = false;
      } else if (calcExpression === '0' && /[0-9]/.test(token)) {
        calcExpression = token;
        calcResetNext = false;
      } else {
        calcExpression += token;
        calcResetNext = false;
      }
    }
    domRefs.calcDisplay.textContent = calcExpression;
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
  setHomeEditMode(false);
  closeSearchDrawer();
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
  closeSearchDrawer();
  setHomeEditMode(false);
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
    closeSearchDrawer();
    closeAllApps();
  });

  domRefs.sysBtnRecents?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeAllApps();
  });

  domRefs.sysBtnBack?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (domRefs.appSearchDrawer?.classList.contains('open') && !isAnyAppOpen()) {
      closeSearchDrawer();
      return;
    }
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
    widgetsGrid: document.getElementById('widgets-grid'),
    homeAppsGrid: document.getElementById('home-apps-grid'),
    homeEditStatus: document.getElementById('home-edit-status'),
    openWidgetDrawerBtn: document.getElementById('open-widget-drawer-btn'),
    closeWidgetDrawerBtn: document.getElementById('close-widget-drawer-btn'),
    doneEditModeBtn: document.getElementById('done-edit-mode-btn'),
    widgetPickerSheet: document.getElementById('widget-picker-sheet'),
    widgetPickerList: document.getElementById('widget-picker-list'),
    appSearchDrawer: document.getElementById('app-search-drawer'),
    closeSearchDrawerBtn: document.getElementById('close-search-drawer-btn'),
    installedAppsSearch: document.getElementById('installed-apps-search'),
    installedAppsList: document.getElementById('installed-apps-list'),
    calcDisplay: document.getElementById('calc-display'),
    calcPad: document.getElementById('calc-pad'),
    calendarAppDate: document.getElementById('calendar-app-date'),
    clockAppBig: document.getElementById('clock-app-big'),
    clockAppSub: document.getElementById('clock-app-sub'),
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
  bindHomeGesturesAndLongPress();
  bindCalculator();
  renderWidgets();
  renderHomeApps();
  renderInstalledAppsSearch('');
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
