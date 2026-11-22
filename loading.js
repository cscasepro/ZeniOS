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

const stillLayer = document.getElementById('still-layer');
const wallpaperLayer = document.getElementById('wallpaper-layer');
const loadingStill = document.getElementById('loading-still');
const systemWallpaper = document.getElementById('system-wallpaper');
const liquidDock = document.getElementById('liquid-dock');

const appViews = document.querySelectorAll('.app-view');
const openAppTriggers = document.querySelectorAll('[data-open-app]');
const closeAppTriggers = document.querySelectorAll('[data-close-app]');

const galTabButtons = document.querySelectorAll('[data-gal-tab]');
const galleryEmptyText = document.getElementById('gallery-empty-text');
const galleryRecentCount = document.getElementById('gallery-recent-count');

const settingsSearch = document.getElementById('settings-search');
const openWallpaperPicker = document.getElementById('open-wallpaper-picker');
const wallpaperDrawer = document.getElementById('wallpaper-drawer');
const wpGrid = document.getElementById('wp-grid');
const currentWpLabel = document.getElementById('current-wp-label');

let loadTimer = null;
let currentWallpaperIndex = DEFAULT_WALLPAPER_INDEX;

function showLayer(target) {
  [stillLayer, wallpaperLayer].forEach((el) => {
    el.classList.toggle('active', el === target);
  });
}

function resolveWallpaperCandidates(basePath) {
  return [basePath, `${basePath}.png`, `${basePath}.jpg`, `${basePath}.webp`];
}

function loadImageWithFallback(imgEl, basePath) {
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
  loadImageWithFallback(systemWallpaper, ZENIOS_WALLPAPERS[index]);
  currentWpLabel.textContent = `default_wallpaper_${index + 1}`;
  renderWallpaperPicker();
}

function renderWallpaperPicker() {
  if (!wpGrid) return;
  wpGrid.innerHTML = '';
  ZENIOS_WALLPAPERS.forEach((basePath, idx) => {
    const btn = document.createElement('div');
    btn.className = `wp-choice${idx === currentWallpaperIndex ? ' active' : ''}`;
    btn.title = `default_wallpaper_${idx + 1}`;

    const thumb = document.createElement('img');
    thumb.alt = `Tapeta ${idx + 1}`;
    loadImageWithFallback(thumb, basePath);

    btn.addEventListener('click', () => setWallpaper(idx));
    btn.appendChild(thumb);
    wpGrid.appendChild(btn);
  });
}

function openApp(appId) {
  appViews.forEach((view) => {
    view.classList.toggle('open', view.id === appId);
  });
}

function closeAllApps() {
  appViews.forEach((view) => view.classList.remove('open'));
}

openAppTriggers.forEach((el) => {
  const targetId = el.getAttribute('data-open-app');
  el.addEventListener('click', () => openApp(targetId));
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openApp(targetId);
    }
  });
});

closeAppTriggers.forEach((btn) => {
  btn.addEventListener('click', closeAllApps);
});

const galleryMessages = {
  all: 'Brak pozycji',
  photos: 'Brak obrazów',
  videos: 'Brak klipów',
  albums: 'Brak kolekcji',
  search: 'Brak wyników'
};

galTabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const tab = btn.getAttribute('data-gal-tab');
    galTabButtons.forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-gal-tab') === tab);
    });
    if (galleryEmptyText) {
      galleryEmptyText.textContent = galleryMessages[tab] || 'Brak pozycji';
    }
    if (galleryRecentCount) {
      galleryRecentCount.textContent = '0 obrazów, 0 klipów';
    }
  });
});

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

function finishLoading() {
  if (loadTimer) {
    clearTimeout(loadTimer);
    loadTimer = null;
  }
  loadingStill.style.animation = 'none';
  showLayer(wallpaperLayer);
  liquidDock.classList.add('visible');
}

function initSystem() {
  setWallpaper(DEFAULT_WALLPAPER_INDEX);
  showLayer(stillLayer);
  liquidDock.classList.remove('visible');
  loadTimer = setTimeout(finishLoading, LOAD_DURATION_MS);
}

initSystem();
