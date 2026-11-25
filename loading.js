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
    subtitle: '',
    caption: 'Music',
    theme: 'music-widget',
    artText: '♪',
    badge: '♫'
  },
  {
    id: 'calendar',
    name: 'Kalendarz',
    subtitle: '',
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

/* Wspólny stan muzyki (widżet + Centrum sterowania) */
const zenMusic = { playing: false, title: 'Chromatica', artist: 'Lady Gaga' };
let zenTodayEvents = () => [];

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
let currentBatteryCharging = false;
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

/* Wskaźnik baterii w stylu iOS.
   setBatteryLevel(percent, { charging }) — percent 0–100; charging (opcjonalnie) włącza stan ładowania.
   Pominięcie opts.charging zachowuje poprzedni stan ładowania. */
function setBatteryLevel(percent, opts) {
  const clamped = Math.max(0, Math.min(100, Math.round(Number(percent)) || 0));
  currentBatteryLevel = clamped;
  if (opts && typeof opts.charging === 'boolean') currentBatteryCharging = opts.charging;

  const batt = domRefs.statusBattery || document.getElementById('status-battery');
  if (batt) {
    batt.style.setProperty('--lvl', `${clamped}%`);
    batt.setAttribute('data-level', String(clamped));
    batt.classList.toggle('low', clamped <= 20 && !currentBatteryCharging);
    batt.classList.toggle('charging', currentBatteryCharging);
    batt.setAttribute('aria-label', `Bateria ${clamped}%${currentBatteryCharging ? ', ładowanie' : ''}`);
    batt.querySelectorAll('.battery-pct').forEach((n) => { n.textContent = String(clamped); });
  }

  if (domRefs.batterySettingState) {
    domRefs.batterySettingState.textContent = `${clamped}%${currentBatteryCharging ? ' ⚡' : ''}`;
  }
  const ccTxt = document.getElementById('cc-batt-txt');
  if (ccTxt) ccTxt.textContent = `${clamped}%`;
  const ccFill = document.getElementById('cc-batt-fill');
  if (ccFill) ccFill.setAttribute('width', String(Math.max(1, 13 * clamped / 100)));
}

/* zachowana nazwa używana w reszcie kodu */
function applyBatteryLevel(level, opts) {
  setBatteryLevel(level, opts);
}

function initRealBatteryIfAvailable() {
  setBatteryLevel(currentBatteryLevel, { charging: false });   // fallback, gdy API baterii jest niedostępne
  if (typeof navigator === 'undefined' || typeof navigator.getBattery !== 'function') return;
  navigator.getBattery().then((battery) => {
    if (!battery) return;
    const syncFromDevice = () => {
      const pct = Math.round((battery.level || 0) * 100);
      const idx = BATTERY_PRESETS.indexOf(pct);
      if (idx >= 0) batteryPresetIndex = idx;
      setBatteryLevel(pct, { charging: Boolean(battery.charging) });
    };
    syncFromDevice();
    battery.addEventListener('levelchange', syncFromDevice);
    battery.addEventListener('chargingchange', syncFromDevice);
  }).catch(() => { /* zostaje fallback */ });
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
  if (window.ZeniLock) window.ZeniLock.syncSystemWallpaper(basePath);   // tapetą ekranu blokady zarządza ZeniLock
  else if (domRefs.lockWallpaper) loadImageWithFallback(domRefs.lockWallpaper, basePath);
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

/* Ujednolica ikony: przycina przezroczysty margines i skaluje każdą do pełnego pola,
   żeby wszystkie miały identyczny rozmiar (bez ciemnego tła pod spodem). */
const iconCache = {};
function normalizeIcon(img) {
  const src = img.src;
  const apply = (url) => { img.src = url; };
  if (iconCache[src]) { apply(iconCache[src]); return; }
  const probe = new Image();
  probe.onload = () => {
    try {
      const w = probe.naturalWidth, h = probe.naturalHeight;
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      ctx.drawImage(probe, 0, 0);
      const d = ctx.getImageData(0, 0, w, h).data;
      let x0 = w, y0 = h, x1 = -1, y1 = -1;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (d[(y * w + x) * 4 + 3] > 20) {
            if (x < x0) x0 = x; if (x > x1) x1 = x;
            if (y < y0) y0 = y; if (y > y1) y1 = y;
          }
        }
      }
      if (x1 < 0) return;
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
      const side = Math.max(bw, bh);
      const out = document.createElement('canvas');
      out.width = out.height = 256;
      const octx = out.getContext('2d');
      octx.imageSmoothingQuality = 'high';
      const sc = 256 / side;
      octx.drawImage(probe, x0, y0, bw, bh, (256 - bw * sc) / 2, (256 - bh * sc) / 2, bw * sc, bh * sc);
      iconCache[src] = out.toDataURL('image/png');
      apply(iconCache[src]);
    } catch (e) { /* np. file:// blokuje canvas — zostaje CSS */ }
  };
  probe.src = src;
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

    const infoCol = document.createElement('div');
    infoCol.className = 'widget-info';
    const titleEl = document.createElement('div');
    titleEl.className = 'widget-title';
    const subEl = document.createElement('div');
    subEl.className = 'widget-sub';

    const now = new Date();
    const DAYS_UP = ['NIEDZIELA', 'PONIEDZIAŁEK', 'WTOREK', 'ŚRODA', 'CZWARTEK', 'PIĄTEK', 'SOBOTA'];
    const MONTHS_GEN = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];

    if (meta.id === 'music') {
      wrap.classList.toggle('idle', !zenMusic.playing);
      const art = document.createElement('div');
      art.className = 'widget-art';
      art.textContent = '♪';
      const badge = document.createElement('span');
      badge.className = 'widget-badge-icon';
      badge.textContent = zenMusic.playing ? '♫' : '';
      topRow.appendChild(art);
      topRow.appendChild(badge);
      titleEl.textContent = zenMusic.playing ? zenMusic.title : 'Nic nie leci';
      subEl.textContent = zenMusic.playing ? zenMusic.artist : 'Wybierz utwór';
    } else if (meta.id === 'calendar') {
      /* dzień pokazany tylko RAZ: etykieta dnia tygodnia + duża cyfra + miesiąc */
      const dow = document.createElement('span');
      dow.className = 'widget-dow';
      dow.textContent = DAYS_UP[now.getDay()];
      topRow.appendChild(dow);
      titleEl.textContent = String(now.getDate());
      titleEl.classList.add('big-day');
      const evs = zenTodayEvents();
      subEl.textContent = `${MONTHS_GEN[now.getMonth()]} · ${evs.length ? `${evs[0].time} ${evs[0].title}` : 'Brak wydarzeń'}`;
    } else {
      const art = document.createElement('div');
      art.className = 'widget-art';
      art.textContent = meta.artText;
      const badge = document.createElement('span');
      badge.className = 'widget-badge-icon';
      badge.textContent = meta.badge;
      topRow.appendChild(art);
      topRow.appendChild(badge);
      titleEl.textContent = meta.name;
      subEl.textContent = meta.subtitle;
    }

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
    attachAppIconFallback(img, app.badge);
    normalizeIcon(img);

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
  if (typeof updateStatusBarTone === 'function') updateStatusBarTone();
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
  // Bezpieczne zamykanie kamery (używa globalnej funkcji close z zeni-camera.js)
  if (window.ZeniCamera && typeof window.ZeniCamera.close === 'function') {
    window.ZeniCamera.close();
  }
  
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
    /* jak w iPhonie: aparat ze ekranu blokady otwiera się bez odblokowania,
       a galeria pozostaje zablokowana */
    if (window.ZeniCamera) {
      // Przekazujemy warstwę blokady jako kontener dla aparatu
      const container = domRefs.lockscreenLayer || document.body;
      window.ZeniCamera.open(container);
    }
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
    domRefs.settingsPasscode,
    document.getElementById('settings-lockscreen'),
    document.getElementById('settings-wifi'),
    document.getElementById('settings-bluetooth')
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
    domRefs.settingsPasscode?.classList.contains('active') ||
    document.getElementById('settings-lockscreen')?.classList.contains('active');

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
  initZeniApps();
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

/* =====================================================================
   ZeniOS 2.0 — motyw, kalkulator, notatki, pliki, kalendarz, zegar, centrum sterowania
   ===================================================================== */

const $z = (id) => document.getElementById(id);
const pad2 = (n) => String(n).padStart(2, '0');
const PL_MONTHS_SHORT = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'];
const PL_MONTHS_GEN = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
const PL_DAYS = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];

let currentTheme = 'dark';
let ccOpen = false;
let sysVolume = 0.6;
let zeniToastTimer = null;
let ringBeepTimer = null;

function zeniToast(msg) {
  const t = $z('cc-toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(zeniToastTimer);
  zeniToastTimer = setTimeout(() => t.classList.remove('show'), 1700);
}

/* ---------------- MOTYW ---------------- */
function updateStatusBarTone() {
  const phone = document.querySelector('.phone-screen');
  if (!phone) return;
  const open = document.querySelector('.app-view.open');
  const lightApp = open && open.id !== 'app-calculator';
  const tone = currentTheme === 'light' && !isLocked && (lightApp || ccOpen);
  phone.classList.toggle('tone-dark', Boolean(tone));
}

function setTheme(theme, animate = true) {
  const phone = document.querySelector('.phone-screen');
  if (!phone) return;
  currentTheme = theme === 'light' ? 'light' : 'dark';
  if (animate) {
    phone.classList.add('theme-anim');
    setTimeout(() => phone.classList.remove('theme-anim'), 500);
  }
  phone.setAttribute('data-theme', currentTheme);
  document.querySelectorAll('[data-theme-set]').forEach((b) => {
    b.classList.toggle('active', b.getAttribute('data-theme-set') === currentTheme);
  });
  $z('cc-theme')?.classList.toggle('on-blue', currentTheme === 'dark');
  updateStatusBarTone();
}

function bindTheme() {
  document.querySelectorAll('[data-theme-set]').forEach((b) => {
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      setTheme(b.getAttribute('data-theme-set'));
    });
  });
  setTheme('dark', false);
}

/* ---------------- KALKULATOR ---------------- */
function initCalculator() {
  const display = $z('calc-display');
  const pad = $z('calc-pad');
  const acBtn = $z('calc-ac');
  if (!display || !pad) return;

  let cur = '0';
  let acc = null;
  let op = null;
  let fresh = true;
  let lastOp = null;
  let lastVal = null;
  let justEq = false;

  const numStr = (n) => {
    if (!isFinite(n)) return 'Błąd';
    const s = String(parseFloat(n.toPrecision(12)));
    if (s.includes('e')) return n.toExponential(5);
    return s;
  };
  const fmt = (s) => {
    if (s === 'Błąd') return s;
    if (s.includes('e')) return s.replace('.', ',');
    const neg = s.startsWith('-');
    const t = neg ? s.slice(1) : s;
    const [i, f] = t.split('.');
    const grouped = i.replace(/\B(?=(\d{3})+(?!\d))/g, '\u202F');
    return (neg ? '-' : '') + grouped + (f !== undefined ? ',' + f : '');
  };
  const apply = (a, b, o) => {
    switch (o) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/': return b === 0 ? NaN : a / b;
      default: return b;
    }
  };
  const render = () => {
    const text = fmt(cur);
    display.textContent = text;
    const len = text.length;
    const scale = len <= 6 ? 0.2 : len <= 7 ? 0.175 : len <= 8 ? 0.155 : len <= 9 ? 0.138 : len <= 11 ? 0.118 : 0.1;
    display.style.fontSize = `calc(min(100vw, 50dvh) * ${scale})`;
    if (acBtn) acBtn.textContent = cur !== '0' || !fresh ? 'C' : 'AC';
    pad.querySelectorAll('.op').forEach((b) => {
      const t = b.getAttribute('data-calc');
      b.classList.toggle('active', Boolean(op) && fresh && t === op);
    });
  };
  const press = (t) => {
    if (cur === 'Błąd' && t !== 'C') { cur = '0'; acc = null; op = null; fresh = true; }
    if (/^[0-9]$/.test(t)) {
      if (justEq) { acc = null; op = null; justEq = false; }
      if (fresh || cur === '0') { cur = t; fresh = false; }
      else if (cur.replace(/[-.]/g, '').length < 9) cur += t;
    } else if (t === '.') {
      if (justEq) { acc = null; op = null; justEq = false; }
      if (fresh) { cur = '0.'; fresh = false; }
      else if (!cur.includes('.')) cur += '.';
    } else if (['+', '-', '*', '/'].includes(t)) {
      const val = parseFloat(cur);
      if (op && !fresh && acc !== null) { acc = apply(acc, val, op); cur = numStr(acc); }
      else if (!(op && fresh)) acc = val;
      op = t; fresh = true; justEq = false; lastOp = null;
    } else if (t === '=') {
      const val = parseFloat(cur);
      if (op) {
        const b = fresh ? acc : val;
        const res = apply(acc, b, op);
        lastOp = op; lastVal = b; acc = res; cur = numStr(res);
        op = null; fresh = true; justEq = true;
      } else if (lastOp) {
        const res = apply(val, lastVal, lastOp);
        cur = numStr(res); acc = res; fresh = true; justEq = true;
      }
    } else if (t === '%') {
      cur = numStr(parseFloat(cur) / 100); fresh = false;
    } else if (t === '±') {
      if (cur !== '0') cur = cur.startsWith('-') ? cur.slice(1) : '-' + cur;
    } else if (t === 'C') {
      if (acBtn && acBtn.textContent === 'C') { cur = '0'; fresh = true; }
      else { cur = '0'; acc = null; op = null; fresh = true; lastOp = null; justEq = false; }
    }
    render();
  };

  pad.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-calc]');
    if (btn) press(btn.getAttribute('data-calc'));
  });
  document.addEventListener('keydown', (e) => {
    if (!$z('app-calculator')?.classList.contains('open')) return;
    if (/^[0-9]$/.test(e.key)) press(e.key);
    else if (e.key === ',' || e.key === '.') press('.');
    else if (['+', '-', '*', '/'].includes(e.key)) press(e.key);
    else if (e.key === 'Enter' || e.key === '=') press('=');
    else if (e.key === 'Escape') { cur = '0'; acc = null; op = null; fresh = true; render(); }
    else if (e.key === 'Backspace' && !fresh) { cur = cur.length > 1 && cur !== 'Błąd' ? cur.slice(0, -1) : '0'; if (cur === '-') cur = '0'; render(); }
  });
  render();
}

/* ---------------- NOTATKI ---------------- */
function initNotes() {
  const listScreen = $z('notes-list-screen');
  const editScreen = $z('notes-edit-screen');
  const listEl = $z('notes-list');
  if (!listScreen || !editScreen || !listEl) return;
  const titleEl = $z('note-title');
  const bodyEl = $z('note-body');
  const menu = $z('note-menu');
  const now = Date.now();
  let notes = [
    { id: 1, title: 'Test', body: 'To jest, bez zaskoczenia, test\n\nTest 1\n\nTest\n\nTest 2', ts: now - 3600e3 * 2 },
    { id: 2, title: 'Pomysły na pulpit ZeniOS', body: 'Widżety, siatka ikon, centrum sterowania i jasny motyw.', ts: now - 86400e3 * 3 },
    { id: 3, title: 'Lista zakupów', body: '• mleko\n• chleb\n• kawa', ts: now - 86400e3 * 20 }
  ];
  let nextId = 4;
  let currentId = null;

  const timeLabel = (ts) => {
    const d = new Date(ts);
    const t = new Date();
    const dayDiff = Math.floor((new Date(t.getFullYear(), t.getMonth(), t.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400e3);
    if (dayDiff === 0) return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    if (dayDiff === 1) return 'Wczoraj';
    if (dayDiff < 7) return PL_DAYS[d.getDay()].replace(/^./, (c) => c.toUpperCase());
    return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
  };
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const previewOf = (n) => (n.body.split('\n').find((l) => l.trim()) || 'Brak dodatkowego tekstu');

  const renderList = () => {
    const q = ($z('notes-search')?.value || '').trim().toLowerCase();
    const sorted = notes.filter((n) => !q || (n.title + ' ' + n.body).toLowerCase().includes(q)).sort((a, b) => b.ts - a.ts);
    const groups = { 'Dzisiaj': [], 'Poprzednie 7 dni': [], 'Starsze': [] };
    sorted.forEach((n) => {
      const age = (Date.now() - n.ts) / 86400e3;
      (age < 1 ? groups['Dzisiaj'] : age < 8 ? groups['Poprzednie 7 dni'] : groups['Starsze']).push(n);
    });
    listEl.innerHTML = '';
    Object.entries(groups).forEach(([name, arr]) => {
      if (!arr.length) return;
      const h = document.createElement('div');
      h.className = 'notes-section-title';
      h.textContent = name;
      const g = document.createElement('div');
      g.className = 'notes-group';
      arr.forEach((n) => {
        const r = document.createElement('div');
        r.className = 'note-row';
        r.innerHTML = `<div class="note-row-title">${esc(n.title || 'Nowa notatka')}</div><div class="note-row-sub"><b>${timeLabel(n.ts)}</b>${esc(previewOf(n))}</div>`;
        r.addEventListener('click', () => openNote(n.id));
        g.appendChild(r);
      });
      listEl.append(h, g);
    });
    const c = notes.length;
    $z('notes-count').textContent = c === 1 ? '1 notatka' : c % 10 >= 2 && c % 10 <= 4 && (c % 100 < 10 || c % 100 >= 20) ? `${c} notatki` : `${c} notatek`;
  };
  const showScreen = (which) => {
    listScreen.classList.toggle('active', which === 'list');
    editScreen.classList.toggle('active', which === 'edit');
    menu.classList.remove('open');
  };
  const openNote = (id) => {
    const n = notes.find((x) => x.id === id);
    if (!n) return;
    currentId = id;
    titleEl.value = n.title;
    bodyEl.value = n.body;
    const d = new Date(n.ts);
    $z('note-date').textContent = `${d.getDate()} ${PL_MONTHS_GEN[d.getMonth()]} ${d.getFullYear()} o ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    showScreen('edit');
  };
  const closeNote = () => {
    const n = notes.find((x) => x.id === currentId);
    if (n && !n.title.trim() && !n.body.trim()) notes = notes.filter((x) => x.id !== currentId);
    currentId = null;
    renderList();
    showScreen('list');
  };
  const save = () => {
    const n = notes.find((x) => x.id === currentId);
    if (!n) return;
    n.title = titleEl.value;
    n.body = bodyEl.value;
    n.ts = Date.now();
  };

  $z('note-new-btn').addEventListener('click', () => {
    const n = { id: nextId++, title: '', body: '', ts: Date.now() };
    notes.push(n);
    openNote(n.id);
    setTimeout(() => titleEl.focus(), 60);
  });
  titleEl.addEventListener('input', save);
  bodyEl.addEventListener('input', save);
  titleEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); bodyEl.focus(); } });
  $z('note-back').addEventListener('click', closeNote);
  $z('note-done').addEventListener('click', closeNote);
  $z('note-undo').addEventListener('click', () => { bodyEl.focus(); document.execCommand('undo'); save(); });
  $z('note-share').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(`${titleEl.value}\n\n${bodyEl.value}`); zeniToast('Skopiowano notatkę'); }
    catch { zeniToast('Nie można skopiować'); }
  });
  $z('note-more').addEventListener('click', (e) => { e.stopPropagation(); menu.classList.toggle('open'); });
  editScreen.addEventListener('click', (e) => { if (!e.target.closest('#note-menu') && !e.target.closest('#note-more')) menu.classList.remove('open'); });
  $z('note-delete').addEventListener('click', () => { notes = notes.filter((x) => x.id !== currentId); currentId = null; renderList(); showScreen('list'); });
  $z('notes-search').addEventListener('input', renderList);

  editScreen.querySelectorAll('[data-fmt]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const f = btn.getAttribute('data-fmt');
      const ta = bodyEl;
      ta.focus();
      const ls = ta.value.lastIndexOf('\n', ta.selectionStart - 1) + 1;
      const insertAt = (txt) => { ta.setRangeText(txt, ls, ls, 'end'); };
      if (f === 'bullet') insertAt('• ');
      else if (f === 'check') insertAt('○ ');
      else if (f === 'indent') insertAt('    ');
      else if (f === 'outdent') { const m = ta.value.slice(ls).match(/^( {1,4}|\t)/); if (m) ta.setRangeText('', ls, ls + m[0].length, 'end'); }
      else if (f === 'top') { ta.setSelectionRange(0, 0); ta.scrollTop = 0; }
      else if (f === 'bottom') { ta.setSelectionRange(ta.value.length, ta.value.length); ta.scrollTop = ta.scrollHeight; }
      save();
    });
  });
  renderList();
  window.__notesReset = () => { renderList(); showScreen('list'); };
}

/* ---------------- PLIKI ---------------- */
function initFiles() {
  const browseBody = $z('files-browse-body');
  const listPane = $z('files-pane-list');
  const browsePane = $z('files-pane-browse');
  if (!browseBody || !listPane) return;

  const I = {
    cloud: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 9.5 4 4 0 0 1 17.5 18z"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2.5" width="10" height="19" rx="2.4"/><line x1="11" y1="18.5" x2="13" y2="18.5"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6"/></svg>',
    folder: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h3.6c.6 0 1.2.3 1.6.8L12 6.3h6.5A2.5 2.5 0 0 1 21 8.8v8.7a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/></svg>',
    img: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 15l-5-5L5 20"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>',
    chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
    box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/></svg>'
  };
  const f = (name, kind, meta) => ({ name, kind, meta });
  const locations = [
    { id: 'cloud', name: 'ZeniChmura', icon: I.cloud, items: [
      { name: 'Dokumenty', kind: 'folder', meta: '2 elementy', items: [f('Plan_ZeniOS.docx', 'doc', '48 KB'), f('Budżet.xlsx', 'doc', '22 KB')] },
      { name: 'Zdjęcia', kind: 'folder', meta: 'Pusty', items: [] },
      { name: 'Pobrane', kind: 'folder', meta: '1 element', items: [f('Instrukcja.pdf', 'doc', '1,2 MB')] }
    ] },
    { id: 'phone', name: 'Na moim ZeniOS', icon: I.phone, items: [
      { name: 'Icons', kind: 'folder', meta: '9 elementów', items: ['Messages_icon', 'calculator_icon', 'calendar_icon', 'clock_icons', 'files_icons', 'Phone_Icon', 'Settings_Icon', 'gallery_icon'].map((n) => f(n + '.png', 'img', 'PNG')) },
      { name: 'default_wallpapers', kind: 'folder', meta: '7 elementów', items: [1, 2, 3, 4, 5, 6, 7].map((n) => f(`default_wallpaper_${n}.jpg`, 'img', 'JPG')) },
      { name: 'Boot_Loading', kind: 'folder', meta: '1 element', items: [f('Zenios_loading.png', 'img', 'PNG')] }
    ] },
    { id: 'trash', name: 'Ostatnio usunięte', icon: I.trash, items: [] }
  ];
  const tags = [['Czerwony', '#ff453a'], ['Pomarańczowy', '#ff9f0a'], ['Żółty', '#ffd60a'], ['Zielony', '#30d158'], ['Niebieski', '#0a84ff'], ['Fioletowy', '#bf5af2'], ['Szary', '#8e8e93']];
  const recents = [f('Plan_ZeniOS.docx', 'doc', 'Dzisiaj'), f('default_wallpaper_7.jpg', 'img', 'Dzisiaj'), f('Instrukcja.pdf', 'doc', 'Wczoraj'), f('Zenios_loading.png', 'img', 'Wczoraj')];

  let tab = 'browse';
  let stack = [];
  let fwd = [];
  const collapsed = { loc: false, tags: false };

  const rowHtml = (ico, name, meta, chev) =>
    `<div class="f-ico">${ico}</div><div class="f-name">${name}${meta ? `<span class="f-meta">${meta}</span>` : ''}</div>${chev ? '<span class="f-chev">›</span>' : ''}`;
  const iconFor = (it) => (it.kind === 'folder' ? I.folder : it.kind === 'img' ? I.img : I.doc);
  const emptyHtml = (txt) => `<div class="files-empty">${I.box}<div>${txt}</div></div>`;

  const renderBrowse = () => {
    const q = ($z('files-search')?.value || '').trim().toLowerCase();
    browseBody.innerHTML = '';
    const sec = (key, title, build) => {
      const head = document.createElement('div');
      head.className = 'files-sec-head' + (collapsed[key] ? ' collapsed' : '');
      head.innerHTML = `<span>${title}</span>${I.chev}`;
      const card = document.createElement('div');
      card.className = 'files-card' + (collapsed[key] ? ' hidden' : '');
      head.addEventListener('click', () => { collapsed[key] = !collapsed[key]; head.classList.toggle('collapsed'); card.classList.toggle('hidden'); });
      build(card);
      if (card.children.length) browseBody.append(head, card);
    };
    sec('loc', 'Lokalizacje', (card) => {
      locations.filter((l) => !q || l.name.toLowerCase().includes(q)).forEach((l) => {
        const r = document.createElement('div');
        r.className = 'files-row';
        r.innerHTML = rowHtml(l.icon, l.name, '', false);
        r.addEventListener('click', () => pushFolder({ title: l.name, items: l.items }));
        card.appendChild(r);
      });
    });
    sec('tags', 'Znaczniki', (card) => {
      tags.filter(([n]) => !q || n.toLowerCase().includes(q)).forEach(([n, c]) => {
        const r = document.createElement('div');
        r.className = 'files-row';
        r.innerHTML = rowHtml(`<span class="tag-dot" style="background:${c}"></span>`, n, '', false);
        r.addEventListener('click', () => pushFolder({ title: n, items: [] }));
        card.appendChild(r);
      });
    });
    if (!browseBody.children.length) browseBody.innerHTML = emptyHtml('Brak wyników');
  };

  const renderList = (title, items, searchable) => {
    listPane.innerHTML = `<h1 class="files-title">${title}</h1>` +
      (searchable ? `<div class="search-field files-search"><svg class="search-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input id="files-list-search" type="search" placeholder="Szukaj" autocomplete="off"/></div>` : '') +
      '<div id="files-rows"></div>';
    const rows = listPane.querySelector('#files-rows');
    const fill = (q) => {
      rows.innerHTML = '';
      const arr = items.filter((it) => !q || it.name.toLowerCase().includes(q));
      if (!arr.length) { rows.innerHTML = emptyHtml(items.length ? 'Brak wyników' : 'Brak plików'); return; }
      const card = document.createElement('div');
      card.className = 'files-card';
      arr.forEach((it) => {
        const r = document.createElement('div');
        r.className = 'files-row';
        r.innerHTML = rowHtml(iconFor(it), it.name, it.meta || '', it.kind === 'folder');
        if (it.kind === 'folder') r.addEventListener('click', () => pushFolder({ title: it.name, items: it.items || [] }));
        else r.addEventListener('click', () => zeniToast(`${it.name} — podgląd niedostępny`));
        card.appendChild(r);
      });
      rows.appendChild(card);
    };
    fill('');
    listPane.querySelector('#files-list-search')?.addEventListener('input', (e) => fill(e.target.value.trim().toLowerCase()));
  };

  const sync = () => {
    document.querySelectorAll('[data-files-tab]').forEach((b) => b.classList.toggle('active', b.getAttribute('data-files-tab') === tab));
    const showBrowse = tab === 'browse' && !stack.length;
    browsePane.classList.toggle('active', showBrowse);
    listPane.classList.toggle('active', !showBrowse);
    if (showBrowse) renderBrowse();
    else if (tab === 'recents') renderList('Ostatnie', recents, true);
    else if (tab === 'shared') renderList('Udostępnione', [], false);
    else { const top = stack[stack.length - 1]; renderList(top.title, top.items, true); }
    $z('files-back').disabled = !(tab === 'browse' && stack.length);
    $z('files-fwd').disabled = !(tab === 'browse' && fwd.length);
    $z('files-scroll').scrollTop = 0;
  };
  const pushFolder = (entry) => { stack.push(entry); fwd = []; sync(); };

  $z('files-back').addEventListener('click', () => { if (stack.length) { fwd.push(stack.pop()); sync(); } });
  $z('files-fwd').addEventListener('click', () => { if (fwd.length) { stack.push(fwd.pop()); sync(); } });
  $z('files-more').addEventListener('click', () => zeniToast('Pliki ZeniOS 2.0'));
  document.querySelectorAll('[data-files-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.getAttribute('data-files-tab'); sync(); }));
  $z('files-search').addEventListener('input', renderBrowse);
  sync();
}

/* ---------------- KALENDARZ ---------------- */
function initCalendar() {
  const monthsEl = $z('cal-months');
  if (!monthsEl) return;
  const app = $z('app-calendar');
  const today = new Date();
  let viewYear = today.getFullYear();
  let selected = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const key = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

  const cals = [
    { id: 'work', name: 'Praca', color: '#af52de', on: true },
    { id: 'school', name: 'Szkoła', color: '#ff2d55', on: true },
    { id: 'home', name: 'Dom', color: '#0a84ff', on: true },
    { id: 'main', name: 'Kalendarz', color: '#34c759', on: true },
    { id: 'holiday', name: 'Wakacje', color: '#ffcc00', on: true }
  ];
  let evId = 1;
  const events = [
    { id: evId++, title: 'Przegląd interfejsu ZeniOS', date: key(today), time: '18:00', cal: 'main' },
    { id: evId++, title: 'Spotkanie projektowe', date: key(addDays(today, 1)), time: '10:30', cal: 'work' },
    { id: evId++, title: 'Obiad z rodziną', date: key(addDays(today, 3)), time: '14:00', cal: 'home' },
    { id: evId++, title: 'Sprawdzian z matematyki', date: key(addDays(today, 5)), time: '08:15', cal: 'school' },
    { id: evId++, title: 'Wyjazd nad morze', date: key(addDays(today, 12)), time: '07:00', cal: 'holiday' },
    { id: evId++, title: 'Dentysta', date: key(addDays(today, -4)), time: '16:30', cal: 'home' }
  ];
  const calOf = (id) => cals.find((c) => c.id === id);
  const eventsOn = (k) => events.filter((e) => e.date === k && calOf(e.cal)?.on).sort((a, b) => a.time.localeCompare(b.time));
  zenTodayEvents = () => eventsOn(key(today));

  const monthBlock = (y, m) => {
    const wrap = document.createElement('div');
    wrap.className = 'cal-month';
    wrap.setAttribute('data-m', m);
    const isCur = y === today.getFullYear() && m === today.getMonth();
    wrap.innerHTML = `<div class="cal-month-name${isCur ? ' current' : ''}">${PL_MONTHS_SHORT[m]}</div>`;
    const grid = document.createElement('div');
    grid.className = 'cal-grid';
    const offset = (new Date(y, m, 1).getDay() + 6) % 7;
    const days = new Date(y, m + 1, 0).getDate();
    for (let i = 0; i < offset; i++) { const c = document.createElement('div'); c.className = 'cal-cell empty'; grid.appendChild(c); }
    for (let d = 1; d <= days; d++) {
      const dt = new Date(y, m, d);
      const col = (offset + d - 1) % 7;
      const k = key(dt);
      const cell = document.createElement('div');
      cell.className = 'cal-cell' + (col >= 5 ? ' weekend' : '') + (k === key(today) ? ' today' : '') + (k === key(selected) ? ' selected' : '');
      cell.setAttribute('data-date', k);
      const has = eventsOn(k).length > 0;
      cell.innerHTML = `<div class="cal-num">${d}</div><div class="cal-dots">${has ? '<i style="background:var(--sub)"></i>' : ''}</div>`;
      cell.addEventListener('click', () => { selected = dt; refreshSelection(); renderDay(); });
      grid.appendChild(cell);
    }
    wrap.appendChild(grid);
    return wrap;
  };
  const renderMonths = () => {
    monthsEl.innerHTML = '';
    for (let m = 0; m < 12; m++) monthsEl.appendChild(monthBlock(viewYear, m));
    $z('cal-year-label').textContent = viewYear;
  };
  const refreshSelection = () => {
    monthsEl.querySelectorAll('.cal-cell[data-date]').forEach((c) => c.classList.toggle('selected', c.getAttribute('data-date') === key(selected)));
  };
  const renderDay = () => {
    const panel = $z('cal-day-panel');
    const list = eventsOn(key(selected));
    let html = `<div class="cal-day-title">${PL_DAYS[selected.getDay()]}, ${selected.getDate()} ${PL_MONTHS_GEN[selected.getMonth()]}</div>`;
    if (!list.length) html += '<div class="cal-none">Brak wydarzeń</div>';
    list.forEach((e) => {
      const c = calOf(e.cal);
      html += `<div class="cal-event"><div class="cal-event-bar" style="background:${c.color}"></div><div><div class="cal-event-t">${e.title.replace(/</g, '&lt;')}</div><div class="cal-event-s">${e.time} · ${c.name}</div></div><button class="cal-event-del" data-del="${e.id}">Usuń</button></div>`;
    });
    panel.innerHTML = html;
    panel.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
      const i = events.findIndex((x) => x.id === Number(b.getAttribute('data-del')));
      if (i >= 0) events.splice(i, 1);
      renderMonths(); renderDay(); renderWidgets();
    }));
  };
  const scrollToMonth = (m, smooth = false) => {
    const target = monthsEl.querySelector(`.cal-month[data-m="${m}"]`);
    if (!target) return;
    monthsEl.style.scrollBehavior = smooth ? 'smooth' : 'auto';
    monthsEl.scrollTop = target.offsetTop - monthsEl.offsetTop;
  };
  const renderYear = () => {
    const yv = $z('cal-year-view');
    let html = `<div class="year-title" style="display:flex;justify-content:space-between;align-items:center"><span>${viewYear}</span><span style="font-size:22px;font-weight:500"><button id="cal-prev-year" style="background:none;border:none;color:inherit;font-size:26px;cursor:pointer;padding:0 8px">‹</button><button id="cal-next-year" style="background:none;border:none;color:inherit;font-size:26px;cursor:pointer;padding:0 8px">›</button></span></div><div class="year-grid">`;
    for (let m = 0; m < 12; m++) {
      const offset = (new Date(viewYear, m, 1).getDay() + 6) % 7;
      const days = new Date(viewYear, m + 1, 0).getDate();
      const isCur = viewYear === today.getFullYear() && m === today.getMonth();
      let cells = '<span></span>'.repeat(offset);
      for (let d = 1; d <= days; d++) cells += `<span${isCur && d === today.getDate() ? ' class="today"' : ''}>${d}</span>`;
      html += `<div class="mini-month${isCur ? ' current' : ''}" data-mm="${m}"><h4>${PL_MONTHS_SHORT[m]}</h4><div class="mini-days">${cells}</div></div>`;
    }
    yv.innerHTML = html + '</div>';
    yv.querySelectorAll('[data-mm]').forEach((el) => el.addEventListener('click', () => { setMode('month'); renderMonths(); scrollToMonth(Number(el.getAttribute('data-mm'))); }));
    $z('cal-prev-year').addEventListener('click', (e) => { e.stopPropagation(); viewYear--; renderYear(); });
    $z('cal-next-year').addEventListener('click', (e) => { e.stopPropagation(); viewYear++; renderYear(); });
  };
  const setMode = (mode) => { app.classList.toggle('cal-mode-year', mode === 'year'); if (mode === 'year') renderYear(); };

  /* arkusze */
  const openSheet = (id, scrimId = 'cal-scrim') => { $z(id).classList.add('open'); $z(scrimId).classList.add('open'); };
  const closeSheets = () => { app.querySelectorAll('.sheet').forEach((s) => s.classList.remove('open')); $z('cal-scrim').classList.remove('open'); };
  app.querySelectorAll('[data-close-sheet]').forEach((b) => b.addEventListener('click', closeSheets));
  $z('cal-scrim').addEventListener('click', closeSheets);

  const renderCals = () => {
    const el = $z('cal-cals-list');
    el.innerHTML = '<div class="sheet-sec">ZeniOS</div>';
    cals.forEach((c) => {
      const r = document.createElement('div');
      r.className = 'cal-list-row';
      r.innerHTML = `<span class="cal-check" style="border-color:${c.color};background:${c.on ? c.color : 'transparent'}">${c.on ? '✓' : ''}</span><span>${c.name}</span>`;
      r.addEventListener('click', () => { c.on = !c.on; renderCals(); renderMonths(); renderDay(); });
      el.appendChild(r);
    });
  };
  const renderUpcoming = () => {
    const q = ($z('cal-upcoming-search').value || '').trim().toLowerCase();
    const startK = key(today);
    const list = events.filter((e) => e.date >= startK && calOf(e.cal)?.on && (!q || e.title.toLowerCase().includes(q))).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const el = $z('cal-upcoming-list');
    el.innerHTML = list.length ? '' : '<div class="cal-none" style="padding:20px">Brak nadchodzących wydarzeń</div>';
    list.forEach((e) => {
      const [y, m, d] = e.date.split('-').map(Number);
      const c = calOf(e.cal);
      const row = document.createElement('div');
      row.className = 'upcoming-row';
      row.innerHTML = `<div class="cal-event-bar" style="background:${c.color}"></div><div><div class="cal-event-t">${e.title.replace(/</g, '&lt;')}</div><div class="cal-event-s">${d} ${PL_MONTHS_GEN[m - 1]} ${y}, ${e.time} · ${c.name}</div></div>`;
      el.appendChild(row);
    });
  };
  $z('cal-cals-btn').addEventListener('click', () => { renderCals(); openSheet('cal-sheet-cals'); });
  $z('cal-upcoming-btn').addEventListener('click', () => { $z('cal-upcoming-search').value = ''; renderUpcoming(); openSheet('cal-sheet-upcoming'); });
  $z('cal-search-btn').addEventListener('click', () => { $z('cal-upcoming-btn').click(); setTimeout(() => $z('cal-upcoming-search').focus(), 350); });
  $z('cal-upcoming-search').addEventListener('input', renderUpcoming);
  $z('cal-add-btn').addEventListener('click', () => {
    $z('cal-ev-title').value = '';
    $z('cal-ev-date').value = key(selected);
    $z('cal-ev-cal').innerHTML = cals.map((c) => `<option value="${c.id}">${c.name}</option>`).join('');
    openSheet('cal-sheet-add');
  });
  $z('cal-save-event').addEventListener('click', () => {
    const title = $z('cal-ev-title').value.trim() || 'Nowe wydarzenie';
    const date = $z('cal-ev-date').value || key(selected);
    events.push({ id: evId++, title, date, time: $z('cal-ev-time').value || '12:00', cal: $z('cal-ev-cal').value });
    const [y, m, d] = date.split('-').map(Number);
    selected = new Date(y, m - 1, d);
    viewYear = y;
    closeSheets(); renderMonths(); renderDay(); renderWidgets();
  });
  $z('cal-year-btn').addEventListener('click', () => setMode('year'));
  $z('cal-today-btn').addEventListener('click', () => {
    setMode('month');
    viewYear = today.getFullYear();
    selected = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    renderMonths(); renderDay(); scrollToMonth(today.getMonth(), true);
  });
  renderMonths(); renderDay(); renderWidgets();
  window.__calOpen = () => { setMode('month'); closeSheets(); viewYear = today.getFullYear(); renderMonths(); renderDay(); scrollToMonth(today.getMonth()); };
}

/* ---------------- ZEGAR ---------------- */
function initClock() {
  const app = $z('app-clock');
  if (!app) return;
  const ROW = 44;
  const REPEATS = ['Nigdy', 'Codziennie', 'dni robocze', 'weekendy'];
  const SOUNDS = ['Kręgi', 'Radar', 'Fala', 'Latarnia'];
  let alarms = [
    { id: 1, h: 7, m: 0, label: 'Alarm', on: false, repeat: 'Nigdy', sound: 'Kręgi', snooze: true },
    { id: 2, h: 8, m: 29, label: 'Alarm', on: false, repeat: 'Nigdy', sound: 'Kręgi', snooze: true },
    { id: 3, h: 13, m: 29, label: 'Alarm', on: false, repeat: 'Nigdy', sound: 'Kręgi', snooze: true },
    { id: 4, h: 15, m: 5, label: 'Alarm', on: false, repeat: 'Nigdy', sound: 'Kręgi', snooze: true }
  ];
  let nextAlarmId = 5;
  let editingList = false;
  let editId = null;
  let draft = null;
  let lastFiredKey = '';
  let activeTab = 'alarms';

  /* koła wyboru */
  const buildWheel = (container, specs) => {
    container.innerHTML = '';
    return specs.map(([count, unit]) => {
      const col = document.createElement('div');
      col.className = 'wheel-col';
      for (let i = 0; i < count; i++) {
        const d = document.createElement('div');
        d.textContent = unit ? `${i} ${unit}` : pad2(i);
        col.appendChild(d);
      }
      container.appendChild(col);
      return col;
    });
  };
  const setWheel = (col, v) => { col.scrollTop = v * ROW; };
  const getWheel = (col) => Math.max(0, Math.min(col.children.length - 1, Math.round(col.scrollTop / ROW)));

  const alarmWheels = buildWheel($z('alarm-wheels'), [[24], [60]]);
  const timerWheels = buildWheel($z('timer-wheels'), [[24, 'godz.'], [60, 'min'], [60, 's']]);
  setTimeout(() => { setWheel(timerWheels[1], 5); }, 0);

  /* zakładki */
  const showTab = (tab) => {
    activeTab = tab;
    app.querySelectorAll('.clock-pane').forEach((p) => p.classList.toggle('active', p.id === `clock-pane-${tab}`));
    app.querySelectorAll('[data-clock-tab]').forEach((b) => b.classList.toggle('active', b.getAttribute('data-clock-tab') === tab));
    if (tab === 'world') renderWorld();
    if (tab === 'timer' && !timerRunning) requestAnimationFrame(() => { if (!timerSecsSet) { setWheel(timerWheels[1], 5); timerSecsSet = true; } });
  };
  let timerSecsSet = false;
  app.querySelectorAll('[data-clock-tab]').forEach((b) => b.addEventListener('click', () => showTab(b.getAttribute('data-clock-tab'))));

  /* zegary światowe */
  const zones = [['Warszawa', 'Europe/Warsaw'], ['Londyn', 'Europe/London'], ['Nowy Jork', 'America/New_York'], ['Los Angeles', 'America/Los_Angeles'], ['Tokio', 'Asia/Tokyo'], ['Sydney', 'Australia/Sydney']];
  const renderWorld = () => {
    const now = new Date();
    const local = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Warsaw' }));
    $z('world-list').innerHTML = zones.map(([name, tz]) => {
      const zd = new Date(now.toLocaleString('en-US', { timeZone: tz }));
      const diff = Math.round((zd - local) / 1800000) / 2;
      const dayDiff = zd.getDate() === local.getDate() ? 0 : zd > local ? 1 : -1;
      const when = `${dayDiff === 0 ? 'Dzisiaj' : dayDiff > 0 ? 'Jutro' : 'Wczoraj'}, ${diff >= 0 ? '+' : ''}${String(diff).replace('.', ',')} godz.`;
      return `<div class="world-item"><div><div class="when">${when}</div><div class="city">${name}</div></div><div class="time">${pad2(zd.getHours())}:${pad2(zd.getMinutes())}</div></div>`;
    }).join('');
  };

  /* alarmy */
  const repeatLabel = (a) => (a.repeat === 'Nigdy' ? '' : `, ${a.repeat}`);
  const renderAlarms = () => {
    const el = $z('alarm-list');
    const sorted = [...alarms].sort((x, y) => x.h * 60 + x.m - (y.h * 60 + y.m));
    el.innerHTML = sorted.length ? '' : '<div class="clock-empty">Brak alarmów</div>';
    sorted.forEach((a) => {
      const row = document.createElement('div');
      row.className = 'alarm-item' + (a.on ? '' : ' off');
      row.innerHTML = `<button class="alarm-del" aria-label="Usuń">−</button><div class="alarm-mid"><div class="alarm-time">${pad2(a.h)}:${pad2(a.m)}</div><div class="alarm-label">${(a.label || 'Alarm').replace(/</g, '&lt;')}<small>${repeatLabel(a)}</small></div></div><label class="ios-switch"><input type="checkbox" ${a.on ? 'checked' : ''}/><span class="ios-slider"></span></label>`;
      row.querySelector('input').addEventListener('change', (e) => { a.on = e.target.checked; row.classList.toggle('off', !a.on); });
      row.querySelector('.ios-switch').addEventListener('click', (e) => e.stopPropagation());
      row.querySelector('.alarm-del').addEventListener('click', (e) => { e.stopPropagation(); alarms = alarms.filter((x) => x.id !== a.id); renderAlarms(); });
      row.addEventListener('click', () => openAlarmSheet(a.id));
      el.appendChild(row);
    });
  };
  const sheet = $z('alarm-sheet');
  const scrim = $z('alarm-scrim');
  const closeAlarmSheet = () => { sheet.classList.remove('open'); scrim.classList.remove('open'); };
  const refreshDraftUi = () => {
    $z('alarm-repeat-val').textContent = `${draft.repeat} ›`;
    $z('alarm-sound-val').textContent = `${draft.sound} ›`;
  };
  const openAlarmSheet = (id) => {
    editId = id;
    const src = id ? alarms.find((a) => a.id === id) : null;
    const nowD = new Date();
    draft = src ? { ...src } : { h: nowD.getHours(), m: nowD.getMinutes(), label: 'Alarm', on: true, repeat: 'dni robocze', sound: 'Kręgi', snooze: true };
    $z('alarm-sheet-title').textContent = id ? 'Edytuj alarm' : 'Dodaj alarm';
    $z('alarm-label-input').value = draft.label === 'Alarm' ? '' : draft.label;
    $z('alarm-snooze-input').checked = draft.snooze;
    refreshDraftUi();
    sheet.classList.add('open');
    scrim.classList.add('open');
    setTimeout(() => { setWheel(alarmWheels[0], draft.h); setWheel(alarmWheels[1], draft.m); }, 50);
  };
  
  /* reszta kodu zegara (stoper, minutnik itp.) - dokończenie funkcji */
  const saveAlarm = () => {
    draft.h = getWheel(alarmWheels[0]);
    draft.m = getWheel(alarmWheels[1]);
    draft.label = $z('alarm-label-input').value.trim() || 'Alarm';
    draft.snooze = $z('alarm-snooze-input').checked;
    if (editId) {
      const i = alarms.findIndex((a) => a.id === editId);
      if (i >= 0) alarms[i] = { ...draft, id: editId };
    } else {
      alarms.push({ ...draft, id: nextAlarmId++ });
    }
    closeAlarmSheet();
    renderAlarms();
  };

  $z('alarm-save-btn').addEventListener('click', saveAlarm);
  $z('alarm-cancel-btn').addEventListener('click', closeAlarmSheet);
  scrim.addEventListener('click', closeAlarmSheet);
  
  $z('alarm-repeat-val').parentElement.addEventListener('click', () => {
    const i = REPEATS.indexOf(draft.repeat);
    draft.repeat = REPEATS[(i + 1) % REPEATS.length];
    refreshDraftUi();
  });
  $z('alarm-sound-val').parentElement.addEventListener('click', () => {
    const i = SOUNDS.indexOf(draft.sound);
    draft.sound = SOUNDS[(i + 1) % SOUNDS.length];
    refreshDraftUi();
  });

  /* Minutnik */
  let timerRunning = false;
  let timerEnd = 0;
  let timerRemain = 0;
  let timerInt = null;
  
  const updateTimerUi = () => {
    const ms = timerRunning ? Math.max(0, timerEnd - Date.now()) : timerRemain;
    const totalSec = Math.ceil(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const el = $z('timer-display');
    if (el) el.textContent = `${h > 0 ? pad2(h) + ':' : ''}${pad2(m)}:${pad2(s)}`;
  };
  
  const startTimer = () => {
    if (timerRunning) {
      timerRunning = false;
      timerRemain = Math.max(0, timerEnd - Date.now());
      clearInterval(timerInt);
      $z('timer-start-btn').textContent = 'Wznów';
    } else {
      const h = getWheel(timerWheels[0]);
      const m = getWheel(timerWheels[1]);
      const s = getWheel(timerWheels[2]);
      let ms = (h * 3600 + m * 60 + s) * 1000;
      if (timerRemain > 0) ms = timerRemain;
      if (ms <= 0) return;
      timerRunning = true;
      timerEnd = Date.now() + ms;
      timerRemain = 0;
      $z('timer-start-btn').textContent = 'Wstrzymaj';
      timerInt = setInterval(() => {
        updateTimerUi();
        if (Date.now() >= timerEnd) {
          clearInterval(timerInt);
          timerRunning = false;
          timerRemain = 0;
          $z('timer-start-btn').textContent = 'Start';
          zeniToast('Minutnik zakończony');
        }
      }, 200);
    }
    updateTimerUi();
  };
  
  $z('timer-start-btn').addEventListener('click', startTimer);
  $z('timer-cancel-btn').addEventListener('click', () => {
    clearInterval(timerInt);
    timerRunning = false;
    timerRemain = 0;
    $z('timer-start-btn').textContent = 'Start';
    updateTimerUi();
  });

  renderAlarms();
  updateTimerUi();
}

/* ---------------- INICJALIZACJA ZENI APPS ---------------- */
function initZeniApps() {
  bindTheme();
  initCalculator();
  initNotes();
  initFiles();
  initCalendar();
  initClock();
  initControlCenter();
  initNotifications();
  bindLockscreenExtras();
}

/* ---------------- CENTRUM STEROWANIA ---------------- */
function initControlCenter() {
  const cc = $z('control-center');
  if (!cc) return;
  let startY = null;
  
  document.getElementById('status-bar-overlay')?.addEventListener('pointerdown', (e) => {
    if (e.clientX > window.innerWidth - 60) {
      startY = e.clientY;
    }
  });
  
  document.getElementById('status-bar-overlay')?.addEventListener('pointerup', (e) => {
    if (startY !== null && e.clientY - startY > 30 && e.clientX > window.innerWidth - 60) {
      ccOpen = true;
      cc.classList.add('open');
      $z('cc-scrim').classList.add('open');
    }
    startY = null;
  });

  $z('cc-scrim')?.addEventListener('click', () => {
    ccOpen = false;
    cc.classList.remove('open');
    $z('cc-scrim').classList.remove('open');
  });

  $z('cc-slider')?.addEventListener('input', (e) => {
    sysVolume = e.target.value / 100;
    $z('cc-vol-fill').style.width = e.target.value + '%';
  });
  
  $z('cc-theme')?.addEventListener('click', () => {
    setTheme(currentTheme === 'dark' ? 'light' : 'dark');
  });
  
  $z('cc-wifi')?.addEventListener('click', function() {
    this.classList.toggle('on-blue');
  });
  $z('cc-bt')?.addEventListener('click', function() {
    this.classList.toggle('on-blue');
  });
  $z('cc-airplane')?.addEventListener('click', function() {
    this.classList.toggle('on-orange');
  });
}

/* ---------------- POWIADOMIENIA ---------------- */
function initNotifications() {
  // Prosta implementacja - można rozbudować
}

/* ---------------- EKSTRY EKRANU BLOKADY ---------------- */
function bindLockscreenExtras() {
  // Obsługa dodatkowych elementów ekranu blokady
}

// Uruchomienie systemu
document.addEventListener('DOMContentLoaded', () => {
  initSystem();
});
