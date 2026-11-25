/* zeni-camera.js – aplikacja Aparat w stylu iPhone'a dla ZeniOS
 * Wymaga: zeni-photo-engine.js (captureProPhoto) załadowanego wcześniej.
 * Użycie:  const cam = ZeniCamera.open(containerElement);  ...  cam.close();
 * Galeria: ZeniGallery.all() zwraca [{id, type, blob, date}], zdarzenie 'zeni:gallery-changed'.
 */
(function (global) {
  'use strict';

  /* ---------- Galeria (IndexedDB, wspólna dla Aparatu i aplikacji Zdjęcia) ---------- */
  const ZeniGallery = {
    _open() {
      return new Promise((res, rej) => {
        const rq = indexedDB.open('ZeniGallery', 1);
        rq.onupgradeneeded = () => rq.result.createObjectStore('items', { keyPath: 'id', autoIncrement: true });
        rq.onsuccess = () => res(rq.result);
        rq.onerror = () => rej(rq.error);
      });
    },
    async _tx(mode, fn) {
      const db = await this._open();
      return new Promise((res, rej) => {
        const tx = db.transaction('items', mode);
        const rq = fn(tx.objectStore('items'));
        tx.oncomplete = () => res(rq && rq.result);
        tx.onerror = () => rej(tx.error);
      });
    },
    async add(blob, type = 'photo') {
      const id = await this._tx('readwrite', s => s.add({ type, blob, date: Date.now() }));
      window.dispatchEvent(new CustomEvent('zeni:gallery-changed', { detail: { id, type } }));
      return id;
    },
    all() { return this._tx('readonly', s => s.getAll()); },
    remove(id) {
      return this._tx('readwrite', s => s.delete(id)).then(() =>
        window.dispatchEvent(new CustomEvent('zeni:gallery-changed', { detail: { id } })));
    }
  };

  /* ---------- Style ---------- */
  const CSS = `
  .zc{position:relative;width:100%;height:100%;background:#000;color:#fff;font-family:-apple-system,"SF Pro Text",system-ui,sans-serif;display:flex;flex-direction:column;overflow:hidden;user-select:none}
  .zc button{background:none;border:0;color:inherit;font:inherit;cursor:pointer;padding:0}
  .zc-top{height:64px;display:flex;align-items:center;justify-content:space-between;padding:0 18px;flex:none}
  .zc-ic{width:34px;height:34px;border-radius:50%;display:grid;place-items:center}
  .zc-ic.on{background:#ffd60a;color:#000}
  .zc-chev{width:38px;height:30px;border-radius:15px;background:rgba(120,120,128,.36);display:grid;place-items:center}
  .zc-view{position:relative;flex:1;min-height:0;overflow:hidden;background:#111}
  .zc-view video{width:100%;height:100%;object-fit:cover;display:block}
  .zc-view video.mirror{transform:scaleX(-1)}
  .zc-grid{position:absolute;inset:0;pointer-events:none;display:none;
    background:linear-gradient(#fff6,#fff6) 33.3% 0/1px 100% no-repeat,linear-gradient(#fff6,#fff6) 66.6% 0/1px 100% no-repeat,
    linear-gradient(#fff6,#fff6) 0 33.3%/100% 1px no-repeat,linear-gradient(#fff6,#fff6) 0 66.6%/100% 1px no-repeat}
  .zc-grid.on{display:block}
  .zc-lock{position:absolute;top:10px;left:50%;transform:translateX(-50%);background:#ffd60a;color:#000;font-size:13px;font-weight:600;padding:3px 10px;border-radius:4px;display:none}
  .zc-focus{position:absolute;width:76px;height:76px;border:1.5px solid #ffd60a;display:none;transform:translate(-50%,-50%);pointer-events:none}
  .zc-focus::after{content:"☀";position:absolute;right:-22px;top:50%;transform:translateY(-50%);color:#ffd60a;font-size:15px}
  .zc-zoom{position:absolute;bottom:14px;left:50%;transform:translateX(-50%);display:flex;gap:8px;background:rgba(0,0,0,.35);padding:4px;border-radius:24px}
  .zc-zoom button{min-width:30px;height:30px;border-radius:15px;font-size:12px;font-weight:600}
  .zc-zoom button.on{background:rgba(0,0,0,.6);color:#ffd60a;min-width:38px}
  .zc-modes{height:44px;display:flex;justify-content:center;gap:26px;align-items:center;flex:none;font-size:13px;font-weight:600;letter-spacing:.4px}
  .zc-modes button{color:#fff;opacity:.9}.zc-modes button.on{color:#ffd60a}
  .zc-bar{height:104px;display:flex;align-items:center;justify-content:space-around;flex:none}
  .zc-thumb{width:50px;height:50px;border-radius:8px;background:#222 center/cover;border:1px solid #444}
  .zc-shutter{width:76px;height:76px;border-radius:50%;border:4px solid #fff;display:grid;place-items:center;position:relative}
  .zc-shutter i{width:62px;height:62px;border-radius:50%;background:#fff;transition:transform .08s,background .2s,border-radius .2s}
  .zc-shutter:active i{transform:scale(.9)}
  .zc-shutter.rec i{background:#ff3b30;width:32px;height:32px;border-radius:7px}
  .zc-shutter.busy i{background:#bbb;animation:zcp 1s infinite}
  @keyframes zcp{50%{opacity:.45}}
  .zc-flip{width:50px;height:50px;border-radius:50%;background:rgba(120,120,128,.36);display:grid;place-items:center}
  .zc-flash{position:absolute;inset:0;background:#000;opacity:0;pointer-events:none}
  .zc-flash.go{animation:zcf .22s}
  @keyframes zcf{0%{opacity:.9}100%{opacity:0}}
  .zc-count{position:absolute;inset:0;display:none;place-items:center;font-size:96px;font-weight:200;text-shadow:0 2px 12px #000a;pointer-events:none}
  .zc-prog{position:absolute;left:0;bottom:0;height:3px;width:0;background:#ffd60a}
  .zc-menu{position:absolute;left:12px;right:12px;top:60px;background:rgba(28,28,30,.94);backdrop-filter:blur(20px);border-radius:16px;padding:6px 0;display:none;z-index:5}
  .zc-menu.open{display:block}
  .zc-row{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;font-size:15px;border-bottom:1px solid #fff1}
  .zc-row:last-child{border:0}.zc-row small{opacity:.6;display:block;font-size:12px}
  .zc-sw{width:46px;height:28px;border-radius:14px;background:#555;position:relative;transition:.2s}
  .zc-sw::after{content:"";position:absolute;top:2px;left:2px;width:24px;height:24px;border-radius:50%;background:#fff;transition:.2s}
  .zc-sw.on{background:#30d158}.zc-sw.on::after{left:20px}
  .zc-seg button{padding:4px 10px;border-radius:12px;font-size:13px}.zc-seg button.on{background:#ffd60a;color:#000}
  .zc-err{position:absolute;inset:0;display:none;place-items:center;text-align:center;padding:30px;font-size:15px;background:#000}
  `;

  const ICON = {
    bolt: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>',
    chev: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m6 15 6-6 6 6"/></svg>',
    live: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7" stroke-dasharray="2 2.5"/><path d="M4 4l16 16"/></svg>',
    flip: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 0 0-14-4L4 9"/><path d="M4 4v5h5"/><path d="M4 13a8 8 0 0 0 14 4l2-2"/><path d="M20 20v-5h-5"/></svg>'
  };

  // Śledzenie aktywnej instancji, aby globalne close() działało
  let currentInstance = null;

  function open(container) {
    // Jeśli już jest otwarta, zamknij poprzednią
    if (currentInstance) {
      currentInstance.close();
    }

    // Fallback dla kontenera
    const targetContainer = container || document.body;

    if (!document.getElementById('zc-style')) {
      const st = document.createElement('style'); st.id = 'zc-style'; st.textContent = CSS; document.head.appendChild(st);
    }
    const root = document.createElement('div');
    root.className = 'zc';
    root.innerHTML = `
      <div class="zc-top">
        <button class="zc-ic" data-a="torch">${ICON.bolt}</button>
        <button class="zc-chev" data-a="menu">${ICON.chev}</button>
        <button class="zc-ic" disabled style="opacity:.6">${ICON.live}</button>
      </div>
      <div class="zc-menu">
        <div class="zc-row" data-a="pro"><div>Tryb Pro<small>Smart HDR + Deep Fusion (10 klatek)</small></div><div class="zc-sw on"></div></div>
        <div class="zc-row" data-a="grid"><div>Siatka</div><div class="zc-sw"></div></div>
        <div class="zc-row"><div>Samowyzwalacz</div><div class="zc-seg"><button data-t="0" class="on">Wył.</button><button data-t="3">3 s</button><button data-t="10">10 s</button></div></div>
      </div>
      <div class="zc-view">
        <video playsinline muted autoplay></video>
        <div class="zc-grid"></div><div class="zc-lock">BLOKADA AE/AF</div><div class="zc-focus"></div>
        <div class="zc-count"></div><div class="zc-flash"></div><div class="zc-prog"></div>
        <div class="zc-zoom"><button data-z="0.5" style="display:none">0,5</button><button data-z="1" class="on">1×</button></div>
        <div class="zc-err"></div>
      </div>
      <div class="zc-modes"><button data-m="video">WIDEO</button><button data-m="photo" class="on">ZDJĘCIE</button></div>
      <div class="zc-bar">
        <button class="zc-thumb" data-a="gallery"></button>
        <button class="zc-shutter" data-a="shutter"><i></i></button>
        <button class="zc-flip" data-a="flip">${ICON.flip}</button>
      </div>`;
    targetContainer.appendChild(root);

    const $ = s => root.querySelector(s);
    const video = $('video'), view = $('.zc-view'), shutter = $('.zc-shutter');
    const state = { facing: 'environment', mode: 'photo', pro: true, timer: 0, torch: false, busy: false, stream: null, rec: null };

    /* --- strumień kamery --- */
    async function start() {
      stop();
      try {
        state.stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: state.facing, width: { ideal: 3840 }, height: { ideal: 2160 } }, audio: false });
        video.srcObject = state.stream;
        video.classList.toggle('mirror', state.facing === 'user');
        await video.play();
        const t = state.stream.getVideoTracks()[0], caps = t.getCapabilities ? t.getCapabilities() : {};
        $('[data-z="0.5"]').style.display = caps.zoom && caps.zoom.min <= 0.5 ? '' : 'none';
        $('[data-a="torch"]').style.visibility = caps.torch ? 'visible' : 'hidden';
        $('.zc-err').style.display = 'none';
      } catch (e) {
        const er = $('.zc-err'); er.style.display = 'grid';
        er.textContent = 'Brak dostępu do kamery. Zezwól na aparat w przeglądarce (wymagane HTTPS lub localhost).';
      }
    }
    function stop() { if (state.stream) state.stream.getTracks().forEach(t => t.stop()); state.stream = null; }

    /* --- miniatura = ostatnie zdjęcie z galerii --- */
    let thumbURL;
    async function refreshThumb() {
      try {
        const items = await ZeniGallery.all(); const last = items[items.length - 1];
        if (thumbURL) URL.revokeObjectURL(thumbURL);
        if (last && last.type === 'photo') { thumbURL = URL.createObjectURL(last.blob); $('.zc-thumb').style.backgroundImage = `url(${thumbURL})`; }
      } catch (_) {}
    }

    /* --- robienie zdjęcia --- */
    async function takePhoto() {
      if (state.busy || !video.videoWidth) return;
      state.busy = true; shutter.classList.add('busy');
      try {
        if (state.timer) await countdown(state.timer);
        $('.zc-flash').classList.remove('go'); void $('.zc-flash').offsetWidth; $('.zc-flash').classList.add('go');
        let blob;
        if (state.pro && typeof global.captureProPhoto === 'function') {
          blob = await global.captureProPhoto(video, { frames: 10, quality: 0.95,
            onProgress: p => { $('.zc-prog').style.width = (p * 100) + '%'; } });
        } else {
          const c = document.createElement('canvas'); c.width = video.videoWidth; c.height = video.videoHeight;
          c.getContext('2d').drawImage(video, 0, 0);
          blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.95));
        }
        await ZeniGallery.add(blob, 'photo');   // <- zapis do galerii
        await refreshThumb();
      } catch (e) { console.error('Błąd zdjęcia:', e); }
      $('.zc-prog').style.width = '0'; shutter.classList.remove('busy'); state.busy = false;
    }
    async function countdown(n) {
      const c = $('.zc-count'); c.style.display = 'grid';
      for (let i = n; i > 0; i--) { c.textContent = i; await new Promise(r => setTimeout(r, 1000)); }
      c.style.display = 'none';
    }

    /* --- wideo --- */
    function toggleRecord() {
      if (state.rec) { state.rec.stop(); return; }
      const chunks = [];
      const mr = new MediaRecorder(state.stream);
      mr.ondataavailable = e => e.data.size && chunks.push(e.data);
      mr.onstop = async () => {
        shutter.classList.remove('rec'); state.rec = null;
        await ZeniGallery.add(new Blob(chunks, { type: mr.mimeType || 'video/webm' }), 'video');
      };
      mr.start(); state.rec = mr; shutter.classList.add('rec');
    }

    /* --- zdarzenia --- */
    root.addEventListener('click', async e => {
      const el = e.target.closest('[data-a],[data-m],[data-z],[data-t]'); if (!el) return;
      const a = el.dataset.a;
      if (a === 'shutter') return state.mode === 'photo' ? takePhoto() : toggleRecord();
      if (a === 'flip') { state.facing = state.facing === 'user' ? 'environment' : 'user'; return start(); }
      if (a === 'menu') return $('.zc-menu').classList.toggle('open');
      if (a === 'pro') { state.pro = !state.pro; return el.querySelector('.zc-sw').classList.toggle('on', state.pro); }
      if (a === 'grid') { const on = el.querySelector('.zc-sw').classList.toggle('on'); return $('.zc-grid').classList.toggle('on', on); }
      if (a === 'torch') {
        state.torch = !state.torch; el.classList.toggle('on', state.torch);
        try { await state.stream.getVideoTracks()[0].applyConstraints({ advanced: [{ torch: state.torch }] }); } catch (_) {}
        return;
      }
      if (a === 'gallery') return root.dispatchEvent(new CustomEvent('zeni:open-gallery', { bubbles: true }));
      if (el.dataset.t !== undefined) {
        state.timer = +el.dataset.t; el.parentNode.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === el)); return;
      }
      if (el.dataset.m) {
        state.mode = el.dataset.m; root.querySelectorAll('[data-m]').forEach(b => b.classList.toggle('on', b === el)); return;
      }
      if (el.dataset.z) {
        const z = +el.dataset.z;
        try { await state.stream.getVideoTracks()[0].applyConstraints({ advanced: [{ zoom: z }] }); } catch (_) {}
        root.querySelectorAll('[data-z]').forEach(b => b.classList.toggle('on', b === el)); return;
      }
    });

    // dotknięcie = ostrość, przytrzymanie = BLOKADA AE/AF
    let hold;
    view.addEventListener('pointerdown', e => {
      if (e.target.closest('.zc-zoom')) return;
      const r = view.getBoundingClientRect(), f = $('.zc-focus');
      f.style.left = (e.clientX - r.left) + 'px'; f.style.top = (e.clientY - r.top) + 'px'; f.style.display = 'block';
      clearTimeout(hold); hold = setTimeout(() => { $('.zc-lock').style.display = 'block'; }, 600);
    });
    view.addEventListener('pointerup', () => {
      clearTimeout(hold);
      setTimeout(() => { if ($('.zc-lock').style.display === 'none') $('.zc-focus').style.display = 'none'; }, 1200);
    });
    $('.zc-lock').addEventListener('click', e => { e.stopPropagation(); e.target.style.display = 'none'; $('.zc-focus').style.display = 'none'; });

    start(); refreshThumb();
    
    // Tworzymy API i zapisujekmy referencję
    const api = { 
      close() { 
        stop(); 
        root.remove(); 
        if (thumbURL) URL.revokeObjectURL(thumbURL); 
        if (currentInstance === api) currentInstance = null;
      }, 
      state 
    };
    
    currentInstance = api;
    return api;
  }

  global.ZeniGallery = ZeniGallery;
  
  // Eksponujemy open i globalne close
  global.ZeniCamera = { 
    open,
    close: () => {
      if (currentInstance) {
        currentInstance.close();
      }
    }
  };
})(window);
