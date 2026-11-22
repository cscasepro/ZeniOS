const PHONE_W = 390;
const PHONE_H = 844;
const LOAD_DURATION_MS = 5000;

const scaleBox = document.getElementById('scale-box');
const stillLayer = document.getElementById('still-layer');
const doneScreen = document.getElementById('done-screen');
const loadingStill = document.getElementById('loading-still');

let loadTimer = null;

function fitToViewport() {
  const scale = Math.min(1, window.innerWidth / PHONE_W, window.innerHeight / PHONE_H);
  scaleBox.style.transform = `scale(${scale})`;
}

function showLayer(target) {
  [stillLayer, doneScreen].forEach((el) => {
    el.classList.toggle('active', el === target);
  });
}

function finishLoading() {
  if (loadTimer) {
    clearTimeout(loadTimer);
    loadTimer = null;
  }
  loadingStill.style.animation = 'none';
  showLayer(doneScreen);
}

function initLoading() {
  fitToViewport();
  showLayer(stillLayer);
  loadTimer = setTimeout(finishLoading, LOAD_DURATION_MS);
}

window.addEventListener('resize', fitToViewport);
initLoading();
