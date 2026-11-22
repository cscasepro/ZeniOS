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

let loadTimer = null;
let currentWallpaperIndex = DEFAULT_WALLPAPER_INDEX;
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

  if (domRefs.systemWallpaper) {
    loadImageWithFallback(domRefs.systemWallpaper, ZENIOS_WALLPAPERS[index]);
  }
  if (domRefs.currentWpLabel) {
    domRefs.currentWpLabel.textContent = `default_wallpaper_${index + 1}`;
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

function openApp(appId) {
  if (!appId) return;
  domRefs.appViews.forEach((view) => {
    view.classList.toggle('open', view.id === appId);
  });
}

function closeAllApps() {
  domRefs.appViews.forEach((view) => {
    view.classList.remove('open');
  });
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

  domRefs.closeAppTriggers.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeAllApps();
    });
  });
}

function bindGalleryTabs() {
  const galleryMessages = {
    all: 'Brak pozycji',
    photos: 'Brak obrazów',
    videos: 'Brak klipów',
    albums: 'Brak kolekcji',
    search: 'Brak wyników'
  };

  domRefs.galTabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-gal-tab');
      domRefs.galTabButtons.forEach((b) => {
        b.classList.toggle('active', b.getAttribute('data-gal-tab') === tab);
      });
      if (domRefs.galleryEmptyText) {
        domRefs.galleryEmptyText.textContent = galleryMessages[tab] || 'Brak pozycji';
      }
      if (domRefs.galleryRecentCount) {
        domRefs.galleryRecentCount.textContent = '0 obrazów, 0 klipów';
      }
    });
  });
}

function bindSettingsFeatures() {
  const { settingsSearch, openWallpaperPicker, wallpaperDrawer } = domRefs;

  if (settingsSearch) {
    settingsSearch.addEventListener('input', () => {
      const q = settingsSearch.value.trim().toLowerCase();
      document.querySelectorAll('.settings-group[data-group]').forEach((group) => {
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

  if (openWallpaperPicker && wallpaperDrawer) {
    openWallpaperPicker.addEventListener('click', () => {
      wallpaperDrawer.classList.toggle('open');
    });
  }
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
}

function cacheDom() {
  domRefs = {
    stillLayer: document.getElementById('still-layer'),
    wallpaperLayer: document.getElementById('wallpaper-layer'),
    loadingStill: document.getElementById('loading-still'),
    systemWallpaper: document.getElementById('system-wallpaper'),
    liquidDock: document.getElementById('liquid-dock'),
    appViews: document.querySelectorAll('.app-view'),
    openAppTriggers: document.querySelectorAll('[data-open-app]'),
    closeAppTriggers: document.querySelectorAll('[data-close-app]'),
    galTabButtons: document.querySelectorAll('[data-gal-tab]'),
    galleryEmptyText: document.getElementById('gallery-empty-text'),
    galleryRecentCount: document.getElementById('gallery-recent-count'),
    settingsSearch: document.getElementById('settings-search'),
    openWallpaperPicker: document.getElementById('open-wallpaper-picker'),
    wallpaperDrawer: document.getElementById('wallpaper-drawer'),
    wpGrid: document.getElementById('wp-grid'),
    currentWpLabel: document.getElementById('current-wp-label')
  };
}

function initSystem() {
  cacheDom();
  bindAppNavigation();
  bindGalleryTabs();
  bindSettingsFeatures();
  setWallpaper(DEFAULT_WALLPAPER_INDEX);
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
