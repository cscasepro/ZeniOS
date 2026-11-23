/* Ekran ładowania ZeniOS: pokazuje plik Boot_Loading/Zenios_loading.png przez ok. 3 sekundy,
 * płynnie zanika i przechodzi na ekran blokady (lub odblokowany pulpit, gdy blokada jest wyłączona). */

(function () {
  const stillLayer = document.getElementById('still-layer');
  const stillImg = document.getElementById('loading-still');
  const lockscreenLayer = document.getElementById('lockscreen-layer');
  const wallpaperLayer = document.getElementById('wallpaper-layer');

  function finishLoading() {
    if (!stillLayer || stillLayer.dataset.done === '1') return;
    stillLayer.dataset.done = '1';
    stillLayer.classList.add('fade-out');

    const lockDisabled = window.ZeniSystem && typeof window.ZeniSystem.isLockEnabled === 'function'
      ? !window.ZeniSystem.isLockEnabled()
      : false;

    if (lockDisabled) {
      if (wallpaperLayer) {
        wallpaperLayer.classList.add('active');
        wallpaperLayer.classList.add('unlocked');
      }
      if (lockscreenLayer) {
        lockscreenLayer.classList.remove('active');
      }
    } else if (lockscreenLayer) {
      lockscreenLayer.classList.add('active');
      if (window.ZeniLockscreen && typeof window.ZeniLockscreen.refresh === 'function') {
        window.ZeniLockscreen.refresh();
      }
    }

    window.setTimeout(() => {
      stillLayer.classList.remove('active');
    }, 650);
  }

  function startTimer() {
    window.setTimeout(finishLoading, 3000);
  }

  if (stillImg && stillImg.complete) {
    startTimer();
  } else if (stillImg) {
    stillImg.addEventListener('load', startTimer, { once: true });
    stillImg.addEventListener('error', startTimer, { once: true });
    window.setTimeout(finishLoading, 4200);
  } else {
    startTimer();
  }
})();
