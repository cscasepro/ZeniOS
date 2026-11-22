const LOAD_DURATION_MS = 5000;
const AUTO_HIDE_NAV_MS = 5000;

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

let loadTimer = null;
let navIdleTimer = null;
let currentWallpaperIndex = DEFAULT_WALLPAPER_INDEX;
let currentNavMode = 'gestures';
let domRefs = {};

function showLayer(target) {
  const { stillLayer, wallpaperLayer } = domRefs;
  [stillLayer, wallpaperLayer].forEach((el) => {
    if (!el) return;
    el.classList.toggle('active', el === target);
  });
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

function wakeSystemNav() {
  const overlay = domRefs.systemNavOverlay;
  if (!overlay) return;

  if (navIdleTimer) {
    clearTimeout(navIdleTimer);
    navIdleTimer = null;
  }

  const appOpen = isAnyAppOpen();
  overlay.classList.toggle('in-app', appOpen);
  overlay.classList.remove('auto-hidden');

  if (appOpen) {
    navIdleTimer = setTimeout(() => {
      overlay.classList.add('auto-hidden');
    }, AUTO_HIDE_NAV_MS);
  }
}

function bindSystemNavAutoHide() {
  const events = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'wheel'];
  events.forEach((evtName) => {
    document.addEventListener(evtName, wakeSystemNav, { passive: true });
  });
}

function openSettingsSubscreen(screenId) {
  [domRefs.settingsMain, domRefs.settingsWallpaper, domRefs.settingsSystemNav].forEach((el) => {
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

  if (domRefs.systemNavOverlay) {
    domRefs.systemNavOverlay.classList.toggle('mode-gestures', currentNavMode === 'gestures');
    domRefs.systemNavOverlay.classList.toggle('mode-buttons', currentNavMode === 'buttons');
  }

  wakeSystemNav();
}

function handleBackAction() {
  const settingsOpen = domRefs.settingsView?.classList.contains('open');
  const subscreenActive =
    domRefs.settingsWallpaper?.classList.contains('active') ||
    domRefs.settingsSystemNav?.classList.contains('active');

  if (settingsOpen && subscreenActive) {
    openSettingsSubscreen('settings-main');
  } else {
    closeAllApps();
  }
}

function openApp(appId) {
  if (!appId) return;
  if (appId === 'app-settings') {
    openSettingsSubscreen('settings-main');
  }
  domRefs.appViews.forEach((view) => {
    view.classList.toggle('open', view.id === appId);
  });
  wakeSystemNav();
}

function closeAllApps() {
  domRefs.appViews.forEach((view) => {
    view.classList.remove('open');
  });
  openSettingsSubscreen('settings-main');
  wakeSystemNav();
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

  domRefs.gestureHomeBtn?.addEventListener('click', closeAllApps);
  domRefs.sysBtnHome?.addEventListener('click', closeAllApps);
  domRefs.sysBtnRecents?.addEventListener('click', closeAllApps);
  domRefs.sysBtnBack?.addEventListener('click', handleBackAction);
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
    settingsBackButtons,
    airplaneToggle,
    wifiStatusValue,
    btStatusValue,
    navModeOptions
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
}

function finishLoading() {
  if (loadTimer) {
    clearTimeout(loadTimer);
    loadTimer = null;
  }
  if (domRefs.loadingStill) {
    domRefs.loadingStill.style.animation = 'none';
  }
  showLayer(domRefs.wallpaperLayer);
  if (domRefs.liquidDock) {
    domRefs.liquidDock.classList.add('visible');
  }
  wakeSystemNav();
}

function cacheDom() {
  domRefs = {
    stillLayer: document.getElementById('still-layer'),
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
    settingsBackButtons: document.querySelectorAll('[data-settings-back]'),
    settingsSearch: document.getElementById('settings-search'),
    airplaneToggle: document.getElementById('airplane-toggle'),
    wifiStatusValue: document.getElementById('wifi-status-value'),
    btStatusValue: document.getElementById('bt-status-value'),
    openWallpaperPicker: document.getElementById('open-wallpaper-picker'),
    openSystemNavPicker: document.getElementById('open-system-nav-picker'),
    currentNavLabel: document.getElementById('current-nav-label'),
    navModeOptions: document.querySelectorAll('#nav-mode-options .selectable-option'),
    wpGrid: document.getElementById('wp-grid'),
    wallpaperPreviewImg: document.getElementById('wallpaper-preview-img'),
    wallpaperPreviewName: document.getElementById('wallpaper-preview-name'),
    currentWpLabel: document.getElementById('current-wp-label'),
    systemNavOverlay: document.getElementById('system-nav-overlay'),
    gestureHomeBtn: document.getElementById('gesture-home-btn'),
    sysBtnBack: document.getElementById('sys-btn-back'),
    sysBtnHome: document.getElementById('sys-btn-home'),
    sysBtnRecents: document.getElementById('sys-btn-recents')
  };
}

function initSystem() {
  cacheDom();
  bindAppNavigation();
  bindGalleryFeatures();
  bindSettingsFeatures();
  bindSystemNavAutoHide();
  setWallpaper(DEFAULT_WALLPAPER_INDEX);
  setSystemNavMode(currentNavMode);
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
}const LOAD_DURATION_MS = 5000;
const AUTO_HIDE_NAV_MS = 5000;

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

let loadTimer = null;
let navIdleTimer = null;
let currentWallpaperIndex = DEFAULT_WALLPAPER_INDEX;
let currentNavMode = 'gestures';
let domRefs = {};

function showLayer(target) {
  const { stillLayer, wallpaperLayer } = domRefs;
  [stillLayer, wallpaperLayer].forEach((el) => {
    if (!el) return;
    el.classList.toggle('active', el === target);
  });
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

function wakeSystemNav() {
  const overlay = domRefs.systemNavOverlay;
  if (!overlay) return;

  if (navIdleTimer) {
    clearTimeout(navIdleTimer);
    navIdleTimer = null;
  }

  const appOpen = isAnyAppOpen();
  overlay.classList.toggle('in-app', appOpen);
  overlay.classList.remove('auto-hidden');

  if (appOpen) {
    navIdleTimer = setTimeout(() => {
      overlay.classList.add('auto-hidden');
    }, AUTO_HIDE_NAV_MS);
  }
}

function bindSystemNavAutoHide() {
  const events = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'wheel'];
  events.forEach((evtName) => {
    document.addEventListener(evtName, wakeSystemNav, { passive: true });
  });
}

function openSettingsSubscreen(screenId) {
  [domRefs.settingsMain, domRefs.settingsWallpaper, domRefs.settingsSystemNav].forEach((el) => {
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

  if (domRefs.systemNavOverlay) {
    domRefs.systemNavOverlay.classList.toggle('mode-gestures', currentNavMode === 'gestures');
    domRefs.systemNavOverlay.classList.toggle('mode-buttons', currentNavMode === 'buttons');
  }

  wakeSystemNav();
}

function handleBackAction() {
  const settingsOpen = domRefs.settingsView?.classList.contains('open');
  const subscreenActive =
    domRefs.settingsWallpaper?.classList.contains('active') ||
    domRefs.settingsSystemNav?.classList.contains('active');

  if (settingsOpen && subscreenActive) {
    openSettingsSubscreen('settings-main');
  } else {
    closeAllApps();
  }
}

function openApp(appId) {
  if (!appId) return;
  if (appId === 'app-settings') {
    openSettingsSubscreen('settings-main');
  }
  domRefs.appViews.forEach((view) => {
    view.classList.toggle('open', view.id === appId);
  });
  wakeSystemNav();
}

function closeAllApps() {
  domRefs.appViews.forEach((view) => {
    view.classList.remove('open');
  });
  openSettingsSubscreen('settings-main');
  wakeSystemNav();
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

  domRefs.gestureHomeBtn?.addEventListener('click', closeAllApps);
  domRefs.sysBtnHome?.addEventListener('click', closeAllApps);
  domRefs.sysBtnRecents?.addEventListener('click', closeAllApps);
  domRefs.sysBtnBack?.addEventListener('click', handleBackAction);
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
    settingsBackButtons,
    airplaneToggle,
    wifiStatusValue,
    btStatusValue,
    navModeOptions
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
}

function finishLoading() {
  if (loadTimer) {
    clearTimeout(loadTimer);
    loadTimer = null;
  }
  if (domRefs.loadingStill) {
    domRefs.loadingStill.style.animation = 'none';
  }
  showLayer(domRefs.wallpaperLayer);
  if (domRefs.liquidDock) {
    domRefs.liquidDock.classList.add('visible');
  }
  wakeSystemNav();
}

function cacheDom() {
  domRefs = {
    stillLayer: document.getElementById('still-layer'),
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
    settingsBackButtons: document.querySelectorAll('[data-settings-back]'),
    settingsSearch: document.getElementById('settings-search'),
    airplaneToggle: document.getElementById('airplane-toggle'),
    wifiStatusValue: document.getElementById('wifi-status-value'),
    btStatusValue: document.getElementById('bt-status-value'),
    openWallpaperPicker: document.getElementById('open-wallpaper-picker'),
    openSystemNavPicker: document.getElementById('open-system-nav-picker'),
    currentNavLabel: document.getElementById('current-nav-label'),
    navModeOptions: document.querySelectorAll('#nav-mode-options .selectable-option'),
    wpGrid: document.getElementById('wp-grid'),
    wallpaperPreviewImg: document.getElementById('wallpaper-preview-img'),
    wallpaperPreviewName: document.getElementById('wallpaper-preview-name'),
    currentWpLabel: document.getElementById('current-wp-label'),
    systemNavOverlay: document.getElementById('system-nav-overlay'),
    gestureHomeBtn: document.getElementById('gesture-home-btn'),
    sysBtnBack: document.getElementById('sys-btn-back'),
    sysBtnHome: document.getElementById('sys-btn-home'),
    sysBtnRecents: document.getElementById('sys-btn-recents')
  };
}

function initSystem() {
  cacheDom();
  bindAppNavigation();
  bindGalleryFeatures();
  bindSettingsFeatures();
  bindSystemNavAutoHide();
  setWallpaper(DEFAULT_WALLPAPER_INDEX);
  setSystemNavMode(currentNavMode);
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
