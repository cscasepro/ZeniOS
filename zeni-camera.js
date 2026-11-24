/* =====================================================================
   ZeniOS — Aparat (window.ZeniCamera)
   ---------------------------------------------------------------------
   • pełnoekranowy podgląd z kamery (getUserMedia), działa też z ekranu
     blokady — bez odblokowywania telefonu
   • tryby: Zdjęcie / Portret / Panorama
   • obróbka zdjęcia: łagodna redukcja szumów (dwustopniowe przeskalowanie),
     cieplejsza kolorystyka w stylu iPhone'a, delikatna winieta,
     rozmyte tło w trybie Portret
   • zoom 1×/2×, siatka, lampa błyskowa, przełączenie kamery
   • zdjęcia zapisywane lokalnie (localStorage), podgląd w „Ostatnie”
   Ładować PO loading.js (nie zależy od niego).
   ===================================================================== */
(function () {
  'use strict';

  const STORE_KEY = 'zenios.camera.photos.v1';
  const MAX_PHOTOS = 10;

  const $ = (id) => document.getElementById(id);

  const state = {
    open: false,
    ready: false,
    facing: 'environment',
    mode: 'photo',
    flash: 'auto',
    zoom: 1,
    grid: false,
    stream: null,
    photos: []
  };
  const els = {};

  /* --------------------------------- dane --------------------------------- */
  function readPhotos() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.filter((x) => typeof x === 'string') : [];
    } catch (e) { return []; }
  }

  function writePhotos() {
    const put = (list) => {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); return true; }
      catch (e) { return false; }
    };
    if (put(state.photos)) return;
    state.photos = state.photos.slice(0, 4);   // brak miejsca — zostaw najnowsze
    put(state.photos);
  }

  /* ------------------------------- podgląd -------------------------------- */
  function stopStream() {
    if (state.stream) {
      state.stream.getTracks().forEach((t) => t.stop());
      state.stream = null;
    }
    state.ready = false;
    if (els.video) {
      els.video.srcObject = null;
      els.video.classList.remove('ready');
    }
  }

  function setStatus(text) {
    if (!els.status) return;
    els.status.textContent = text || '';
    els.status.classList.toggle('visible', Boolean(text));
  }

  async function startStream() {
    stopStream();
    setStatus('');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      useFallback('Podgląd demo — przeglądarka nie udostępnia kamery');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: state.facing,
          width: { ideal: 1920 },
          height: { ideal: 1440 }
        }
      });
      state.stream = stream;
      state.ready = true;
      els.video.srcObject = stream;
      els.scene.classList.add('hidden');
      els.video.classList.toggle('mirror', state.facing === 'user');
      await els.video.play().catch(() => {});
      els.video.classList.add('ready');
      applyTorch();
    } catch (err) {
      useFallback('Podgląd demo — brak dostępu do kamery');
    }
  }

  function useFallback(message) {
    stopStream();
    if (els.scene) els.scene.classList.remove('hidden');
    setStatus(message);
  }

  function applyTorch() {
    if (!state.stream) return;
    const track = state.stream.getVideoTracks()[0];
    if (!track || !track.applyConstraints) return;
    const on = state.flash === 'on';
    track.applyConstraints({ advanced: [{ torch: on }] }).catch(() => {});
  }

  /* ------------------------------ obróbka zdjęcia ------------------------------ */
  function captureStill() {
    const video = els.video;
    const live = state.ready && video.videoWidth > 0;
    const vw = live ? video.videoWidth : 1080;
    const vh = live ? video.videoHeight : 1920;

    /* kadr zgodny z podglądem (object-fit: cover) + zoom */
    const boxW = els.layer.clientWidth || 390;
    const boxH = els.layer.clientHeight || 844;
    const boxRatio = boxW / boxH;
    const videoRatio = vw / vh;
    let cw = vw, ch = vh;
    if (videoRatio > boxRatio) cw = vh * boxRatio;
    else ch = vw / boxRatio;
    cw /= state.zoom;
    ch /= state.zoom;
    const cx = (vw - cw) / 2;
    const cy = (vh - ch) / 2;

    const pano = state.mode === 'pano';
    const outW = pano ? 2400 : 1170;
    const outH = pano ? 800 : Math.round(outW * (ch / cw));

    /* 1. redukcja szumów: render w połowie rozdzielczości (wygładzanie)
          i ponowne powiększenie z wysoką jakością interpolacji */
    const soft = document.createElement('canvas');
    soft.width = Math.max(2, Math.round(outW / 2));
    soft.height = Math.max(2, Math.round(outH / 2));
    const sctx = soft.getContext('2d');
    sctx.imageSmoothingEnabled = true;
    sctx.imageSmoothingQuality = 'high';

    if (live) {
      if (pano) {
        const bandH = ch * 0.34;
        sctx.drawImage(video, cx, cy + (ch - bandH) / 2, cw, bandH, 0, 0, soft.width, soft.height);
      } else {
        sctx.drawImage(video, cx, cy, cw, ch, 0, 0, soft.width, soft.height);
      }
    } else {
      paintDemoScene(sctx, soft.width, soft.height);
    }

    /* 2. wyostrzenie po wygładzeniu + kolorystyka */
    const out = document.createElement('canvas');
    out.width = outW;
    out.height = outH;
    const ctx = out.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.filter = 'contrast(1.07) saturate(1.15) brightness(1.02)';
    ctx.drawImage(soft, 0, 0, outW, outH);
    ctx.filter = 'none';

    /* ciepły akcent i lekkie podbicie świateł */
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = 'rgba(255, 178, 112, 0.10)';
    ctx.fillRect(0, 0, outW, outH);
    ctx.globalCompositeOperation = 'source-over';

    /* winieta */
    const vg = ctx.createRadialGradient(
      outW / 2, outH / 2, Math.min(outW, outH) * 0.28,
      outW / 2, outH / 2, Math.max(outW, outH) * 0.72
    );
    vg.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vg.addColorStop(1, 'rgba(0, 0, 0, 0.26)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, outW, outH);

    /* Portret: miękkie, rozmyte tło poza owalem twarzy */
    if (state.mode === 'portrait') {
      const blur = document.createElement('canvas');
      blur.width = outW;
      blur.height = outH;
      const bctx = blur.getContext('2d');
      bctx.filter = 'blur(24px) brightness(0.97) saturate(1.05)';
      bctx.drawImage(soft, -60, -60, outW + 120, outH + 120);
      bctx.filter = 'none';
      bctx.globalCompositeOperation = 'destination-in';
      const mask = bctx.createRadialGradient(
        outW / 2, outH * 0.5, Math.min(outW, outH) * 0.3,
        outW / 2, outH * 0.5, Math.min(outW, outH) * 0.68
      );
      mask.addColorStop(0, 'rgba(0, 0, 0, 0)');
      mask.addColorStop(0.6, 'rgba(0, 0, 0, 0.5)');
      mask.addColorStop(1, '#000');
      bctx.fillStyle = mask;
      bctx.fillRect(0, 0, outW, outH);
      ctx.drawImage(blur, 0, 0);
    }

    return out.toDataURL('image/jpeg', 0.9);
  }

  function paintDemoScene(ctx, w, h) {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#16213f');
    sky.addColorStop(0.36, '#38558c');
    sky.addColorStop(0.56, '#d98a5c');
    sky.addColorStop(0.57, '#2a1a24');
    sky.addColorStop(1, '#0d0a10');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    const sun = ctx.createRadialGradient(w * 0.62, h * 0.5, 0, w * 0.62, h * 0.5, h * 0.34);
    sun.addColorStop(0, 'rgba(255, 226, 178, 0.85)');
    sun.addColorStop(1, 'rgba(255, 190, 130, 0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#141019';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.72);
    ctx.bezierCurveTo(w * 0.25, h * 0.62, w * 0.5, h * 0.78, w, h * 0.66);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
  }

  /* -------------------------------- galeria -------------------------------- */
  function renderThumb() {
    if (!els.thumb) return;
    const last = state.photos[0];
    els.thumb.style.backgroundImage = last ? `url("${last}")` : '';
    els.thumb.classList.toggle('empty', !last);
  }

  function renderRoll() {
    if (!els.rollGrid) return;
    els.rollGrid.textContent = '';
    if (!state.photos.length) {
      const empty = document.createElement('p');
      empty.className = 'camera-roll-empty';
      empty.textContent = 'Brak zdjęć — zrób pierwsze.';
      els.rollGrid.appendChild(empty);
      return;
    }
    state.photos.forEach((src, index) => {
      const shot = document.createElement('button');
      shot.type = 'button';
      shot.className = 'camera-roll-item';
      shot.style.backgroundImage = `url("${src}")`;
      shot.setAttribute('aria-label', `Zdjęcie ${index + 1}`);
      shot.addEventListener('click', () => {
        const link = document.createElement('a');
        link.href = src;
        link.download = `zenios-${Date.now()}.jpg`;
        link.click();
      });
      els.rollGrid.appendChild(shot);
    });
  }

  function toggleRoll(force) {
    if (!els.roll) return;
    const open = typeof force === 'boolean' ? force : !els.roll.classList.contains('open');
    els.roll.classList.toggle('open', open);
    els.roll.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (open) renderRoll();
  }

  /* ------------------------------- interfejs ------------------------------- */
  function setMode(mode) {
    state.mode = mode;
    els.layer.dataset.mode = mode;
    els.modes.querySelectorAll('.cam-mode').forEach((b) => {
      b.classList.toggle('active', b.dataset.mode === mode);
    });
    els.zoomRow?.classList.toggle('hidden', mode === 'pano');
    setStatus(mode === 'portrait'
      ? 'Portret — rozmyte tło, miękkie światło'
      : mode === 'pano' ? 'Panorama — przesuń telefon powoli' : '');
  }

  function setZoom(zoom) {
    state.zoom = zoom;
    els.layer.style.setProperty('--cam-zoom', String(zoom));
    els.zoomRow.querySelectorAll('[data-zoom]').forEach((b) => {
      b.classList.toggle('active', Number(b.dataset.zoom) === zoom);
    });
  }

  function cycleFlash() {
    state.flash = state.flash === 'auto' ? 'on' : state.flash === 'on' ? 'off' : 'auto';
    const label = state.flash === 'auto' ? 'Auto' : state.flash === 'on' ? 'Wł.' : 'Wył.';
    els.flashBtn.dataset.state = state.flash;
    els.flashBtn.querySelector('span').textContent = label;
    applyTorch();
  }

  function shoot() {
    if (els.shutter.classList.contains('shooting')) return;
    els.shutter.classList.add('shooting');
    els.flash.classList.remove('fire');
    void els.flash.offsetWidth;
    els.flash.classList.add('fire');
    if (navigator.vibrate) navigator.vibrate(8);

    const src = captureStill();
    state.photos.unshift(src);
    state.photos = state.photos.slice(0, MAX_PHOTOS);
    writePhotos();
    renderThumb();

    setTimeout(() => els.shutter.classList.remove('shooting'), 160);
    setTimeout(() => els.flash.classList.remove('fire'), 320);
  }

  async function flipCamera() {
    state.facing = state.facing === 'environment' ? 'user' : 'environment';
    await startStream();
  }

  function open() {
    if (!els.layer) return;
    closeRollAndLoad();
    state.open = true;
    els.layer.classList.add('open');
    els.layer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('camera-open');
    setMode(state.mode);
    setZoom(1);
    startStream();
  }

  function close() {
    if (!els.layer || !state.open) return;
    state.open = false;
    els.layer.classList.remove('open');
    els.layer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('camera-open');
    toggleRoll(false);
    stopStream();
  }

  function closeRollAndLoad() {
    toggleRoll(false);
    state.photos = readPhotos();
    renderThumb();
  }

  function bind() {
    els.layer = $('camera-layer');
    if (!els.layer) return;
    els.video = $('camera-video');
    els.scene = $('camera-scene');
    els.grid = $('camera-grid');
    els.flash = $('camera-flash');
    els.status = $('camera-status');
    els.modes = $('camera-modes');
    els.zoomRow = $('camera-zoom');
    els.shutter = $('camera-shutter');
    els.thumb = $('camera-thumb');
    els.roll = $('camera-roll');
    els.rollGrid = $('camera-roll-grid');
    els.flashBtn = $('camera-flash-btn');

    state.photos = readPhotos();
    renderThumb();

    $('camera-close')?.addEventListener('click', close);
    $('camera-shutter')?.addEventListener('click', shoot);
    $('camera-switch')?.addEventListener('click', flipCamera);
    els.flashBtn?.addEventListener('click', cycleFlash);
    $('camera-grid-btn')?.addEventListener('click', (e) => {
      state.grid = !state.grid;
      els.grid.classList.toggle('visible', state.grid);
      e.currentTarget.classList.toggle('active', state.grid);
    });
    $('camera-live')?.addEventListener('click', () => toggleRoll(true));
    els.thumb?.addEventListener('click', () => toggleRoll(true));
    $('camera-roll-close')?.addEventListener('click', () => toggleRoll(false));

    els.modes.querySelectorAll('.cam-mode').forEach((b) => {
      b.addEventListener('click', () => setMode(b.dataset.mode));
    });
    els.zoomRow.querySelectorAll('[data-zoom]').forEach((b) => {
      b.addEventListener('click', () => setZoom(Number(b.dataset.zoom)));
    });

    /* przesunięcie w dół zamyka aparat (jak w iPhonie) */
    let dragStart = null;
    els.layer.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      dragStart = e.clientY;
    });
    els.layer.addEventListener('pointerup', (e) => {
      if (dragStart === null) return;
      const delta = e.clientY - dragStart;
      dragStart = null;
      if (delta > 90) close();
    });

    /* wyjście gestem/paskiem nawigacji nie zostawia włączonej kamery */
    ['gesture-home-btn', 'sys-btn-home', 'sys-btn-back'].forEach((id) => {
      $(id)?.addEventListener('click', () => { if (state.open) close(); }, true);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.open) close();
    });

    document.addEventListener('visibilitychange', () => {
      if (!state.open) return;
      if (document.hidden) stopStream();
      else if (state.open) startStream();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();

  window.ZeniCamera = {
    open,
    close,
    shoot,
    get state() { return { open: state.open, mode: state.mode, facing: state.facing, zoom: state.zoom, ready: state.ready }; }
  };
})();
