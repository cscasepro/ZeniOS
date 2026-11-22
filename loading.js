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

let loadTimer = null;
let currentWallpaperIndex = DEFAULT_WALLPAPER_INDEX;

function showLayer(target) {
  [stillLayer, wallpaperLayer].forEach((el) => {
    el.classList.toggle('active', el === target);
  });
}

function setWallpaper(index) {
  if (index < 0 || index >= ZENIOS_WALLPAPERS.length) return;
  currentWallpaperIndex = index;

  const basePath = ZENIOS_WALLPAPERS[index];
  const candidates = [basePath, `${basePath}.png`, `${basePath}.jpg`, `${basePath}.webp`];
  let attempt = 0;

  function tryLoad() {
    if (attempt >= candidates.length) return;
    systemWallpaper.src = candidates[attempt++];
  }

  systemWallpaper.onerror = tryLoad;
  tryLoad();
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
