const PHONE_W = 390;
const PHONE_H = 844;
const LOAD_DURATION_MS = 5000;

const scaleBox = document.getElementById('scale-box');
const videoLayer = document.getElementById('video-layer');
const stillLayer = document.getElementById('still-layer');
const doneScreen = document.getElementById('done-screen');
const bootVideo = document.getElementById('boot-video');
const loadingStill = document.getElementById('loading-still');

let movedToStill = false;
let doneTriggered = false;
let fallbackTimer = null;
let loadTimer = null;

function fitToViewport() {
  const scale = Math.min(1, window.innerWidth / PHONE_W, window.innerHeight / PHONE_H);
  scaleBox.style.transform = `scale(${scale})`;
}

function showLayer(target) {
  [videoLayer, stillLayer, doneScreen].forEach((el) => {
    el.classList.toggle('active', el === target);
  });
}

function finishLoading() {
  if (doneTriggered) return;
  doneTriggered = true;
  if (loadTimer) {
    clearTimeout(loadTimer);
    loadTimer = null;
  }
  bootVideo.pause();
  loadingStill.style.animation = 'none';
  showLayer(doneScreen);
}

function startStillPhase() {
  if (movedToStill) return;
  movedToStill = true;
  if (fallbackTimer) {
    clearTimeout(fallbackTimer);
    fallbackTimer = null;
  }
  bootVideo.pause();
  showLayer(stillLayer);
  loadTimer = setTimeout(finishLoading, LOAD_DURATION_MS);
}

function initLoading() {
  fitToViewport();
  showLayer(videoLayer);

  bootVideo.addEventListener('ended', startStillPhase, { once: true });

  const sources = ['LoadingVideo', 'LoadingVideo.mp4', 'LoadingVideo.webm'];
  let idx = 0;

  function tryNextVideo() {
    if (movedToStill || idx >= sources.length) {
      startStillPhase();
      return;
    }
    bootVideo.src = sources[idx++];
    bootVideo.load();
    bootVideo.play().catch(() => {
      if (idx < sources.length) {
        tryNextVideo();
      } else {
        startStillPhase();
      }
    });
  }

  bootVideo.addEventListener('error', () => {
    if (!movedToStill) {
      tryNextVideo();
    }
  });

  tryNextVideo();
  fallbackTimer = setTimeout(startStillPhase, 12000);
}

window.addEventListener('resize', fitToViewport);
initLoading();
```[cite: 6]

Wklej oba pliki obok siebie w tym samym folderze co `Zenios_loading.png` oraz `LoadingVideo`[cite: 5, 6, 7]. Co chcesz zmienić dalej — np. czas czekania na `Zenios_loading.png` albo siłę tego lekkiego poświatowego efektu?
