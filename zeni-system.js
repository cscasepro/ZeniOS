/* Rdzeń systemu ZeniOS: tapety, widżety, pulpit, szuflada aplikacji, nawigacja systemowa,
 * pasek statusu, centrum sterowania oraz aplikacje: Ustawienia, Galeria, Wiadomości,
 * Kalkulator, Kalendarz, Zegar, Pliki i Notatnik. */

(function () {
  const STORAGE_KEY = 'zenios_system_state_v1';

  const WALLPAPERS = [
    { id: 'default_wallpaper_1', label: 'default_wallpaper_1', src: 'Default_Wallpaper/default_wallpaper_1.jpg' },
    { id: 'default_wallpaper_2', label: 'default_wallpaper_2', src: 'Default_Wallpaper/default_wallpaper_2.jpg' },
    { id: 'default_wallpaper_3', label: 'default_wallpaper_3', src: 'Default_Wallpaper/default_wallpaper_3.jpg' },
    { id: 'default_wallpaper_4', label: 'default_wallpaper_4', src: 'Default_Wallpaper/default_wallpaper_4.jpg' },
    { id: 'default_wallpaper_5', label: 'default_wallpaper_5', src: 'Default_Wallpaper/default_wallpaper_5.jpg' },
    { id: 'default_wallpaper_6', label: 'default_wallpaper_6', src: 'Default_Wallpaper/default_wallpaper_6.jpg' },
    { id: 'default_wallpaper_7', label: 'default_wallpaper_7', src: 'Default_Wallpaper/default_wallpaper_7.jpg' }
  ];

  const INSTALLED_APPS = [
    { id: 'app-phone', name: 'Telefon', icon: 'Icons/Phone_Icon.png', category: 'Komunikacja' },
    { id: 'app-settings', name: 'Ustawienia', icon: 'Icons/Settings_Icon.png', category: 'System' },
    { id: 'app-gallery', name: 'Galeria', icon: 'Icons/gallery_icon.png', category: 'Multimedia' },
    { id: 'app-messages', name: 'Wiadomości', icon: 'Icons/Phone_Icon.png', badge: '💬', category: 'Komunikacja' },
    { id: 'app-calculator', name: 'Kalkulator', icon: 'Icons/Settings_Icon.png', badge: '🧮', category: 'Narzędzia' },
    { id: 'app-calendar', name: 'Kalendarz', icon: 'Icons/gallery_icon.png', badge: '📅', category: 'Produktywność' },
    { id: 'app-clock', name: 'Zegar', icon: 'Icons/Settings_Icon.png', badge: '⏰', category: 'Narzędzia' },
    { id: 'app-files', name: 'Pliki', icon: 'Icons/gallery_icon.png', badge: '📁', category: 'Narzędzia' },
    { id: 'app-notebook', name: 'Notatnik', icon: 'Icons/gallery_icon.png', badge: '📝', category: 'Produktywność' }
  ];

  const WIDGET_CATALOG = [
    { type: 'clock', title: 'Zegar ZeniOS', desc: 'Aktualna godzina i data' },
    { type: 'weather', title: 'Pogoda', desc: 'Warunki pogodowe i temperatura' },
    { type: 'status', title: 'Stan systemu', desc: 'Bateria, sieć i tryb pracy' },
    { type: 'shortcuts', title: 'Szybkie akcje', desc: 'Skróty do aplikacji i blokady' }
  ];

  const DEFAULT_STATE = {
    wallpaper: 'Default_Wallpaper/default_wallpaper_7.jpg',
    lock: {
      method: 'swipe',
      pin: '1234',
      password: 'zenios',
      pattern: '1-2-5-8-9'
    },
    navMode: 'gestures',
    airplane: false,
    wifi: 'ZeniNet',
    bluetooth: true,
    cellular: true,
    battery: 94,
    theme: 'dark',
    rotationLock: false,
    silent: false,
    brightness: 100,
    volume: 70,
    dnd: false,
    torch: false,
    recording: false,
    playing: false,
    homeApps: ['app-messages', 'app-calculator', 'app-calendar', 'app-clock', 'app-files', 'app-notebook'],
    widgets: [
      { id: 'w-clock', type: 'clock' },
      { id: 'w-weather', type: 'weather' }
    ]
  };

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return JSON.parse(JSON.stringify(DEFAULT_STATE));
      const parsed = JSON.parse(raw);
      return {
        ...JSON.parse(JSON.stringify(DEFAULT_STATE)),
        ...parsed,
        lock: {
          ...DEFAULT_STATE.lock,
          ...(parsed.lock || {})
        },
        homeApps: Array.isArray(parsed.homeApps) && parsed.homeApps.length
          ? parsed.homeApps
          : JSON.parse(JSON.stringify(DEFAULT_STATE.homeApps)),
        widgets: Array.isArray(parsed.widgets)
          ? parsed.widgets
          : JSON.parse(JSON.stringify(DEFAULT_STATE.widgets))
      };
    } catch (_) {
      return JSON.parse(JSON.stringify(DEFAULT_STATE));
    }
  }

  let state = loadState();
  let editMode = false;
  let draggedAppId = null;
  let draggedWidgetId = null;
  const appHistoryStack = [];
  let activeAppId = null;

  const wallpaperLayer = document.getElementById('wallpaper-layer');
  const systemWallpaper = document.getElementById('system-wallpaper');
  const homeContent = document.getElementById('home-content');
  const widgetsGrid = document.getElementById('widgets-grid');
  const homeAppsGrid = document.getElementById('home-apps-grid');
  const homeEditBanner = document.getElementById('home-edit-banner');
  const openWidgetDrawerBtn = document.getElementById('open-widget-drawer-btn');
  const doneEditModeBtn = document.getElementById('done-edit-mode-btn');
  const widgetPickerSheet = document.getElementById('widget-picker-sheet');
  const widgetPickerList = document.getElementById('widget-picker-list');
  const closeWidgetDrawerBtn = document.getElementById('close-widget-drawer-btn');

  const searchDrawer = document.getElementById('app-search-drawer');
  const closeSearchDrawerBtn = document.getElementById('close-search-drawer-btn');
  const installedAppsSearch = document.getElementById('installed-apps-search');
  const installedAppsList = document.getElementById('installed-apps-list');

  const statusClock = document.getElementById('status-clock');
  const statusBattery = document.getElementById('status-battery');
  const batteryFill = document.getElementById('battery-fill');
  const batterySettingState = document.getElementById('battery-setting-state');
  const wifiStatusValue = document.getElementById('wifi-status-value');
  const btStatusValue = document.getElementById('bt-status-value');
  const airplaneToggle = document.getElementById('airplane-toggle');

  const systemNavOverlay = document.getElementById('system-nav-overlay');
  const gestureHomeBtn = document.getElementById('gesture-home-btn');
  const sysBtnBack = document.getElementById('sys-btn-back');
  const sysBtnHome = document.getElementById('sys-btn-home');
  const sysBtnRecents = document.getElementById('sys-btn-recents');

  const settingsMain = document.getElementById('settings-main');
  const settingsPasscode = document.getElementById('settings-passcode');
  const settingsWallpaper = document.getElementById('settings-wallpaper');
  const settingsSystemNav = document.getElementById('settings-system-nav');
  const settingsSearch = document.getElementById('settings-search');
  const currentWpLabel = document.getElementById('current-wp-label');
  const currentLockLabel = document.getElementById('current-lock-label');
  const currentNavLabel = document.getElementById('current-nav-label');
  const wpPreviewImg = document.getElementById('wallpaper-preview-img');
  const wpPreviewName = document.getElementById('wallpaper-preview-name');
  const wpGrid = document.getElementById('wp-grid');
  const secretEditInput = document.getElementById('secret-edit-input');
  const secretEditorLabel = document.getElementById('secret-editor-label');
  const saveSecretBtn = document.getElementById('save-secret-btn');
  const testLockNowBtn = document.getElementById('test-lock-now-btn');
  const batteryCycleRow = document.getElementById('battery-cycle-row');

  const torchGlow = document.getElementById('torch-glow');
  const dimOverlay = document.getElementById('dim-overlay');
  const ccToast = document.getElementById('cc-toast');
  const ccHotzone = document.getElementById('cc-hotzone');
  const ccLayer = document.getElementById('cc-layer');
  const ccBackdrop = document.getElementById('cc-backdrop');
  const ccPanel = document.getElementById('cc-panel');

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_) {}
  }

  function showToast(msg) {
    if (!ccToast) return;
    ccToast.textContent = msg;
    ccToast.classList.add('show');
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => ccToast.classList.remove('show'), 1600);
  }

  function applyTheme() {
    document.body.classList.toggle('light-mode', state.theme === 'light');
    document.querySelectorAll('[data-theme-set]').forEach((b) => {
      b.classList.toggle('active', b.dataset.themeSet === state.theme);
    });
    const ccTheme = document.getElementById('cc-theme');
    if (ccTheme) ccTheme.classList.toggle('on-blue', state.theme === 'light');
  }

  function applyBrightness() {
    const pct = Math.max(15, Math.min(100, Number(state.brightness) || 100));
    if (dimOverlay) {
      dimOverlay.style.opacity = String(((100 - pct) / 100) * 0.72);
    }
    const fill = document.querySelector('#cc-brightness .cc-slider-fill');
    if (fill) fill.style.height = `${pct}%`;
  }

  function applyVolume() {
    const pct = Math.max(0, Math.min(100, Number(state.volume) || 0));
    const fill = document.querySelector('#cc-volume .cc-slider-fill');
    if (fill) fill.style.height = `${pct}%`;
  }

  function syncControlCenter() {
    const airBtn = document.getElementById('cc-airplane');
    const cellBtn = document.getElementById('cc-cellular');
    const wifiBtn = document.getElementById('cc-wifi');
    const btBtn = document.getElementById('cc-bluetooth');
    const rotBtn = document.getElementById('cc-rotation');
    const silBtn = document.getElementById('cc-silent');
    const dndBtn = document.getElementById('cc-dnd');
    const dndState = document.getElementById('cc-dnd-state');
    const torchBtn = document.getElementById('cc-torch');
    const battTxt = document.getElementById('cc-batt-txt');
    const battFill = document.getElementById('cc-batt-fill');
    const recBtn = document.getElementById('cc-record');
    const playIco = document.getElementById('cc-play-ico');
    const mediaTitle = document.getElementById('cc-media-title');

    if (airBtn) airBtn.className = `cc-round${state.airplane ? ' on-orange' : ''}`;
    if (cellBtn) cellBtn.className = `cc-round${!state.airplane && state.cellular ? ' on-green' : ''}`;
    if (wifiBtn) wifiBtn.className = `cc-round${!state.airplane && state.wifi !== 'Wyłączone' ? ' on-blue' : ''}`;
    if (btBtn) btBtn.className = `cc-round${!state.airplane && state.bluetooth ? ' on-blue' : ''}`;
    if (rotBtn) rotBtn.classList.toggle('on-white', !!state.rotationLock);
    if (silBtn) silBtn.classList.toggle('on-orange', !!state.silent);
    if (dndBtn) dndBtn.classList.toggle('on-indigo', !!state.dnd);
    if (dndState) dndState.textContent = state.dnd ? 'Wł.' : 'Wył.';
    if (torchBtn) torchBtn.classList.toggle('on-white', !!state.torch);
    if (battTxt) battTxt.textContent = `${state.battery}%`;
    if (battFill) battFill.setAttribute('width', String(Math.max(1, (state.battery / 100) * 13.5)));
    if (recBtn) recBtn.classList.toggle('on-red', !!state.recording);
    if (playIco) {
      playIco.innerHTML = state.playing
        ? '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>'
        : '<path d="M7 4.5v15l13-7.5z"/>';
    }
    if (mediaTitle) mediaTitle.textContent = state.playing ? 'ZeniOS — Nocny lot' : 'Nie odtwarza';
  }

  let ccOpen = false;
  function setCcOpen(open) {
    ccOpen = !!open;
    if (!ccLayer || !ccPanel) return;
    ccLayer.classList.toggle('open', ccOpen);
    ccLayer.setAttribute('aria-hidden', ccOpen ? 'false' : 'true');
    if (!ccOpen) {
      ccPanel.style.transform = '';
      if (ccBackdrop) ccBackdrop.style.opacity = '';
    } else {
      syncControlCenter();
      applyBrightness();
      applyVolume();
    }
  }

  let ccStartY = null, ccDragging = false, ccMode = null;
  function ccPointerDown(e) {
    if (ccOpen) return;
    if (e.clientY > 44) return;
    ccStartY = e.clientY;
    ccDragging = true;
    ccMode = 'open';
  }
  function ccPointerMove(e) {
    if (!ccDragging) return;
    if (ccMode === 'open') {
      const dy = Math.max(0, e.clientY - ccStartY);
      if (dy > 12) {
        if (!ccLayer.classList.contains('peeking')) {
          ccLayer.classList.add('peeking');
          syncControlCenter();
          applyBrightness();
          applyVolume();
        }
        const h = ccPanel.offsetHeight || 520;
        const p = Math.min(1, dy / Math.min(260, h * 0.6));
        ccPanel.style.transform = `translateY(${(1 - p) * 100}%)`;
        if (ccBackdrop) ccBackdrop.style.opacity = String(p);
      }
    } else if (ccMode === 'close') {
      const dy = Math.max(0, e.clientY - ccStartY);
      if (dy > 10) {
        ccPanel.style.transition = 'none';
        ccPanel.style.transform = `translateY(${dy}px)`;
      }
    }
  }
  function ccPointerUp(e) {
    if (!ccDragging) return;
    ccDragging = false;
    const dy = e.clientY - ccStartY;
    if (ccMode === 'open') {
      ccLayer.classList.remove('peeking');
      ccPanel.style.transform = '';
      if (ccBackdrop) ccBackdrop.style.opacity = '';
      if (dy > 55) setCcOpen(true);
    } else if (ccMode === 'close') {
      ccPanel.style.transition = '';
      ccPanel.style.transform = '';
      if (dy > 70) setCcOpen(false);
    }
    ccMode = null;
  }
  if (ccHotzone) ccHotzone.addEventListener('pointerdown', ccPointerDown);
  window.addEventListener('pointermove', ccPointerMove);
  window.addEventListener('pointerup', ccPointerUp);
  window.addEventListener('pointercancel', ccPointerUp);
  if (ccPanel) {
    ccPanel.addEventListener('pointerdown', (e) => {
      if (!ccOpen) return;
      if (e.target.closest('button, .cc-slider')) return;
      ccStartY = e.clientY;
      ccDragging = true;
      ccMode = 'close';
    });
  }
  if (ccBackdrop) ccBackdrop.addEventListener('click', () => setCcOpen(false));

  function bindVerticalSlider(el, onChange) {
    if (!el) return;
    let active = false;
    const updateFromEvent = (e) => {
      const rect = el.getBoundingClientRect();
      const ratio = 1 - (e.clientY - rect.top) / Math.max(1, rect.height);
      const pct = Math.max(0, Math.min(100, Math.round(ratio * 100)));
      onChange(pct);
    };
    el.addEventListener('pointerdown', (e) => {
      active = true;
      el.setPointerCapture?.(e.pointerId);
      updateFromEvent(e);
    });
    el.addEventListener('pointermove', (e) => { if (active) updateFromEvent(e); });
    el.addEventListener('pointerup', () => { active = false; });
    el.addEventListener('pointercancel', () => { active = false; });
  }
  bindVerticalSlider(document.getElementById('cc-brightness'), (pct) => {
    state.brightness = pct;
    applyBrightness();
    saveState();
  });
  bindVerticalSlider(document.getElementById('cc-volume'), (pct) => {
    state.volume = pct;
    applyVolume();
    saveState();
  });

  document.getElementById('cc-airplane')?.addEventListener('click', () => {
    state.airplane = !state.airplane;
    if (airplaneToggle) airplaneToggle.checked = state.airplane;
    updateStatusBar();
    updateSettingsLabels();
    syncControlCenter();
    saveState();
    showToast(state.airplane ? 'Tryb samolotowy włączony' : 'Tryb samolotowy wyłączony');
  });
  document.getElementById('cc-cellular')?.addEventListener('click', () => {
    if (state.airplane) { showToast('Wyłącz tryb samolotowy'); return; }
    state.cellular = !state.cellular;
    updateStatusBar();
    syncControlCenter();
    saveState();
    showToast(state.cellular ? 'Dane komórkowe włączone' : 'Dane komórkowe wyłączone');
  });
  document.getElementById('cc-wifi')?.addEventListener('click', () => {
    if (state.airplane) { showToast('Wyłącz tryb samolotowy'); return; }
    state.wifi = state.wifi === 'Wyłączone' ? 'ZeniNet' : 'Wyłączone';
    updateStatusBar();
    updateSettingsLabels();
    syncControlCenter();
    saveState();
    showToast(state.wifi === 'Wyłączone' ? 'Wi-Fi wyłączone' : `Połączono: ${state.wifi}`);
  });
  document.getElementById('cc-bluetooth')?.addEventListener('click', () => {
    if (state.airplane) { showToast('Wyłącz tryb samolotowy'); return; }
    state.bluetooth = !state.bluetooth;
    updateSettingsLabels();
    syncControlCenter();
    saveState();
    showToast(state.bluetooth ? 'Bluetooth włączony' : 'Bluetooth wyłączony');
  });
  document.getElementById('cc-rotation')?.addEventListener('click', () => {
    state.rotationLock = !state.rotationLock;
    syncControlCenter();
    saveState();
    showToast(state.rotationLock ? 'Blokada orientacji włączona' : 'Blokada orientacji wyłączona');
  });
  document.getElementById('cc-silent')?.addEventListener('click', () => {
    state.silent = !state.silent;
    syncControlCenter();
    saveState();
    showToast(state.silent ? 'Tryb cichy włączony' : 'Dźwięk włączony');
  });
  document.getElementById('cc-dnd')?.addEventListener('click', () => {
    state.dnd = !state.dnd;
    syncControlCenter();
    saveState();
    showToast(state.dnd ? 'Nie przeszkadzać: włączone' : 'Nie przeszkadzać: wyłączone');
  });
  document.getElementById('cc-torch')?.addEventListener('click', () => {
    toggleTorch(!state.torch);
    syncControlCenter();
    showToast(state.torch ? 'Latarka włączona' : 'Latarka wyłączona');
  });
  document.getElementById('cc-theme')?.addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme();
    saveState();
    showToast(state.theme === 'light' ? 'Motyw jasny' : 'Motyw ciemny');
  });
  document.getElementById('cc-alarm')?.addEventListener('click', () => { setCcOpen(false); openApp('app-clock'); });
  document.getElementById('cc-calc')?.addEventListener('click', () => { setCcOpen(false); openApp('app-calculator'); });
  document.getElementById('cc-notes')?.addEventListener('click', () => { setCcOpen(false); openApp('app-notebook'); });
  document.getElementById('cc-battery')?.addEventListener('click', () => {
    cycleBattery();
    syncControlCenter();
    showToast(`Bateria: ${state.battery}%`);
  });
  document.getElementById('cc-record')?.addEventListener('click', () => {
    state.recording = !state.recording;
    syncControlCenter();
    saveState();
    showToast(state.recording ? 'Nagrywanie ekranu rozpoczęte' : 'Nagrywanie ekranu zatrzymane');
  });
  document.getElementById('cc-camera')?.addEventListener('click', () => {
    setCcOpen(false);
    openApp('app-gallery');
  });
  document.getElementById('cc-play')?.addEventListener('click', () => {
    state.playing = !state.playing;
    syncControlCenter();
    saveState();
  });

  function updateStatusBar() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    if (statusClock) statusClock.textContent = `${hh}:${mm}`;

    const lvl = Math.max(0, Math.min(100, Number(state.battery) || 0));
    if (statusBattery) {
      statusBattery.dataset.level = String(lvl);
      statusBattery.setAttribute('aria-label', `Bateria ${lvl}%`);
      statusBattery.querySelectorAll('.battery-pct').forEach((el) => {
        el.textContent = String(lvl);
      });
    }
    if (batteryFill) {
      batteryFill.style.width = `${lvl}%`;
    }
    if (batterySettingState) {
      batterySettingState.textContent = `${lvl}%`;
    }

    document.body.classList.toggle('is-airplane', !!state.airplane);
    document.body.classList.toggle('no-wifi', !state.airplane && state.wifi === 'Wyłączone');
    document.body.classList.toggle('no-cellular', !state.airplane && !state.cellular);
  }

  function applyWallpaper() {
    const wpSrc = state.wallpaper || 'Default_Wallpaper/default_wallpaper_7.jpg';
    if (systemWallpaper) systemWallpaper.src = wpSrc;
    if (wpPreviewImg) wpPreviewImg.src = wpSrc;
    const found = WALLPAPERS.find((w) => w.src === wpSrc);
    const label = found ? found.label : wpSrc.split('/').pop();
    if (currentWpLabel) currentWpLabel.textContent = label;
    if (wpPreviewName) wpPreviewName.textContent = label;
    if (window.ZeniLockscreen && typeof window.ZeniLockscreen.refresh === 'function') {
      window.ZeniLockscreen.refresh();
    }
  }

  function applyNavMode() {
    if (!systemNavOverlay) return;
    systemNavOverlay.classList.remove('mode-gestures', 'mode-buttons');
    systemNavOverlay.classList.add(state.navMode === 'buttons' ? 'mode-buttons' : 'mode-gestures');
    if (currentNavLabel) {
      currentNavLabel.textContent = state.navMode === 'buttons' ? 'Przyciski' : 'Gesty';
    }
    document.querySelectorAll('#nav-mode-options .selectable-option').forEach((row) => {
      row.classList.toggle('active', row.dataset.navMode === state.navMode);
    });
  }

  function getLockLabel(method) {
    if (method === 'pin') return 'PIN';
    if (method === 'password') return 'Hasło';
    if (method === 'pattern') return 'Wzór';
    return 'Przeciągnięcie';
  }

  function updateSecretEditorUI() {
    const method = state.lock.method;
    if (!secretEditorLabel || !secretEditInput) return;
    if (method === 'pin') {
      secretEditorLabel.textContent = 'Kod PIN (4 cyfry)';
      secretEditInput.value = state.lock.pin;
      secretEditInput.placeholder = 'Np. 1234';
    } else if (method === 'password') {
      secretEditorLabel.textContent = 'Hasło tekstowe';
      secretEditInput.value = state.lock.password;
      secretEditInput.placeholder = 'Wpisz hasło';
    } else if (method === 'pattern') {
      secretEditorLabel.textContent = 'Wzór (punkty 1–9 oddzielone myślnikiem)';
      secretEditInput.value = state.lock.pattern;
      secretEditInput.placeholder = 'Np. 1-2-5-8-9';
    } else {
      secretEditorLabel.textContent = 'Odblokowanie przeciągnięciem (brak dodatkowego kodu)';
      secretEditInput.value = '';
      secretEditInput.placeholder = 'Nie wymagane dla przeciągnięcia';
    }
  }

  function updateSettingsLabels() {
    if (currentLockLabel) currentLockLabel.textContent = getLockLabel(state.lock.method);
    if (wifiStatusValue) wifiStatusValue.textContent = state.airplane ? 'Wyłączone' : state.wifi;
    if (btStatusValue) btStatusValue.textContent = state.airplane ? 'Wyłączony' : (state.bluetooth ? 'Włączony' : 'Wyłączony');
    if (airplaneToggle) airplaneToggle.checked = !!state.airplane;

    document.querySelectorAll('#lock-method-options .selectable-option').forEach((row) => {
      row.classList.toggle('active', row.dataset.lockMethod === state.lock.method);
    });
    updateSecretEditorUI();
  }

  function renderAppIconVisual(appObj, sizeClass = 'home-app-icon') {
    const wrap = document.createElement('div');
    wrap.className = sizeClass;
    if (appObj.badge) {
      wrap.classList.add('custom-badge-icon');
      wrap.textContent = appObj.badge;
    } else {
      const img = document.createElement('img');
      img.src = appObj.icon;
      img.alt = appObj.name;
      wrap.appendChild(img);
    }
    return wrap;
  }

  function renderWidgets() {
    if (!widgetsGrid) return;
    widgetsGrid.innerHTML = '';

    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const dayNames = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
    const dateStr = `${dayNames[now.getDay()]}, ${now.getDate()}.${String(now.getMonth() + 1).padStart(2, '0')}`;

    state.widgets.forEach((w) => {
      const card = document.createElement('div');
      card.className = 'zen-widget';
      card.draggable = editMode;
      card.dataset.widgetId = w.id;

      if (editMode) {
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'widget-remove-btn';
        delBtn.textContent = '×';
        delBtn.title = 'Usuń widżet';
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          state.widgets = state.widgets.filter((item) => item.id !== w.id);
          saveState();
          renderWidgets();
        });
        card.appendChild(delBtn);
      }

      if (w.type === 'clock') {
        card.innerHTML += `
          <div class="widget-kicker">Zegar ZeniOS</div>
          <div class="widget-big-value">${hh}:${mm}</div>
          <div class="widget-sub">${dateStr}</div>
        `;
      } else if (w.type === 'weather') {
        card.innerHTML += `
          <div class="widget-kicker">Pogoda</div>
          <div class="widget-big-value">14°C</div>
          <div class="widget-sub">Bezchmurnie · ZeniCity</div>
        `;
      } else if (w.type === 'status') {
        card.innerHTML += `
          <div class="widget-kicker">Stan systemu</div>
          <div class="widget-big-value">${state.battery}%</div>
          <div class="widget-sub">${state.airplane ? 'Tryb samolotowy' : state.wifi}</div>
        `;
      } else if (w.type === 'shortcuts') {
        card.innerHTML += `
          <div class="widget-kicker">Szybkie akcje</div>
          <div class="widget-sub" style="margin-top:8px;">Kliknij, aby zablokować ekran lub otworzyć Ustawienia</div>
        `;
        card.addEventListener('click', () => {
          if (editMode) return;
          if (window.ZeniLockscreen && typeof window.ZeniLockscreen.lockNow === 'function') {
            window.ZeniLockscreen.lockNow();
          }
        });
      }

      card.addEventListener('dragstart', () => {
        if (!editMode) return;
        draggedWidgetId = w.id;
        card.classList.add('dragging');
      });
      card.addEventListener('dragend', () => {
        draggedWidgetId = null;
        card.classList.remove('dragging');
      });
      card.addEventListener('dragover', (e) => {
        if (!editMode || !draggedWidgetId || draggedWidgetId === w.id) return;
        e.preventDefault();
      });
      card.addEventListener('drop', (e) => {
        if (!editMode || !draggedWidgetId || draggedWidgetId === w.id) return;
        e.preventDefault();
        const fromIdx = state.widgets.findIndex((item) => item.id === draggedWidgetId);
        const toIdx = state.widgets.findIndex((item) => item.id === w.id);
        if (fromIdx > -1 && toIdx > -1) {
          const [moved] = state.widgets.splice(fromIdx, 1);
          state.widgets.splice(toIdx, 0, moved);
          saveState();
          renderWidgets();
        }
      });

      widgetsGrid.appendChild(card);
    });
  }

  function renderHomeApps() {
    if (!homeAppsGrid) return;
    homeAppsGrid.innerHTML = '';

    state.homeApps.forEach((appId) => {
      const appObj = INSTALLED_APPS.find((a) => a.id === appId);
      if (!appObj) return;

      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'home-app-tile';
      tile.draggable = editMode;
      tile.dataset.appId = appObj.id;

      if (editMode) {
        const rmBtn = document.createElement('span');
        rmBtn.className = 'app-remove-badge';
        rmBtn.textContent = '−';
        rmBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          state.homeApps = state.homeApps.filter((id) => id !== appObj.id);
          saveState();
          renderHomeApps();
        });
        tile.appendChild(rmBtn);
      }

      tile.appendChild(renderAppIconVisual(appObj, 'home-app-icon'));

      const lbl = document.createElement('span');
      lbl.className = 'home-app-label';
      lbl.textContent = appObj.name;
      tile.appendChild(lbl);

      tile.addEventListener('click', () => {
        if (editMode) return;
        openApp(appObj.id);
      });

      tile.addEventListener('dragstart', () => {
        if (!editMode) return;
        draggedAppId = appObj.id;
        tile.classList.add('dragging');
      });
      tile.addEventListener('dragend', () => {
        draggedAppId = null;
        tile.classList.remove('dragging');
      });
      tile.addEventListener('dragover', (e) => {
        if (!editMode || !draggedAppId || draggedAppId === appObj.id) return;
        e.preventDefault();
      });
      tile.addEventListener('drop', (e) => {
        if (!editMode || !draggedAppId || draggedAppId === appObj.id) return;
        e.preventDefault();
        const fromIdx = state.homeApps.indexOf(draggedAppId);
        const toIdx = state.homeApps.indexOf(appObj.id);
        if (fromIdx > -1 && toIdx > -1) {
          state.homeApps.splice(fromIdx, 1);
          state.homeApps.splice(toIdx, 0, draggedAppId);
          saveState();
          renderHomeApps();
        }
      });

      homeAppsGrid.appendChild(tile);
    });
  }

  function setEditMode(enabled) {
    editMode = !!enabled;
    if (homeContent) homeContent.classList.toggle('edit-mode', editMode);
    if (homeEditBanner) homeEditBanner.classList.toggle('active', editMode);
    if (!editMode && widgetPickerSheet) {
      widgetPickerSheet.classList.remove('open');
    }
    renderWidgets();
    renderHomeApps();
  }

  function renderWidgetPicker() {
    if (!widgetPickerList) return;
    widgetPickerList.innerHTML = '';
    WIDGET_CATALOG.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'widget-picker-item';
      row.innerHTML = `
        <div>
          <strong>${item.title}</strong>
          <span>${item.desc}</span>
        </div>
        <button type="button" class="mini-save-btn">Dodaj</button>
      `;
      row.querySelector('button').addEventListener('click', () => {
        state.widgets.push({
          id: `w-${item.type}-${Date.now()}`,
          type: item.type
        });
        saveState();
        renderWidgets();
      });
      widgetPickerList.appendChild(row);
    });
  }

  let longPressTimer = null;
  let longPressStart = null;
  if (wallpaperLayer) {
    wallpaperLayer.addEventListener('pointerdown', (e) => {
      if (!wallpaperLayer.classList.contains('unlocked')) return;
      if (e.target.closest('button, input, .liquid-dock, .app-search-drawer, .widget-picker-sheet, .home-edit-banner')) return;
      longPressStart = { x: e.clientX, y: e.clientY };
      window.clearTimeout(longPressTimer);
      longPressTimer = window.setTimeout(() => {
        if (!editMode) {
          setEditMode(true);
        }
      }, 520);
    });

    wallpaperLayer.addEventListener('pointermove', (e) => {
      if (!longPressStart || !longPressTimer) return;
      const dist = Math.hypot(e.clientX - longPressStart.x, e.clientY - longPressStart.y);
      if (dist > 12) {
        window.clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    });

    const clearLongPress = () => {
      window.clearTimeout(longPressTimer);
      longPressTimer = null;
      longPressStart = null;
    };
    wallpaperLayer.addEventListener('pointerup', clearLongPress);
    wallpaperLayer.addEventListener('pointercancel', clearLongPress);
  }

  if (openWidgetDrawerBtn) {
    openWidgetDrawerBtn.addEventListener('click', () => {
      renderWidgetPicker();
      if (widgetPickerSheet) widgetPickerSheet.classList.add('open');
    });
  }
  if (closeWidgetDrawerBtn) {
    closeWidgetDrawerBtn.addEventListener('click', () => {
      if (widgetPickerSheet) widgetPickerSheet.classList.remove('open');
    });
  }
  if (doneEditModeBtn) {
    doneEditModeBtn.addEventListener('click', () => setEditMode(false));
  }

  function renderInstalledAppsList(filterText = '') {
    if (!installedAppsList) return;
    const q = filterText.trim().toLowerCase();
    installedAppsList.innerHTML = '';

    const matches = INSTALLED_APPS.filter((app) => {
      if (!q) return true;
      return app.name.toLowerCase().includes(q) || app.category.toLowerCase().includes(q);
    });

    if (!matches.length) {
      installedAppsList.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:24px 12px;font-size:14px;">Brak zainstalowanych aplikacji pasujących do wyszukiwania.</div>';
      return;
    }

    matches.forEach((app) => {
      const item = document.createElement('div');
      item.className = 'installed-app-row';
      item.appendChild(renderAppIconVisual(app, 'installed-app-icon'));

      const info = document.createElement('div');
      info.className = 'installed-app-info';
      info.innerHTML = `<strong>${app.name}</strong><span>${app.category}</span>`;
      item.appendChild(info);

      const actionBtn = document.createElement('button');
      actionBtn.type = 'button';
      actionBtn.className = 'add-to-home-btn';
      const onHome = state.homeApps.includes(app.id);
      actionBtn.textContent = onHome ? 'Na pulpicie' : '+ Pulpit';
      actionBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!state.homeApps.includes(app.id)) {
          state.homeApps.push(app.id);
          saveState();
          renderHomeApps();
          actionBtn.textContent = 'Na pulpicie';
        }
      });
      item.appendChild(actionBtn);

      item.addEventListener('click', () => {
        closeSearchDrawer();
        openApp(app.id);
      });

      installedAppsList.appendChild(item);
    });
  }

  function openSearchDrawer() {
    if (!searchDrawer) return;
    renderInstalledAppsList(installedAppsSearch ? installedAppsSearch.value : '');
    searchDrawer.classList.add('open');
    if (installedAppsSearch) {
      window.setTimeout(() => installedAppsSearch.focus(), 80);
    }
  }

  function closeSearchDrawer() {
    if (!searchDrawer) return;
    searchDrawer.classList.remove('open');
  }

  if (closeSearchDrawerBtn) {
    closeSearchDrawerBtn.addEventListener('click', closeSearchDrawer);
  }
  if (installedAppsSearch) {
    installedAppsSearch.addEventListener('input', (e) => {
      renderInstalledAppsList(e.target.value);
    });
  }

  let drawerSwipeStartX = null;
  let drawerSwipeStartY = null;
  if (wallpaperLayer) {
    wallpaperLayer.addEventListener('pointerdown', (e) => {
      if (!wallpaperLayer.classList.contains('unlocked')) return;
      if (editMode) return;
      if (searchDrawer && searchDrawer.classList.contains('open')) return;
      drawerSwipeStartX = e.clientX;
      drawerSwipeStartY = e.clientY;
    });

    wallpaperLayer.addEventListener('pointerup', (e) => {
      if (drawerSwipeStartX === null || drawerSwipeStartY === null) return;
      const dx = e.clientX - drawerSwipeStartX;
      const dy = Math.abs(e.clientY - drawerSwipeStartY);
      drawerSwipeStartX = null;
      drawerSwipeStartY = null;
      if (dx < -70 && dy < 90) {
        openSearchDrawer();
      }
    });
  }

  function openApp(appId, pushHistory = true) {
    if (!appId) return;
    if (wallpaperLayer) {
      wallpaperLayer.classList.add('active');
      wallpaperLayer.classList.add('unlocked');
    }
    closeSearchDrawer();
    setEditMode(false);

    document.querySelectorAll('.app-view').forEach((view) => {
      view.classList.toggle('active', view.id === appId);
    });

    if (pushHistory && activeAppId && activeAppId !== appId) {
      appHistoryStack.push(activeAppId);
    }
    activeAppId = appId;
    if (appId === 'app-messages') renderMsgList();
    if (appId === 'app-calendar') renderCalendar();
    if (appId === 'app-clock') renderClockApp();
    if (appId === 'app-files') renderFilesApp();
    if (appId === 'app-notebook') renderNotesList();
    if (systemNavOverlay) {
      systemNavOverlay.classList.add('in-app');
    }
  }

  function goHome() {
    document.querySelectorAll('.app-view').forEach((view) => {
      view.classList.remove('active');
    });
    activeAppId = null;
    appHistoryStack.length = 0;
    if (systemNavOverlay) {
      systemNavOverlay.classList.remove('in-app');
    }
    if (wallpaperLayer) {
      wallpaperLayer.classList.add('active');
      wallpaperLayer.classList.add('unlocked');
    }
  }

  function handleSystemBack() {
    if (searchDrawer && searchDrawer.classList.contains('open')) {
      closeSearchDrawer();
      return;
    }
    if (activeAppId === 'app-settings') {
      const activeSub = document.querySelector('#app-settings .subscreen.active');
      if (activeSub && activeSub.id !== 'settings-main') {
        openSettingsSubscreen('settings-main');
        return;
      }
    }
    if (appHistoryStack.length > 0) {
      const prevApp = appHistoryStack.pop();
      openApp(prevApp, false);
    } else if (activeAppId) {
      goHome();
    }
  }

  if (gestureHomeBtn) {
    gestureHomeBtn.addEventListener('click', goHome);
  }
  if (sysBtnHome) {
    sysBtnHome.addEventListener('click', goHome);
  }
  if (sysBtnRecents) {
    sysBtnRecents.addEventListener('click', goHome);
  }
  if (sysBtnBack) {
    sysBtnBack.addEventListener('click', handleSystemBack);
  }

  document.querySelectorAll('[data-open-app]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openApp(btn.dataset.openApp);
    });
  });

  function openSettingsSubscreen(subId) {
    document.querySelectorAll('#app-settings .subscreen').forEach((sub) => {
      sub.classList.toggle('active', sub.id === subId);
    });
    if (subId === 'settings-wallpaper') {
      renderWallpaperGrid();
    } else if (subId === 'settings-passcode') {
      updateSettingsLabels();
    } else if (subId === 'settings-system-nav') {
      applyNavMode();
    } else if (subId === 'settings-lockscreen' && window.ZeniLockscreenCustom) {
      window.ZeniLockscreenCustom.sync();
    }
  }

  document.querySelectorAll('[data-settings-back]').forEach((btn) => {
    btn.addEventListener('click', () => openSettingsSubscreen('settings-main'));
  });

  document.getElementById('open-passcode-picker')?.addEventListener('click', () => openSettingsSubscreen('settings-passcode'));
  document.getElementById('open-wallpaper-picker')?.addEventListener('click', () => openSettingsSubscreen('settings-wallpaper'));
  document.getElementById('open-lockscreen-picker')?.addEventListener('click', () => openSettingsSubscreen('settings-lockscreen'));
  document.getElementById('open-system-nav-picker')?.addEventListener('click', () => openSettingsSubscreen('settings-system-nav'));

  document.querySelectorAll('[data-theme-set]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.theme = btn.dataset.themeSet;
      applyTheme();
      saveState();
    });
  });

  if (airplaneToggle) {
    airplaneToggle.addEventListener('change', () => {
      state.airplane = airplaneToggle.checked;
      updateStatusBar();
      updateSettingsLabels();
      saveState();
    });
  }

  function cycleBattery() {
    const levels = [100, 94, 76, 48, 19, 8];
    const idx = levels.indexOf(Number(state.battery));
    state.battery = levels[(idx + 1) % levels.length];
    updateStatusBar();
    saveState();
  }
  if (batteryCycleRow) {
    batteryCycleRow.addEventListener('click', cycleBattery);
  }

  if (settingsSearch) {
    settingsSearch.addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      const rows = document.querySelectorAll('#settings-main .settings-row[data-search]');
      rows.forEach((row) => {
        const hay = `${row.textContent} ${row.dataset.search || ''}`.toLowerCase();
        row.style.display = !q || hay.includes(q) ? '' : 'none';
      });
      document.querySelectorAll('#settings-main .settings-group[data-group]').forEach((grp) => {
        const anyVisible = [...grp.querySelectorAll('.settings-row[data-search]')].some((r) => r.style.display !== 'none');
        grp.style.display = anyVisible ? '' : 'none';
      });
    });
  }

  document.querySelectorAll('#lock-method-options .selectable-option').forEach((row) => {
    row.addEventListener('click', () => {
      const method = row.dataset.lockMethod;
      if (!method) return;
      state.lock.method = method;
      saveState();
      updateSettingsLabels();
      if (window.ZeniLockscreen && typeof window.ZeniLockscreen.refresh === 'function') {
        window.ZeniLockscreen.refresh();
      }
    });
  });

  if (saveSecretBtn) {
    saveSecretBtn.addEventListener('click', () => {
      const val = (secretEditInput ? secretEditInput.value : '').trim();
      const method = state.lock.method;
      if (method === 'pin') {
        const cleanPin = val.replace(/\D/g, '').slice(0, 4);
        if (cleanPin.length === 4) {
          state.lock.pin = cleanPin;
          if (secretEditInput) secretEditInput.value = cleanPin;
          saveState();
          saveSecretBtn.textContent = 'Zapisano PIN ✓';
          window.setTimeout(() => { saveSecretBtn.textContent = 'Zapisz kod / wzór'; }, 1400);
        }
      } else if (method === 'password') {
        if (val.length > 0) {
          state.lock.password = val;
          saveState();
          saveSecretBtn.textContent = 'Zapisano hasło ✓';
          window.setTimeout(() => { saveSecretBtn.textContent = 'Zapisz kod / wzór'; }, 1400);
        }
      } else if (method === 'pattern') {
        const nodes = val.split(/[^1-9]+/).filter(Boolean);
        if (nodes.length >= 2) {
          const seq = nodes.join('-');
          state.lock.pattern = seq;
          if (secretEditInput) secretEditInput.value = seq;
          saveState();
          saveSecretBtn.textContent = 'Zapisano wzór ✓';
          window.setTimeout(() => { saveSecretBtn.textContent = 'Zapisz kod / wzór'; }, 1400);
        }
      }
    });
  }

  if (testLockNowBtn) {
    testLockNowBtn.addEventListener('click', () => {
      if (window.ZeniLockscreen && typeof window.ZeniLockscreen.lockNow === 'function') {
        window.ZeniLockscreen.lockNow();
      }
    });
  }

  function renderWallpaperGrid() {
    if (!wpGrid) return;
    wpGrid.innerHTML = '';
    WALLPAPERS.forEach((wp) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'wp-card';
      if (state.wallpaper === wp.src) card.classList.add('selected');

      const img = document.createElement('img');
      img.src = wp.src;
      img.alt = wp.label;
      card.appendChild(img);

      const cap = document.createElement('div');
      cap.className = 'wp-card-label';
      cap.textContent = wp.label;
      card.appendChild(cap);

      card.addEventListener('click', () => {
        state.wallpaper = wp.src;
        saveState();
        applyWallpaper();
        renderWallpaperGrid();
      });

      wpGrid.appendChild(card);
    });
  }

  document.querySelectorAll('#nav-mode-options .selectable-option').forEach((row) => {
    row.addEventListener('click', () => {
      const mode = row.dataset.navMode;
      if (!mode) return;
      state.navMode = mode;
      saveState();
      applyNavMode();
    });
  });

  const gallerySearchToggle = document.getElementById('gallery-search-toggle');
  const gallerySearchWrap = document.getElementById('gallery-search-wrap');
  const gallerySearchInput = document.getElementById('gallery-search-input');
  const galleryEmptyText = document.getElementById('gallery-empty-text');
  const galPaneCollections = document.getElementById('gal-pane-collections');
  const galPaneTimeline = document.getElementById('gal-pane-timeline');

  function setGalleryView(viewName) {
    const isTimeline = viewName === 'timeline';
    if (galPaneCollections) galPaneCollections.classList.toggle('active', !isTimeline);
    if (galPaneTimeline) galPaneTimeline.classList.toggle('active', isTimeline);

    document.querySelectorAll('#app-gallery .segmented-bar .seg-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.galView === viewName || (!isTimeline && viewName !== 'timeline' && btn.dataset.galView === viewName));
    });
    document.querySelectorAll('#app-gallery .app-bottom-tabs .bottom-tab').forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.galNav === viewName);
    });

    if (viewName === 'search' && gallerySearchWrap) {
      gallerySearchWrap.classList.add('open');
      if (gallerySearchInput) gallerySearchInput.focus();
    }
  }

  if (gallerySearchToggle) {
    gallerySearchToggle.addEventListener('click', () => {
      if (!gallerySearchWrap) return;
      gallerySearchWrap.classList.toggle('open');
      if (gallerySearchWrap.classList.contains('open') && gallerySearchInput) {
        gallerySearchInput.focus();
      }
    });
  }

  if (gallerySearchInput) {
    gallerySearchInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (galleryEmptyText) {
        galleryEmptyText.textContent = val ? `Brak wyników dla „${val}”` : 'Brak pozycji';
      }
    });
  }

  document.querySelectorAll('#app-gallery [data-gal-view]').forEach((btn) => {
    btn.addEventListener('click', () => setGalleryView(btn.dataset.galView));
  });
  document.querySelectorAll('#app-gallery [data-gal-nav]').forEach((tab) => {
    tab.addEventListener('click', () => setGalleryView(tab.dataset.galNav));
  });
  document.querySelectorAll('#app-gallery .zoom-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('#app-gallery .zoom-pill').forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
    });
  });

  function toggleTorch(forceState) {
    state.torch = typeof forceState === 'boolean' ? forceState : !state.torch;
    if (torchGlow) {
      torchGlow.classList.toggle('active', state.torch);
    }
    const lockTorchBtn = document.getElementById('lock-torch-btn');
    if (lockTorchBtn) {
      lockTorchBtn.classList.toggle('active', state.torch);
    }
    saveState();
  }

  // ===== Wiadomości: lista rozmów + czat (ZeniPeek, ZeniMessageMenu) =====
  const MSG_KEY = 'zenios_messages_v1';
  const MSG_SEED = () => [
    { id: 'c1', name: 'Maja Nowak', initials: 'MN', color: '#0A84FF', time: '16:20', unread: 2, messages: [
      { id: 'm1', from: 'them', text: 'Hej! Testujesz już nowy ekran blokady w ZeniOS?', time: '16:18' },
      { id: 'm2', from: 'them', text: 'Przytrzymaj tę rozmowę na liście, żeby podejrzeć podgląd bez oznaczania jako przeczytane.', time: '16:20', reaction: '👍' }
    ]},
    { id: 'c2', name: 'Zespół ZeniOS', initials: 'ZS', color: '#30D158', time: '14:05', unread: 0, messages: [
      { id: 'm3', from: 'them', text: 'Kompilacja rdzenia systemu gotowa. Przeciągnij z góry w dół, aby otworzyć Centrum sterowania.', time: '14:05' },
      { id: 'm4', from: 'me', text: 'Świetnie wygląda, wszystko działa płynnie!', time: '14:08' }
    ]},
    { id: 'c3', name: 'Kacper Zieliński', initials: 'KZ', color: '#BF5AF2', time: 'Wczoraj', unread: 1, messages: [
      { id: 'm5', from: 'them', text: 'Kliknij lub przytrzymaj dymek w rozmowie, żeby zareagować, odpowiedzieć lub usunąć.', time: 'Wczoraj' }
    ]}
  ];
  let msgConvs = (() => {
    try { const r = JSON.parse(localStorage.getItem(MSG_KEY)); return Array.isArray(r) && r.length ? r : MSG_SEED(); }
    catch (_) { return MSG_SEED(); }
  })();
  let activeConvId = null, replyToMsg = null;
  const saveMsgs = () => { try { localStorage.setItem(MSG_KEY, JSON.stringify(msgConvs)); } catch (_) {} };
  const escHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  class ZeniPeek {
    constructor() {
      this.el = document.createElement('div');
      this.el.className = 'zeni-peek';
      this.el.innerHTML = '<div class="zeni-peek-backdrop"></div><div class="zeni-peek-card"></div>';
      document.querySelector('.phone-screen')?.appendChild(this.el);
      this.backdrop = this.el.querySelector('.zeni-peek-backdrop');
      this.card = this.el.querySelector('.zeni-peek-card');
      this.backdrop.addEventListener('click', () => this.hide());
    }
    show(conv) {
      if (!conv) return;
      const last = conv.messages.slice(-4).map((m) =>
        `<div class="zeni-peek-msg ${m.from === 'me' ? 'me' : 'them'}">${escHtml(m.text)}</div>`
      ).join('') || '<div class="zeni-peek-msg them">Brak wiadomości</div>';
      this.card.innerHTML = `
        <div class="zeni-peek-head"><div class="msg-avatar sm" style="background:${conv.color}">${escHtml(conv.initials)}</div><div><b>${escHtml(conv.name)}</b><small>Podgląd bez oznaczania jako przeczytane</small></div></div>
        <div class="zeni-peek-body">${last}</div>
        <div class="zeni-peek-foot"><span>Puść, aby zamknąć</span><button type="button" class="zeni-peek-open">Otwórz rozmowę</button></div>`;
      this.card.querySelector('.zeni-peek-open').addEventListener('click', () => { this.hide(); openChat(conv.id, true); });
      this.el.classList.add('open');
    }
    hide() { this.el.classList.remove('open'); }
  }

  class ZeniMessageMenu {
    constructor(onAction) {
      this.onAction = onAction;
      this.el = document.createElement('div');
      this.el.className = 'zeni-ctx';
      this.el.innerHTML = '<div class="zeni-ctx-backdrop"></div><div class="zeni-ctx-sheet"></div>';
      document.querySelector('.phone-screen')?.appendChild(this.el);
      this.sheet = this.el.querySelector('.zeni-ctx-sheet');
      this.el.querySelector('.zeni-ctx-backdrop').addEventListener('click', () => this.hide());
    }
    show(msg, anchorRect) {
      const emojis = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
      this.sheet.innerHTML = `
        <div class="zeni-ctx-reactions">${emojis.map((e) => `<button type="button" class="${msg.reaction === e ? 'active' : ''}" data-react="${e}">${e}</button>`).join('')}</div>
        <div class="zeni-ctx-actions">
          <button type="button" data-act="reply">Odpowiedz</button>
          <button type="button" data-act="copy">Kopiuj</button>
          <button type="button" class="danger" data-act="delete">Usuń</button>
        </div>`;
      this.sheet.querySelectorAll('[data-react]').forEach((b) => b.addEventListener('click', () => { this.onAction('react', msg, b.dataset.react); this.hide(); }));
      this.sheet.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => { this.onAction(b.dataset.act, msg); this.hide(); }));
      const pr = document.querySelector('.phone-screen')?.getBoundingClientRect() || { left: 0, top: 0, width: 390, height: 844 };
      const top = Math.min(pr.height - 170, Math.max(70, (anchorRect ? anchorRect.bottom - pr.top + 8 : 220)));
      this.sheet.style.left = '24px';
      this.sheet.style.right = '24px';
      this.sheet.style.top = `${top}px`;
      this.el.classList.add('open');
    }
    hide() { this.el.classList.remove('open'); }
  }

  const zeniPeek = new ZeniPeek();
  let peekingConvId = null, peekTimer = null, peekStart = null;
  const zeniMenu = new ZeniMessageMenu((act, msg, emoji) => {
    const conv = msgConvs.find((c) => c.id === activeConvId);
    if (!conv) return;
    if (act === 'react') msg.reaction = msg.reaction === emoji ? null : emoji;
    else if (act === 'reply') {
      replyToMsg = msg;
      const b = document.getElementById('msg-banner');
      if (b) {
        b.hidden = false;
        document.getElementById('msg-banner-title').textContent = `Odpowiedź do ${msg.from === 'me' ? 'siebie' : conv.name}`;
        document.getElementById('msg-banner-text').textContent = msg.text;
      }
      document.getElementById('msg-input')?.focus();
    } else if (act === 'copy') {
      navigator.clipboard?.writeText(msg.text).catch(() => {});
      showToast('Skopiowano');
    } else if (act === 'delete') {
      conv.messages = conv.messages.filter((m) => m.id !== msg.id);
    }
    saveMsgs();
    renderThread(conv);
    renderMsgList();
  });

  function renderMsgList() {
    const list = document.getElementById('msg-conv-list');
    if (!list) return;
    list.innerHTML = msgConvs.map((c) => {
      const last = c.messages[c.messages.length - 1];
      const preview = last ? `${last.from === 'me' ? 'Ty: ' : ''}${last.text}` : 'Brak wiadomości';
      return `<div class="msg-conv-row" data-conv="${c.id}">
        <div class="msg-avatar" style="background:${c.color}">${escHtml(c.initials)}</div>
        <div class="msg-conv-body">
          <div class="msg-conv-top"><span class="msg-conv-name">${escHtml(c.name)}</span><span class="msg-conv-time">${escHtml(c.time)}</span></div>
          <div class="msg-conv-preview">${escHtml(preview)}</div>
        </div>
        ${c.unread ? `<span class="msg-unread">${c.unread}</span>` : ''}
      </div>`;
    }).join('');

    list.querySelectorAll('.msg-conv-row').forEach((row) => {
      const id = row.dataset.conv;
      let longFired = false;
      row.addEventListener('pointerdown', (e) => {
        longFired = false;
        peekStart = { x: e.clientX, y: e.clientY };
        clearTimeout(peekTimer);
        peekTimer = setTimeout(() => {
          longFired = true;
          peekingConvId = id;
          zeniPeek.show(msgConvs.find((c) => c.id === id));
        }, 420);
      });
      row.addEventListener('pointermove', (e) => {
        if (peekStart && Math.hypot(e.clientX - peekStart.x, e.clientY - peekStart.y) > 10) {
          clearTimeout(peekTimer);
        }
      });
      const finishPress = () => {
        clearTimeout(peekTimer);
        peekStart = null;
        if (peekingConvId === id) { peekingConvId = null; zeniPeek.hide(); }
      };
      row.addEventListener('pointerup', finishPress);
      row.addEventListener('pointercancel', finishPress);
      row.addEventListener('click', () => { if (!longFired) openChat(id, true); });
    });
  }

  function renderThread(conv) {
    const thread = document.getElementById('msg-thread');
    if (!thread || !conv) return;
    thread.innerHTML = conv.messages.map((m) => `
      <div class="msg-bubble-wrap ${m.from === 'me' ? 'me' : 'them'}" data-mid="${m.id}">
        ${m.replyTo ? `<div class="msg-reply-quote">${escHtml(m.replyTo)}</div>` : ''}
        <div class="msg-bubble">${escHtml(m.text)}</div>
        ${m.reaction ? `<span class="msg-reaction-pill">${escHtml(m.reaction)}</span>` : ''}
      </div>`).join('');

    thread.querySelectorAll('.msg-bubble-wrap').forEach((wrap) => {
      const msg = conv.messages.find((x) => x.id === wrap.dataset.mid);
      if (!msg) return;
      let timer = null, didLong = false;
      wrap.addEventListener('pointerdown', () => {
        didLong = false;
        timer = setTimeout(() => { didLong = true; zeniMenu.show(msg, wrap.querySelector('.msg-bubble').getBoundingClientRect()); }, 400);
      });
      wrap.addEventListener('pointerup', () => clearTimeout(timer));
      wrap.addEventListener('pointercancel', () => clearTimeout(timer));
      wrap.addEventListener('click', () => { if (!didLong) zeniMenu.show(msg, wrap.querySelector('.msg-bubble').getBoundingClientRect()); });
    });
    thread.scrollTop = thread.scrollHeight;
  }

  function openChat(id, markRead) {
    const conv = msgConvs.find((c) => c.id === id);
    if (!conv) return;
    activeConvId = id;
    if (markRead) { conv.unread = 0; saveMsgs(); }
    document.getElementById('msg-chat-name').textContent = conv.name;
    const av = document.getElementById('msg-chat-avatar');
    av.textContent = conv.initials;
    av.style.background = conv.color;
    replyToMsg = null;
    const banner = document.getElementById('msg-banner');
    if (banner) banner.hidden = true;
    renderThread(conv);
    document.getElementById('msg-list-screen')?.classList.remove('active');
    document.getElementById('msg-chat-screen')?.classList.add('active');
  }

  function sendMsg() {
    const inp = document.getElementById('msg-input');
    const txt = inp?.value.trim();
    const conv = msgConvs.find((c) => c.id === activeConvId);
    if (!txt || !conv) return;
    const now = new Date();
    conv.messages.push({
      id: `m-${Date.now()}`,
      from: 'me',
      text: txt,
      time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      replyTo: replyToMsg ? replyToMsg.text : null
    });
    conv.time = 'Teraz';
    inp.value = '';
    replyToMsg = null;
    const banner = document.getElementById('msg-banner');
    if (banner) banner.hidden = true;
    saveMsgs();
    renderThread(conv);
    renderMsgList();
  }

  document.getElementById('msg-back-btn')?.addEventListener('click', () => {
    document.getElementById('msg-chat-screen')?.classList.remove('active');
    document.getElementById('msg-list-screen')?.classList.add('active');
    renderMsgList();
  });
  document.getElementById('msg-send')?.addEventListener('click', sendMsg);
  document.getElementById('msg-input')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMsg(); });
  document.getElementById('msg-banner-close')?.addEventListener('click', () => {
    replyToMsg = null;
    document.getElementById('msg-banner').hidden = true;
  });
  document.getElementById('msg-reset-btn')?.addEventListener('click', () => {
    msgConvs = MSG_SEED();
    saveMsgs();
    renderMsgList();
    showToast('Przywrócono rozmowy demo');
  });

  // ===== Kalkulator (styl iOS) =====
  let calcCur = '0', calcPrev = null, calcOp = null, calcFresh = false;
  const calcDisp = document.getElementById('calc-display');
  const calcAc = document.getElementById('calc-ac');
  const fmtCalc = (n) => {
    if (!Number.isFinite(n)) return 'Błąd';
    const s = String(Math.round(n * 1e9) / 1e9).replace('.', ',');
    return s.length > 10 ? n.toExponential(4).replace('.', ',') : s;
  };
  const renderCalc = () => {
    if (!calcDisp) return;
    calcDisp.textContent = calcCur.replace('.', ',');
    const len = calcDisp.textContent.length;
    calcDisp.style.fontSize = len > 9 ? '44px' : len > 6 ? '60px' : '76px';
    if (calcAc) calcAc.textContent = (calcCur !== '0' || calcPrev !== null) ? 'C' : 'AC';
  };
  const computeCalc = () => {
    const a = parseFloat(calcPrev), b = parseFloat(calcCur);
    if (calcOp === '+') return a + b;
    if (calcOp === '-') return a - b;
    if (calcOp === '*') return a * b;
    if (calcOp === '/') return b === 0 ? NaN : a / b;
    return b;
  };
  document.getElementById('calc-pad')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-calc]');
    if (!btn) return;
    const k = btn.dataset.calc;
    document.querySelectorAll('#calc-pad .calc-btn.op').forEach((b) => b.classList.remove('active'));
    if (k === 'C') {
      if (calcCur !== '0') { calcCur = '0'; calcFresh = false; }
      else { calcPrev = null; calcOp = null; calcFresh = false; }
    } else if (k === '±') {
      calcCur = calcCur.startsWith('-') ? calcCur.slice(1) : (calcCur === '0' ? '0' : '-' + calcCur);
    } else if (k === '%') {
      calcCur = String((parseFloat(calcCur) || 0) / 100);
    } else if (['+', '-', '*', '/'].includes(k)) {
      if (calcPrev !== null && calcOp && !calcFresh) {
        calcCur = String(computeCalc());
      }
      calcPrev = calcCur;
      calcOp = k;
      calcFresh = true;
      btn.classList.add('active');
    } else if (k === '=') {
      if (calcPrev !== null && calcOp) {
        calcCur = String(computeCalc());
        calcPrev = null;
        calcOp = null;
        calcFresh = true;
      }
    } else if (k === '.') {
      if (calcFresh) { calcCur = '0.'; calcFresh = false; }
      else if (!calcCur.includes('.')) calcCur += '.';
    } else {
      if (calcFresh || calcCur === '0') { calcCur = k; calcFresh = false; }
      else if (calcCur.replace('-', '').replace('.', '').length < 9) calcCur += k;
    }
    renderCalc();
  });
  renderCalc();

  // ===== Kalendarz (styl iOS) =====
  const CAL_KEY = 'zenios_calendar_v1';
  const MONTHS_FULL_PL = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
  const MONTHS_SHORT_PL = ['STY', 'LUT', 'MAR', 'KWI', 'MAJ', 'CZE', 'LIP', 'SIE', 'WRZ', 'PAŹ', 'LIS', 'GRU'];
  const isoDay = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  let calState = (() => {
    try { const r = JSON.parse(localStorage.getItem(CAL_KEY)); if (r && r.calendars) return r; } catch (_) {}
    const now = new Date();
    const tIso = isoDay(now.getFullYear(), now.getMonth(), now.getDate());
    return {
      year: now.getFullYear(),
      selected: tIso,
      yearMode: false,
      calendars: [
        { id: 'home', name: 'Dom', color: '#30D158', on: true },
        { id: 'work', name: 'Praca', color: '#0A84FF', on: true },
        { id: 'birthdays', name: 'Urodziny', color: '#BF5AF2', on: true }
      ],
      events: [
        { id: 'e1', title: 'Przegląd ZeniOS', date: tIso, time: '10:00', calId: 'work' },
        { id: 'e2', title: 'Zakupy wieczorem', date: tIso, time: '18:30', calId: 'home' }
      ]
    };
  })();
  const saveCal = () => { try { localStorage.setItem(CAL_KEY, JSON.stringify(calState)); } catch (_) {} };
  const closeCalSheets = () => {
    document.querySelectorAll('#app-calendar .sheet').forEach((s) => s.classList.remove('open'));
    document.getElementById('cal-scrim')?.classList.remove('open');
  };
  const openCalSheet = (id) => {
    closeCalSheets();
    document.getElementById('cal-scrim')?.classList.add('open');
    document.getElementById(id)?.classList.add('open');
  };

  function renderCalendar() {
    const now = new Date();
    const todayIso = isoDay(now.getFullYear(), now.getMonth(), now.getDate());
    const activeCalIds = new Set(calState.calendars.filter((c) => c.on).map((c) => c.id));
    const evByDate = {};
    calState.events.filter((e) => activeCalIds.has(e.calId)).forEach((e) => {
      (evByDate[e.date] = evByDate[e.date] || []).push(e);
    });

    document.getElementById('cal-year-label').textContent = String(calState.year);
    const monthsEl = document.getElementById('cal-months');
    const yearEl = document.getElementById('cal-year-view');
    const weekdaysEl = document.getElementById('cal-weekdays');
    monthsEl.style.display = calState.yearMode ? 'none' : '';
    weekdaysEl.style.display = calState.yearMode ? 'none' : '';
    yearEl.classList.toggle('active', calState.yearMode);

    if (calState.yearMode) {
      yearEl.innerHTML = Array.from({ length: 12 }, (_, m) => {
        const firstDow = (new Date(calState.year, m, 1).getDay() + 6) % 7;
        const dim = new Date(calState.year, m + 1, 0).getDate();
        let cells = Array(firstDow).fill('<span></span>').join('');
        for (let d = 1; d <= dim; d++) {
          const isT = isoDay(calState.year, m, d) === todayIso;
          cells += `<span class="${isT ? 'y-today' : ''}">${d}</span>`;
        }
        return `<div class="cal-mini-month" data-m="${m}"><h3>${MONTHS_FULL_PL[m]}</h3><div class="cal-mini-grid">${cells}</div></div>`;
      }).join('');
      yearEl.querySelectorAll('.cal-mini-month').forEach((mm) => mm.addEventListener('click', () => {
        calState.yearMode = false;
        calState.selected = isoDay(calState.year, Number(mm.dataset.m), 1);
        saveCal();
        renderCalendar();
      }));
    } else {
      monthsEl.innerHTML = Array.from({ length: 12 }, (_, m) => {
        const firstDow = (new Date(calState.year, m, 1).getDay() + 6) % 7;
        const dim = new Date(calState.year, m + 1, 0).getDate();
        let days = Array(firstDow).fill('<div class="cal-day empty"></div>').join('');
        for (let d = 1; d <= dim; d++) {
          const iso = isoDay(calState.year, m, d);
          const isT = iso === todayIso, isS = iso === calState.selected;
          const hasEv = !!(evByDate[iso] && evByDate[iso].length);
          const label = isT ? `<span class="num">${MONTHS_SHORT_PL[m]}</span><span class="sub-d">${d}</span>` : `<span class="num">${d}</span>`;
          days += `<button type="button" class="cal-day${isT ? ' today' : ''}${isS ? ' selected' : ''}${hasEv ? ' has-ev' : ''}" data-iso="${iso}">${label}</button>`;
        }
        return `<section class="cal-month"><div class="cal-month-title">${MONTHS_FULL_PL[m]}</div><div class="cal-grid">${days}</div></section>`;
      }).join('');
      monthsEl.querySelectorAll('.cal-day[data-iso]').forEach((b) => b.addEventListener('click', () => {
        calState.selected = b.dataset.iso;
        saveCal();
        renderCalendar();
      }));
    }

    const panel = document.getElementById('cal-day-panel');
    const dayEvs = (evByDate[calState.selected] || []).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    panel.innerHTML = `<div class="cal-day-panel-head"><span>${calState.selected}</span><button type="button" id="cal-panel-add">+ Dodaj</button></div>` +
      (dayEvs.length ? dayEvs.map((ev) => {
        const c = calState.calendars.find((x) => x.id === ev.calId) || { color: '#0A84FF' };
        return `<div class="cal-ev-item"><span class="cal-ev-dot" style="background:${c.color}"></span><span class="cal-ev-time">${escHtml(ev.time || '')}</span><span class="cal-ev-title">${escHtml(ev.title)}</span></div>`;
      }).join('') : '<div class="cal-ev-empty">Brak wydarzeń tego dnia</div>');
    panel.querySelector('#cal-panel-add')?.addEventListener('click', () => {
      document.getElementById('cal-ev-date').value = calState.selected;
      document.getElementById('cal-ev-title').value = '';
      openCalSheet('cal-sheet-add');
    });
  }

  document.getElementById('cal-year-btn')?.addEventListener('click', () => { calState.yearMode = !calState.yearMode; renderCalendar(); });
  document.getElementById('cal-today-btn')?.addEventListener('click', () => {
    const n = new Date();
    calState.year = n.getFullYear();
    calState.selected = isoDay(n.getFullYear(), n.getMonth(), n.getDate());
    calState.yearMode = false;
    saveCal();
    renderCalendar();
  });
  document.getElementById('cal-add-btn')?.addEventListener('click', () => {
    document.getElementById('cal-ev-date').value = calState.selected;
    document.getElementById('cal-ev-title').value = '';
    const sel = document.getElementById('cal-ev-cal');
    if (sel) sel.innerHTML = calState.calendars.map((c) => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('');
    openCalSheet('cal-sheet-add');
  });
  document.getElementById('cal-save-event')?.addEventListener('click', () => {
    const title = document.getElementById('cal-ev-title')?.value.trim();
    const date = document.getElementById('cal-ev-date')?.value;
    const time = document.getElementById('cal-ev-time')?.value || '12:00';
    const calId = document.getElementById('cal-ev-cal')?.value || 'home';
    if (!title || !date) return;
    calState.events.push({ id: `ev-${Date.now()}`, title, date, time, calId });
    calState.selected = date;
    saveCal();
    closeCalSheets();
    renderCalendar();
  });
  document.getElementById('cal-cals-btn')?.addEventListener('click', () => {
    const list = document.getElementById('cal-cals-list');
    list.innerHTML = calState.calendars.map((c) => `<div class="cal-cal-row" data-cid="${c.id}"><span class="cal-ev-dot" style="background:${c.color}"></span><span>${escHtml(c.name)}</span><span class="check">${c.on ? '✓' : ''}</span></div>`).join('');
    list.querySelectorAll('.cal-cal-row').forEach((r) => r.addEventListener('click', () => {
      const c = calState.calendars.find((x) => x.id === r.dataset.cid);
      if (c) { c.on = !c.on; saveCal(); renderCalendar(); r.querySelector('.check').textContent = c.on ? '✓' : ''; }
    }));
    openCalSheet('cal-sheet-cals');
  });
  const renderUpcoming = (q = '') => {
    const ql = q.trim().toLowerCase();
    const list = document.getElementById('cal-upcoming-list');
    const items = calState.events.filter((e) => !ql || e.title.toLowerCase().includes(ql) || e.date.includes(ql)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    list.innerHTML = items.length ? items.map((ev) => `<div class="cal-ev-item"><span class="cal-ev-time" style="width:auto;margin-right:8px">${escHtml(ev.date)} ${escHtml(ev.time || '')}</span><span class="cal-ev-title">${escHtml(ev.title)}</span></div>`).join('') : '<div class="cal-ev-empty">Brak wydarzeń</div>';
  };
  document.getElementById('cal-upcoming-btn')?.addEventListener('click', () => {
    const inp = document.getElementById('cal-upcoming-search');
    if (inp) inp.value = '';
    renderUpcoming('');
    openCalSheet('cal-sheet-upcoming');
  });
  document.getElementById('cal-search-btn')?.addEventListener('click', () => {
    openCalSheet('cal-sheet-upcoming');
    setTimeout(() => document.getElementById('cal-upcoming-search')?.focus(), 80);
  });
  document.getElementById('cal-upcoming-search')?.addEventListener('input', (e) => renderUpcoming(e.target.value));
  document.getElementById('cal-scrim')?.addEventListener('click', closeCalSheets);
  document.querySelectorAll('#app-calendar [data-close-sheet]').forEach((b) => b.addEventListener('click', closeCalSheets));

  // ===== Zegar (styl iOS: Zegary świata, Alarmy, Stoper, Minutniki) =====
  const CLK_KEY = 'zenios_clock_v1';
  const WORLD_CITIES = [
    { city: 'Szczecin', tz: 'Europe/Warsaw', sub: 'Dzisiaj, +0 GODZ.' },
    { city: 'Londyn', tz: 'Europe/London', sub: 'Dzisiaj, −1 GODZ.' },
    { city: 'Nowy Jork', tz: 'America/New_York', sub: 'Dzisiaj, −6 GODZ.' },
    { city: 'Tokio', tz: 'Asia/Tokyo', sub: 'Jutro, +8 GODZ.' }
  ];
  let clkState = (() => {
    try { const r = JSON.parse(localStorage.getItem(CLK_KEY)); if (r && Array.isArray(r.alarms)) return r; } catch (_) {}
    return { alarms: [
      { id: 'a1', h: 7, m: 0, label: 'Budzik', repeat: 'dni robocze', sound: 'Kręgi', snooze: true, on: true },
      { id: 'a2', h: 8, m: 30, label: 'Weekend', repeat: 'nigdy', sound: 'Fale', snooze: true, on: false }
    ]};
  })();
  let alarmEditMode = false, editingAlarmId = null, selHour = 7, selMin = 0;
  const saveClk = () => { try { localStorage.setItem(CLK_KEY, JSON.stringify(clkState)); } catch (_) {} };

  function buildWheels(container, hVal, mVal, hMax = 23, mMax = 59) {
    if (!container) return;
    const makeCol = (max, cur, onPick) => {
      const col = document.createElement('div');
      col.className = 'wheel-col';
      for (let i = 0; i <= max; i++) {
        const it = document.createElement('div');
        it.className = 'wheel-item' + (i === cur ? ' active' : '');
        it.textContent = String(i).padStart(2, '0');
        it.addEventListener('click', () => {
          col.querySelectorAll('.wheel-item').forEach((x) => x.classList.remove('active'));
          it.classList.add('active');
          onPick(i);
        });
        col.appendChild(it);
      }
      return col;
    };
    container.innerHTML = '<div class="wheel-highlight"></div>';
    container.appendChild(makeCol(hMax, hVal, (v) => { selHour = v; }));
    container.appendChild(makeCol(mMax, mVal, (v) => { selMin = v; }));
  }

  function renderClockApp() {
    const wList = document.getElementById('world-list');
    if (wList) {
      wList.innerHTML = WORLD_CITIES.map((c) => {
        let tStr = '--:--';
        try { tStr = new Intl.DateTimeFormat('pl-PL', { timeZone: c.tz, hour: '2-digit', minute: '2-digit' }).format(new Date()); } catch (_) {}
        return `<div class="world-row"><div><div class="world-sub">${escHtml(c.sub)}</div><div class="world-city">${escHtml(c.city)}</div></div><div class="world-time">${tStr}</div></div>`;
      }).join('');
    }
    const aList = document.getElementById('alarm-list');
    if (aList) {
      aList.innerHTML = clkState.alarms.map((a) => `<div class="alarm-row${alarmEditMode ? ' editing' : ''}" data-aid="${a.id}">
        <button type="button" class="alarm-del" data-del="${a.id}">−</button>
        <div class="alarm-info"><div class="alarm-time">${String(a.h).padStart(2, '0')}:${String(a.m).padStart(2, '0')}</div><div class="alarm-sub">${escHtml(a.label || 'Alarm')}, ${escHtml(a.repeat)}</div></div>
        <label class="ios-switch"><input type="checkbox" ${a.on ? 'checked' : ''} data-sw="${a.id}" /><span class="ios-slider"></span></label>
      </div>`).join('');
      aList.querySelectorAll('[data-sw]').forEach((ch) => ch.addEventListener('change', (e) => {
        e.stopPropagation();
        const al = clkState.alarms.find((x) => x.id === ch.dataset.sw);
        if (al) { al.on = ch.checked; saveClk(); }
      }));
      aList.querySelectorAll('[data-del]').forEach((btn) => btn.addEventListener('click', (e) => {
        e.stopPropagation();
        clkState.alarms = clkState.alarms.filter((x) => x.id !== btn.dataset.del);
        saveClk();
        renderClockApp();
      }));
      aList.querySelectorAll('.alarm-row').forEach((row) => row.addEventListener('click', (e) => {
        if (e.target.closest('.ios-switch, .alarm-del')) return;
        const al = clkState.alarms.find((x) => x.id === row.dataset.aid);
        if (al) openAlarmSheet(al);
      }));
    }
  }

  function openAlarmSheet(al = null) {
    editingAlarmId = al ? al.id : null;
    selHour = al ? al.h : 7;
    selMin = al ? al.m : 0;
    document.getElementById('alarm-sheet-title').textContent = al ? 'Edytuj alarm' : 'Dodaj alarm';
    document.getElementById('alarm-label-input').value = al ? al.label : 'Alarm';
    document.getElementById('alarm-snooze-input').checked = al ? !!al.snooze : true;
    buildWheels(document.getElementById('alarm-wheels'), selHour, selMin);
    document.getElementById('alarm-scrim')?.classList.add('open');
    document.getElementById('alarm-sheet')?.classList.add('open');
  }
  const closeAlarmSheet = () => {
    document.getElementById('alarm-scrim')?.classList.remove('open');
    document.getElementById('alarm-sheet')?.classList.remove('open');
  };

  document.querySelectorAll('#clock-tabbar .clock-tab').forEach((tab) => tab.addEventListener('click', () => {
    const t = tab.dataset.clockTab;
    document.querySelectorAll('#clock-tabbar .clock-tab').forEach((x) => x.classList.toggle('active', x === tab));
    document.querySelectorAll('#app-clock .clock-pane').forEach((p) => p.classList.toggle('active', p.id === `clock-pane-${t}`));
    if (t === 'timer') buildWheels(document.getElementById('timer-wheels'), 5, 0);
  }));
  document.getElementById('alarm-edit-btn')?.addEventListener('click', (e) => {
    alarmEditMode = !alarmEditMode;
    e.currentTarget.textContent = alarmEditMode ? 'Gotowe' : 'Edycja';
    renderClockApp();
  });
  document.getElementById('alarm-add-btn')?.addEventListener('click', () => openAlarmSheet(null));
  document.getElementById('alarm-cancel-btn')?.addEventListener('click', closeAlarmSheet);
  document.getElementById('alarm-scrim')?.addEventListener('click', closeAlarmSheet);
  document.getElementById('alarm-save-btn')?.addEventListener('click', () => {
    const label = document.getElementById('alarm-label-input')?.value.trim() || 'Alarm';
    const snooze = !!document.getElementById('alarm-snooze-input')?.checked;
    if (editingAlarmId) {
      const al = clkState.alarms.find((x) => x.id === editingAlarmId);
      if (al) Object.assign(al, { h: selHour, m: selMin, label, snooze });
    } else {
      clkState.alarms.push({ id: `a-${Date.now()}`, h: selHour, m: selMin, label, repeat: 'nigdy', sound: 'Kręgi', snooze, on: true });
    }
    saveClk();
    closeAlarmSheet();
    renderClockApp();
  });
  document.getElementById('sleep-change-btn')?.addEventListener('click', () => showToast('Harmonogram snu w przygotowaniu'));

  // Stoper
  let swRunning = false, swElapsed = 0, swLast = 0, swRaf = null, swLaps = [];
  const swDisp = document.getElementById('sw-display');
  const swStartBtn = document.getElementById('sw-start');
  const swLapBtn = document.getElementById('sw-lap');
  const fmtSw = (ms) => {
    const tot = Math.floor(ms / 10);
    const cs = String(tot % 100).padStart(2, '0');
    const sec = String(Math.floor(tot / 100) % 60).padStart(2, '0');
    const min = String(Math.floor(tot / 6000)).padStart(2, '0');
    return `${min}:${sec},${cs}`;
  };
  const tickSw = () => {
    if (!swRunning) return;
    swElapsed += performance.now() - swLast;
    swLast = performance.now();
    if (swDisp) swDisp.textContent = fmtSw(swElapsed);
    swRaf = requestAnimationFrame(tickSw);
  };
  swStartBtn?.addEventListener('click', () => {
    if (!swRunning) {
      swRunning = true; swLast = performance.now();
      swStartBtn.textContent = 'Stop'; swStartBtn.className = 'round-btn red';
      swLapBtn.textContent = 'Okrążenie'; swLapBtn.disabled = false;
      swRaf = requestAnimationFrame(tickSw);
    } else {
      swRunning = false; cancelAnimationFrame(swRaf);
      swStartBtn.textContent = 'Wznów'; swStartBtn.className = 'round-btn green';
      swLapBtn.textContent = 'Wyzeruj'; swLapBtn.disabled = false;
    }
  });
  swLapBtn?.addEventListener('click', () => {
    if (swRunning) {
      swLaps.unshift({ n: swLaps.length + 1, t: fmtSw(swElapsed) });
      document.getElementById('sw-laps').innerHTML = swLaps.map((l) => `<div class="lap-row"><span>Okrążenie ${l.n}</span><span>${l.t}</span></div>`).join('');
    } else {
      swElapsed = 0; swLaps = [];
      if (swDisp) swDisp.textContent = '00:00,00';
      document.getElementById('sw-laps').innerHTML = '';
      swLapBtn.textContent = 'Okrążenie'; swLapBtn.disabled = true;
      swStartBtn.textContent = 'Start'; swStartBtn.className = 'round-btn green';
    }
  });

  // Minutnik
  let tmRemain = 300, tmRunning = false, tmInt = null;
  const tmRunEl = document.getElementById('timer-run');
  const tmSetupEl = document.getElementById('timer-setup');
  const tmStartBtn = document.getElementById('timer-start');
  const fmtTm = (s) => `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const stopTm = (reset = false) => {
    tmRunning = false; clearInterval(tmInt);
    if (reset) { tmRemain = 300; if (tmSetupEl) tmSetupEl.style.display = ''; if (tmRunEl) tmRunEl.classList.remove('active'); }
    if (tmStartBtn) { tmStartBtn.textContent = 'Start'; tmStartBtn.className = 'round-btn green'; }
  };
  tmStartBtn?.addEventListener('click', () => {
    if (!tmRunning) {
      if (!tmRunEl.classList.contains('active')) {
        tmRemain = Math.max(1, (selHour || 0) * 60 + (selMin || 0));
        if (tmSetupEl) tmSetupEl.style.display = 'none';
        tmRunEl.classList.add('active');
      }
      tmRunEl.textContent = fmtTm(tmRemain);
      tmRunning = true; tmStartBtn.textContent = 'Pauza'; tmStartBtn.className = 'round-btn orange';
      tmInt = setInterval(() => {
        tmRemain -= 1;
        tmRunEl.textContent = fmtTm(Math.max(0, tmRemain));
        if (tmRemain <= 0) { stopTm(true); showToast('Minutnik zakończony'); }
      }, 1000);
    } else stopTm(false);
  });
  document.getElementById('timer-cancel')?.addEventListener('click', () => stopTm(true));

  // ===== Pliki (styl iOS) =====
  let filesTab = 'browse', filesFolder = null, filesHist = [], filesHistIdx = -1;
  const FILES_DATA = {
    'iCloud Drive': [{ name: 'Prezentacja_ZeniOS.pdf', meta: '1,8 MB · Dzisiaj' }, { name: 'Notatki_projektowe.txt', meta: '24 KB · Wczoraj' }],
    'Na tym iPhonie': [{ name: 'Pobrane', folder: true, meta: '2 elementy' }, { name: 'Zrzuty_ekranu', folder: true, meta: '4 elementy' }],
    'Pobrane': [{ name: 'tapeta_pakiet.zip', meta: '12,4 MB · 18 lis' }],
    'Zrzuty_ekranu': [{ name: 'ekran_blokady.png', meta: '1,1 MB · Dzisiaj' }]
  };
  function renderFilesApp(q = '') {
    const ql = q.trim().toLowerCase();
    const browsePane = document.getElementById('files-pane-browse');
    const listPane = document.getElementById('files-pane-list');
    const titleEl = document.getElementById('files-title');
    document.querySelectorAll('#files-tabbar .files-tab').forEach((b) => b.classList.toggle('active', b.dataset.filesTab === filesTab));
    if (document.getElementById('files-back')) document.getElementById('files-back').disabled = filesHistIdx <= 0;
    if (document.getElementById('files-fwd')) document.getElementById('files-fwd').disabled = filesHistIdx >= filesHist.length - 1;

    if (filesFolder || ql) {
      browsePane?.classList.remove('active');
      listPane?.classList.add('active');
      let items = [];
      if (ql) {
        Object.entries(FILES_DATA).forEach(([loc, arr]) => arr.forEach((it) => {
          if (it.name.toLowerCase().includes(ql)) items.push({ ...it, sub: loc });
        }));
        if (titleEl) titleEl.textContent = 'Wyniki';
      } else {
        items = (FILES_DATA[filesFolder] || []).map((it) => ({ ...it, sub: it.meta }));
        if (titleEl) titleEl.textContent = filesFolder;
      }
      listPane.innerHTML = items.length ? items.map((it) => `<div class="files-item" data-fname="${escHtml(it.name)}" data-isfolder="${it.folder ? '1' : '0'}"><span class="files-ico">${it.folder ? '📁' : '📄'}</span><div class="files-item-body"><b>${escHtml(it.name)}</b><span>${escHtml(it.sub || '')}</span></div></div>`).join('') : '<div class="files-empty">Brak plików</div>';
      listPane.querySelectorAll('.files-item[data-isfolder="1"]').forEach((r) => r.addEventListener('click', () => navigateFiles(r.dataset.fname)));
      listPane.querySelectorAll('.files-item[data-isfolder="0"]').forEach((r) => r.addEventListener('click', () => showToast(`Otwarto: ${r.dataset.fname}`)));
      return;
    }

    browsePane?.classList.add('active');
    listPane?.classList.remove('active');
    if (titleEl) titleEl.textContent = filesTab === 'recents' ? 'Ostatnie' : filesTab === 'shared' ? 'Udostępnione' : 'Przeglądaj';
    if (filesTab === 'browse') {
      document.getElementById('files-browse-body').innerHTML = `
        <div class="files-sec-title">Lokalizacje</div>
        <div class="files-card">
          <div class="files-row" data-loc="iCloud Drive"><span class="files-ico">☁️</span><span class="files-row-label">iCloud Drive</span><span class="files-chev">›</span></div>
          <div class="files-row" data-loc="Na tym iPhonie"><span class="files-ico">📱</span><span class="files-row-label">Na tym iPhonie</span><span class="files-chev">›</span></div>
        </div>
        <div class="files-sec-title">Tagi</div>
        <div class="files-card">
          <div class="files-row" data-loc="Pobrane"><span class="files-ico">🔵</span><span class="files-row-label">Niebieski · Pobrane</span><span class="files-chev">›</span></div>
          <div class="files-row" data-loc="Zrzuty_ekranu"><span class="files-ico">🟠</span><span class="files-row-label">Pomarańczowy · Zrzuty</span><span class="files-chev">›</span></div>
        </div>`;
      document.querySelectorAll('#files-browse-body .files-row[data-loc]').forEach((r) => r.addEventListener('click', () => navigateFiles(r.dataset.loc)));
    } else {
      const rec = [...FILES_DATA['iCloud Drive'], ...FILES_DATA['Zrzuty_ekranu']];
      document.getElementById('files-browse-body').innerHTML = `<div class="files-card">${rec.map((it) => `<div class="files-row"><span class="files-ico">📄</span><span class="files-row-label">${escHtml(it.name)}</span></div>`).join('')}</div>`;
    }
  }
  function navigateFiles(folder, push = true) {
    filesFolder = folder;
    if (push) { filesHist = filesHist.slice(0, filesHistIdx + 1); filesHist.push(folder); filesHistIdx = filesHist.length - 1; }
    renderFilesApp(document.getElementById('files-search')?.value || '');
  }
  document.querySelectorAll('#files-tabbar .files-tab').forEach((b) => b.addEventListener('click', () => {
    filesTab = b.dataset.filesTab; filesFolder = null;
    renderFilesApp(document.getElementById('files-search')?.value || '');
  }));
  document.getElementById('files-back')?.addEventListener('click', () => {
    if (filesHistIdx > 0) { filesHistIdx -= 1; filesFolder = filesHist[filesHistIdx]; renderFilesApp(); }
  });
  document.getElementById('files-fwd')?.addEventListener('click', () => {
    if (filesHistIdx < filesHist.length - 1) { filesHistIdx += 1; filesFolder = filesHist[filesHistIdx]; renderFilesApp(); }
  });
  document.getElementById('files-search')?.addEventListener('input', (e) => renderFilesApp(e.target.value));
  document.getElementById('files-more')?.addEventListener('click', () => showToast('Widok listy · ZeniOS'));

  // ===== Notatnik (styl iOS Notes) =====
  const NOTES_KEY = 'zenios_notes_v1';
  let notesArr = (() => {
    try { const r = JSON.parse(localStorage.getItem(NOTES_KEY)); if (Array.isArray(r) && r.length) return r; } catch (_) {}
    return [{ id: 'n1', title: 'Pomysły do ZeniOS', body: '• Dopracować animacje widżetów\n• Dodać więcej tapet\n☐ Przetestować skróty w Centrum sterowania', updated: 'Dzisiaj, 16:30' }];
  })();
  let activeNoteId = null, noteUndoStack = [];
  const saveNotes = () => { try { localStorage.setItem(NOTES_KEY, JSON.stringify(notesArr)); } catch (_) {} };
  const fmtNoteNow = () => {
    const d = new Date();
    return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  function renderNotesList(q = '') {
    const ql = q.trim().toLowerCase();
    const list = document.getElementById('notes-list');
    const cnt = document.getElementById('notes-count');
    if (!list) return;
    const items = notesArr.filter((n) => !ql || n.title.toLowerCase().includes(ql) || n.body.toLowerCase().includes(ql));
    if (cnt) cnt.textContent = `${items.length} ${items.length === 1 ? 'notatka' : 'notatek'}`;
    list.innerHTML = items.length ? items.map((n) => `<div class="note-row" data-nid="${n.id}"><div class="note-row-title">${escHtml(n.title || 'Nowa notatka')}</div><div class="note-row-meta"><span class="note-row-date">${escHtml(n.updated || '')}</span><span class="note-row-prev">${escHtml((n.body || 'Brak dodatkowego tekstu').replace(/\n/g, ' '))}</span></div></div>`).join('') : '<div class="notes-empty">Brak notatek</div>';
    list.querySelectorAll('.note-row').forEach((r) => r.addEventListener('click', () => openNote(r.dataset.nid)));
  }

  function openNote(id) {
    const n = notesArr.find((x) => x.id === id);
    if (!n) return;
    activeNoteId = id;
    noteUndoStack = [{ title: n.title, body: n.body }];
    document.getElementById('note-date').textContent = n.updated || fmtNoteNow();
    document.getElementById('note-title').value = n.title;
    document.getElementById('note-body').value = n.body;
    document.getElementById('note-menu')?.classList.remove('open');
    document.getElementById('notes-list-screen')?.classList.remove('active');
    document.getElementById('notes-edit-screen')?.classList.add('active');
  }

  function commitNoteEdit() {
    const n = notesArr.find((x) => x.id === activeNoteId);
    if (!n) return;
    const t = document.getElementById('note-title')?.value ?? '';
    const b = document.getElementById('note-body')?.value ?? '';
    if (t !== n.title || b !== n.body) {
      noteUndoStack.push({ title: n.title, body: n.body });
      n.title = t; n.body = b; n.updated = fmtNoteNow();
      saveNotes();
    }
  }

  document.getElementById('note-new-btn')?.addEventListener('click', () => {
    const nn = { id: `n-${Date.now()}`, title: '', body: '', updated: fmtNoteNow() };
    notesArr.unshift(nn);
    saveNotes();
    openNote(nn.id);
    setTimeout(() => document.getElementById('note-title')?.focus(), 60);
  });
  const backToNotesList = () => {
    commitNoteEdit();
    document.getElementById('notes-edit-screen')?.classList.remove('active');
    document.getElementById('notes-list-screen')?.classList.add('active');
    renderNotesList(document.getElementById('notes-search')?.value || '');
  };
  document.getElementById('note-back')?.addEventListener('click', backToNotesList);
  document.getElementById('note-done')?.addEventListener('click', backToNotesList);
  document.getElementById('note-undo')?.addEventListener('click', () => {
    const n = notesArr.find((x) => x.id === activeNoteId);
    if (!n || noteUndoStack.length <= 1) return;
    noteUndoStack.pop();
    const prev = noteUndoStack[noteUndoStack.length - 1];
    n.title = prev.title; n.body = prev.body;
    document.getElementById('note-title').value = prev.title;
    document.getElementById('note-body').value = prev.body;
    saveNotes();
  });
  document.getElementById('note-share')?.addEventListener('click', () => {
    const txt = `${document.getElementById('note-title')?.value || ''}\n${document.getElementById('note-body')?.value || ''}`.trim();
    navigator.clipboard?.writeText(txt).catch(() => {});
    showToast('Skopiowano notatkę');
  });
  document.getElementById('note-more')?.addEventListener('click', () => document.getElementById('note-menu')?.classList.toggle('open'));
  document.getElementById('note-delete')?.addEventListener('click', () => {
    notesArr = notesArr.filter((x) => x.id !== activeNoteId);
    saveNotes();
    document.getElementById('note-menu')?.classList.remove('open');
    document.getElementById('notes-edit-screen')?.classList.remove('active');
    document.getElementById('notes-list-screen')?.classList.add('active');
    renderNotesList(document.getElementById('notes-search')?.value || '');
  });
  document.querySelectorAll('#app-notebook [data-fmt]').forEach((btn) => btn.addEventListener('click', () => {
    const ta = document.getElementById('note-body');
    if (!ta) return;
    const fmt = btn.dataset.fmt;
    if (fmt === 'top') { ta.scrollTop = 0; ta.setSelectionRange(0, 0); ta.focus(); return; }
    if (fmt === 'bottom') { ta.scrollTop = ta.scrollHeight; ta.focus(); return; }
    const prefix = fmt === 'check' ? '☐ ' : fmt === 'bullet' ? '• ' : fmt === 'indent' ? '  ' : '';
    const start = ta.selectionStart ?? ta.value.length;
    const lineStart = ta.value.lastIndexOf('\n', start - 1) + 1;
    if (fmt === 'outdent') {
      ta.value = ta.value.slice(0, lineStart) + ta.value.slice(lineStart).replace(/^(  |• |☐ )/, '');
    } else {
      ta.value = ta.value.slice(0, lineStart) + prefix + ta.value.slice(lineStart);
    }
    commitNoteEdit();
    ta.focus();
  }));
  document.getElementById('notes-search')?.addEventListener('input', (e) => renderNotesList(e.target.value));

  // ===== Personalizacja ekranu blokady (zegar + efekt głębi) =====
  const LK_KEY = 'zenios_lockscreen_custom_v1';
  const LK_STYLES = [
    { id: 'slim', name: 'Smukły', weight: 400, width: 85, family: 'system-ui,-apple-system,sans-serif' },
    { id: 'classic', name: 'Klasyczny', weight: 600, width: 100, family: 'system-ui,-apple-system,sans-serif' },
    { id: 'bold', name: 'Pogrubiony', weight: 800, width: 108, family: 'system-ui,-apple-system,sans-serif' },
    { id: 'mono', name: 'Kodowy', weight: 700, width: 100, family: 'ui-monospace,SFMono-Regular,Menlo,monospace' }
  ];
  const LK_FINISHES = [
    { id: 'white', name: 'Biały', fill: '#fff', stroke: 'none', shadow: '0 4px 24px rgba(0,0,0,.35)' },
    { id: 'ice', name: 'Lodowy', fill: '#dff3ff', stroke: 'none', shadow: '0 4px 26px rgba(56,189,248,.35)' },
    { id: 'gold', name: 'Złoty', fill: '#fde68a', stroke: 'none', shadow: '0 4px 24px rgba(245,158,11,.3)' },
    { id: 'glass', name: 'Szkło', fill: 'rgba(255,255,255,.28)', stroke: 'rgba(255,255,255,.85)', shadow: '0 8px 28px rgba(0,0,0,.25)' },
    { id: 'outline', name: 'Kontur', fill: 'transparent', stroke: '#fff', shadow: '0 2px 16px rgba(0,0,0,.3)' },
    { id: 'neon', name: 'Neon', fill: '#a5f3fc', stroke: '#22d3ee', shadow: '0 0 24px rgba(34,211,238,.6)' }
  ];
  const LK_DEF = { style: 'slim', finish: 'white', size: 1, stretch: 1, posMode: 'auto', posY: 0.2, depth: true, wp: null };
  let lkCfg = (() => {
    try { return { ...LK_DEF, ...JSON.parse(localStorage.getItem(LK_KEY) || '{}') }; }
    catch (_) { return { ...LK_DEF }; }
  })();
  const lkDepthCache = new Map();
  let lkToken = 0;

  function getActiveLockWp() {
    if (lkCfg.wp) return lkCfg.wp;
    return state.wallpaper || 'Default_Wallpaper/default_wallpaper_7.jpg';
  }

  function styleLockClockEl(el, cfg, stageH) {
    if (!el) return;
    const st = LK_STYLES.find((s) => s.id === cfg.style) || LK_STYLES[0];
    const fn = LK_FINISHES.find((f) => f.id === cfg.finish) || LK_FINISHES[0];
    const base = Math.max(28, (stageH || 844) * 0.105);
    el.style.fontFamily = st.family;
    el.style.fontWeight = String(st.weight);
    el.style.fontSize = `${(base * cfg.size).toFixed(1)}px`;
    el.style.lineHeight = '0.95';
    el.style.display = 'inline-block';
    el.style.transformOrigin = '50% 35%';
    el.style.transform = `scale(${(st.width / 100).toFixed(3)}, ${cfg.stretch.toFixed(3)})`;
    el.style.color = fn.fill;
    el.style.webkitTextFillColor = fn.fill;
    el.style.webkitTextStroke = fn.stroke === 'none' ? '0' : `1.5px ${fn.stroke}`;
    el.style.textShadow = fn.shadow;
  }

  function positionLockTop(topEl, stageEl, cfg) {
    if (!topEl || !stageEl) return;
    const h = stageEl.clientHeight || 844;
    topEl.style.top = `${Math.round((cfg.posMode === 'manual' ? cfg.posY : 0.11) * h)}px`;
  }

  function coverRect(sw, sh, dw, dh) {
    const r = Math.max(dw / Math.max(1, sw), dh / Math.max(1, sh));
    const w = sw * r, h = sh * r;
    return { x: (dw - w) / 2, y: (dh - h) / 2, w, h };
  }

  function computeDepthMask(img, w, h) {
    const cw = 160, ch = Math.max(1, Math.round((h / Math.max(1, w)) * 160));
    const c = document.createElement('canvas'); c.width = cw; c.height = ch;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const rv = coverRect(img.naturalWidth || w, img.naturalHeight || h, cw, ch);
    ctx.drawImage(img, rv.x, rv.y, rv.w, rv.h);
    const { data } = ctx.getImageData(0, 0, cw, ch);
    const mask = new Float32Array(cw * ch);
    const cx = cw * 0.5, cy = ch * 0.58;
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const i = y * cw + x, p = i * 4;
        const lum = (0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]) / 255;
        const maxC = Math.max(data[p], data[p + 1], data[p + 2]), minC = Math.min(data[p], data[p + 1], data[p + 2]);
        const sat = maxC ? (maxC - minC) / maxC : 0;
        const dist = Math.hypot((x - cx) / (cw * 0.42), (y - cy) / (ch * 0.45));
        const centerBias = Math.max(0, 1 - dist * 0.72);
        const lowFloor = y > ch * 0.45 ? 0.35 : 0.12;
        const s = (lum * 0.45 + sat * 0.25 + centerBias * 0.55) * (y > ch * 0.35 ? 1.15 : 0.75);
        mask[i] = s > 0.52 ? Math.min(1, (s - 0.45) * 2.2) : (s > 0.38 && y > ch * 0.65 ? lowFloor : 0);
      }
    }
    const out = document.createElement('canvas'); out.width = w; out.height = h;
    const octx = out.getContext('2d');
    const mc = document.createElement('canvas'); mc.width = cw; mc.height = ch;
    const mctx = mc.getContext('2d');
    const mImg = mctx.createImageData(cw, ch);
    for (let i = 0; i < mask.length; i++) {
      const a = Math.round(mask[i] * 255);
      mImg.data[i * 4] = 255; mImg.data[i * 4 + 1] = 255; mImg.data[i * 4 + 2] = 255; mImg.data[i * 4 + 3] = a;
    }
    mctx.putImageData(mImg, 0, 0);
    octx.filter = 'blur(6px)';
    const r = coverRect(img.naturalWidth || w, img.naturalHeight || h, w, h);
    octx.drawImage(img, r.x, r.y, r.w, r.h);
    octx.globalCompositeOperation = 'destination-in';
    octx.drawImage(mc, 0, 0, w, h);
    octx.filter = 'none';
    octx.globalCompositeOperation = 'source-over';
    return out;
  }

  function renderDepthOnCanvas(canvas, img, w, h, key) {
    if (!canvas || !w || !h) return;
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    if (!lkCfg.depth || !img || !img.complete || !img.naturalWidth) return;
    const cacheKey = `${key}_${w}x${h}`;
    let layer = lkDepthCache.get(cacheKey);
    if (!layer) { layer = computeDepthMask(img, w, h); lkDepthCache.set(cacheKey, layer); }
    ctx.drawImage(layer, 0, 0, w, h);
  }

  function setDepthNote(stateName, detail = '') {
    const note = document.getElementById('lk-depth-note');
    if (!note) return;
    note.dataset.state = stateName;
    if (stateName === 'off') note.textContent = 'Efekt głębi jest wyłączony.';
    else if (stateName === 'loading') note.textContent = 'Analizowanie tapety pod kątem głębi…';
    else if (stateName === 'ok') note.textContent = detail || 'Aktywny: pierwszy plan tapety zachodzi na dolną część zegara.';
    else note.textContent = detail || 'Wyłączony: brak wyraźnego pierwszego planu na tej tapecie.';
  }

  function applyLockscreenVisuals() {
    const src = getActiveLockWp();
    const realImg = document.getElementById('lock-wallpaper');
    const realClock = document.getElementById('lock-clock');
    const realTop = document.querySelector('#lockscreen-layer .lock-top-block');
    const realDepth = document.getElementById('lock-depth');
    const realLayer = document.getElementById('lockscreen-layer');

    const prevWall = document.getElementById('lk-prev-wall');
    const prevClock = document.getElementById('lk-prev-clock');
    const prevDate = document.getElementById('lk-prev-date');
    const prevTop = document.getElementById('lk-prev-top');
    const prevDepth = document.getElementById('lk-prev-depth');
    const stage = document.getElementById('lk-stage');

    if (realImg && realImg.src !== new URL(src, location.href).href) realImg.src = src;
    if (prevWall && prevWall.src !== new URL(src, location.href).href) prevWall.src = src;
    if (prevDate && document.getElementById('lock-date')) prevDate.textContent = document.getElementById('lock-date').textContent;
    if (prevClock && realClock) prevClock.textContent = realClock.textContent;

    styleLockClockEl(realClock, lkCfg, realLayer?.clientHeight || 844);
    positionLockTop(realTop, realLayer, lkCfg);
    if (stage) {
      const sh = stage.clientHeight || Math.round((stage.clientWidth || 150) * (844 / 390));
      styleLockClockEl(prevClock, lkCfg, sh);
      positionLockTop(prevTop, stage, lkCfg);
    }

    const rowVal = document.getElementById('lk-row-value');
    const stObj = LK_STYLES.find((s) => s.id === lkCfg.style) || LK_STYLES[0];
    if (rowVal) rowVal.textContent = `${stObj.name} · ${lkCfg.depth ? 'Głębia' : 'Bez głębi'}`;

    if (!lkCfg.depth) {
      if (realDepth) realDepth.getContext('2d').clearRect(0, 0, realDepth.width, realDepth.height);
      if (prevDepth) prevDepth.getContext('2d').clearRect(0, 0, prevDepth.width, prevDepth.height);
      setDepthNote('off');
      return;
    }

    const tok = ++lkToken;
    setDepthNote('loading');
    const loader = new Image();
    loader.crossOrigin = 'anonymous';
    loader.onload = () => {
      if (tok !== lkToken) return;
      const rw = realLayer?.clientWidth || 390, rh = realLayer?.clientHeight || 844;
      renderDepthOnCanvas(realDepth, loader, rw, rh, src);
      if (stage) {
        const pw = stage.clientWidth || 150, ph = stage.clientHeight || Math.round(pw * (844 / 390));
        renderDepthOnCanvas(prevDepth, loader, pw, ph, src);
      }
      setDepthNote('ok');
    };
    loader.onerror = () => {
      if (tok !== lkToken) return;
      setDepthNote('off', 'Nie udało się wczytać tapety do podglądu głębi.');
    };
    loader.src = src;
  }

  function initLockscreenCustomizer() {
    const styleRow = document.getElementById('lk-style-row');
    const finishRow = document.getElementById('lk-finish-row');
    const wpGridEl = document.getElementById('lk-wp-grid');
    if (!styleRow || !finishRow || !wpGridEl) return;

    styleRow.innerHTML = LK_STYLES.map((s) => `<button type="button" class="lk-chip${lkCfg.style === s.id ? ' active' : ''}" data-lk-style="${s.id}" style="font-family:${s.family};font-weight:${s.weight}">${s.name}</button>`).join('');
    finishRow.innerHTML = LK_FINISHES.map((f) => `<button type="button" class="lk-chip${lkCfg.finish === f.id ? ' active' : ''}" data-lk-finish="${f.id}"><span class="lk-swatch" style="background:${f.fill === 'transparent' ? 'rgba(255,255,255,.12)' : f.fill};border-color:${f.stroke === 'none' ? 'rgba(255,255,255,.35)' : f.stroke}"></span>${f.name}</button>`).join('');

    const activeWp = getActiveLockWp();
    wpGridEl.innerHTML = WALLPAPERS.map((w) => `<button type="button" class="lk-wp-item${activeWp === w.src ? ' active' : ''}" data-lk-wp="${w.src}"><img src="${w.src}" alt="${w.label}" /><span>${w.label.replace('default_wallpaper_', 'Tapeta ')}</span></button>`).join('') +
      `<button type="button" class="lk-wp-item lk-wp-upload" id="lk-upload-btn"><span>+ Własna</span></button>`;

    const saveLk = () => { try { localStorage.setItem(LK_KEY, JSON.stringify(lkCfg)); } catch (_) {} applyLockscreenVisuals(); };

    styleRow.querySelectorAll('[data-lk-style]').forEach((b) => b.addEventListener('click', () => {
      lkCfg.style = b.dataset.lkStyle;
      styleRow.querySelectorAll('.lk-chip').forEach((x) => x.classList.toggle('active', x === b));
      saveLk();
    }));
    finishRow.querySelectorAll('[data-lk-finish]').forEach((b) => b.addEventListener('click', () => {
      lkCfg.finish = b.dataset.lkFinish;
      finishRow.querySelectorAll('.lk-chip').forEach((x) => x.classList.toggle('active', x === b));
      saveLk();
    }));
    wpGridEl.querySelectorAll('[data-lk-wp]').forEach((b) => b.addEventListener('click', () => {
      lkCfg.wp = b.dataset.lkWp;
      initLockscreenCustomizer();
      saveLk();
    }));
    document.getElementById('lk-upload-btn')?.addEventListener('click', () => document.getElementById('lk-upload')?.click());
    document.getElementById('lk-upload')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => { lkCfg.wp = String(reader.result); initLockscreenCustomizer(); saveLk(); };
      reader.readAsDataURL(file);
    });

    const sizeIn = document.getElementById('lk-size');
    const stretchIn = document.getElementById('lk-stretch');
    const posYIn = document.getElementById('lk-posy');
    const depthTog = document.getElementById('lk-depth-toggle');
    if (sizeIn) {
      sizeIn.value = String(lkCfg.size);
      document.getElementById('lk-size-val').textContent = `${Math.round(lkCfg.size * 100)}%`;
      sizeIn.oninput = () => { lkCfg.size = parseFloat(sizeIn.value); document.getElementById('lk-size-val').textContent = `${Math.round(lkCfg.size * 100)}%`; saveLk(); };
    }
    if (stretchIn) {
      stretchIn.value = String(lkCfg.stretch);
      document.getElementById('lk-stretch-val').textContent = `${Math.round(lkCfg.stretch * 100)}%`;
      stretchIn.oninput = () => { lkCfg.stretch = parseFloat(stretchIn.value); document.getElementById('lk-stretch-val').textContent = `${Math.round(lkCfg.stretch * 100)}%`; saveLk(); };
    }
    if (posYIn) {
      posYIn.value = String(lkCfg.posY);
      document.getElementById('lk-posy-val').textContent = `${Math.round(lkCfg.posY * 100)}%`;
      posYIn.oninput = () => { lkCfg.posY = parseFloat(posYIn.value); document.getElementById('lk-posy-val').textContent = `${Math.round(lkCfg.posY * 100)}%`; saveLk(); };
    }
    if (depthTog) {
      depthTog.checked = !!lkCfg.depth;
      depthTog.onchange = () => { lkCfg.depth = depthTog.checked; saveLk(); };
    }

    document.querySelectorAll('[data-lk-pos]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.lkPos === lkCfg.posMode);
      btn.onclick = () => {
        lkCfg.posMode = btn.dataset.lkPos;
        document.querySelectorAll('[data-lk-pos]').forEach((x) => x.classList.toggle('active', x === btn));
        posYIn?.closest('.lk-slider-row')?.classList.toggle('disabled', lkCfg.posMode !== 'manual');
        if (posYIn) posYIn.disabled = lkCfg.posMode !== 'manual';
        saveLk();
      };
    });
    if (posYIn) {
      posYIn.closest('.lk-slider-row')?.classList.toggle('disabled', lkCfg.posMode !== 'manual');
      posYIn.disabled = lkCfg.posMode !== 'manual';
    }
    document.getElementById('lk-show-lock')?.addEventListener('click', () => {
      window.ZeniLockscreen?.lockNow?.();
    });
    document.getElementById('lk-reset')?.addEventListener('click', () => {
      lkCfg = { ...LK_DEF };
      initLockscreenCustomizer();
      saveLk();
    });
    applyLockscreenVisuals();
  }

  window.ZeniLockscreenCustom = { sync: () => { initLockscreenCustomizer(); applyLockscreenVisuals(); } };

  // Inicjalizacja rdzenia
  applyTheme();
  applyBrightness();
  applyVolume();
  applyWallpaper();
  applyNavMode();
  updateSettingsLabels();
  updateStatusBar();
  renderWidgets();
  renderHomeApps();
  renderInstalledAppsList();
  renderMsgList();
  renderCalendar();
  renderClockApp();
  renderFilesApp();
  renderNotesList();
  initLockscreenCustomizer();
  if (state.torch && torchGlow) {
    torchGlow.classList.add('active');
  }

  window.setInterval(updateStatusBar, 15000);

  window.ZeniSystem = {
    getLockSettings: function () {
      return {
        method: state.lock.method,
        pin: state.lock.pin,
        password: state.lock.password,
        pattern: state.lock.pattern,
        wallpaper: state.wallpaper
      };
    },
    getLockWallpaper: function () {
      return getActiveLockWp();
    },
    isLockEnabled: function () {
      return true;
    },
    onUnlocked: function () {
      if (wallpaperLayer) {
        wallpaperLayer.classList.add('active');
        wallpaperLayer.classList.add('unlocked');
      }
      renderWidgets();
      renderHomeApps();
      applyLockscreenVisuals();
    },
    openApp,
    goHome,
    toggleTorch
  };
})();
