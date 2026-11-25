/* zeni-camera.js – Kompletna aplikacja Aparat w stylu iPhone'a + silnik Pro HDR/Deep Fusion + Galeria */
(function (global) {
  'use strict';

  /* =========================================================================
   * 1. WSPÓLNA GALERIA (IndexedDB: 'ZeniGallery', store: 'items')
   * ========================================================================= */
  const ZeniGallery = {
    _dbPromise: null,

    _open() {
      if (this._dbPromise) return this._dbPromise;
      this._dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open('ZeniGallery', 1);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('items')) {
            const store = db.createObjectStore('items', { keyPath: 'id', autoIncrement: true });
            store.createIndex('date', 'date', { unique: false });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      return this._dbPromise;
    },

    async _tx(mode, fn) {
      const db = await this._open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('items', mode);
        const store = tx.objectStore('items');
        let result;
        try {
          result = fn(store);
        } catch (err) {
          reject(err);
          return;
        }
        tx.oncomplete = () => resolve(result && 'result' in result ? result.result : result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('Transakcja IndexedDB przerwana'));
      });
    },

    async add(blob, type = 'photo', meta = {}) {
      if (!blob) throw new Error('Brak danych (Blob) do zapisania w galerii.');
      const record = {
        type,
        blob,
        mime: blob.type || (type === 'video' ? 'video/webm' : 'image/jpeg'),
        date: Date.now(),
        ...meta
      };
      const id = await this._tx('readwrite', (store) => store.add(record));
      window.dispatchEvent(new CustomEvent('zeni:gallery-changed', { detail: { id, type, record } }));
      return id;
    },

    async all() {
      const items = await this._tx('readonly', (store) => store.getAll());
      return (items || []).sort((a, b) => a.date - b.date);
    },

    async remove(id) {
      await this._tx('readwrite', (store) => store.delete(id));
      window.dispatchEvent(new CustomEvent('zeni:gallery-changed', { detail: { id, deleted: true } }));
    },

    async clear() {
      await this._tx('readwrite', (store) => store.clear());
      window.dispatchEvent(new CustomEvent('zeni:gallery-changed', { detail: { cleared: true } }));
    }
  };

  /* =========================================================================
   * 2. SILNIK FOTOGRAFII OBLICZENIOWEJ (Smart HDR + Deep Fusion + Color Science)
   * ========================================================================= */
  async function captureProPhoto(videoElement, options = {}) {
    if (!videoElement || !videoElement.videoWidth || !videoElement.videoHeight) {
      throw new Error('Strumień kamery nie jest jeszcze gotowy.');
    }

    const {
      framesCount = 10,
      quality = 0.95,
      output = 'blob',
      sharpenThreshold = 8,
      sharpenAmount = 1.15,
      contrastAmount = 0.22,
      vibranceAmount = 0.35,
      warmthAmount = 0.04,
      mirror = false,
      onProgress = null
    } = options;

    const width = videoElement.videoWidth;
    const height = videoElement.videoHeight;
    const pixelCount = width * height;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const clampByte = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
    const smoothstep = (e0, e1, x) => {
      const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
      return t * t * (3 - 2 * t);
    };
    const yieldUI = () => new Promise((r) => setTimeout(r, 0));
    const nextFrame = () =>
      new Promise((r) => {
        if ('requestVideoFrameCallback' in videoElement) {
          videoElement.requestVideoFrameCallback(() => r());
        } else {
          requestAnimationFrame(() => r());
        }
      });

    const drawVideoFrame = () => {
      ctx.save();
      if (mirror) {
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(videoElement, 0, 0, width, height);
      ctx.restore();
    };

    // 1. Multi-Frame Noise Reduction (uśrednianie 10 klatek)
    const rgb = new Float32Array(pixelCount * 3);
    for (let f = 0; f < framesCount; f++) {
      await nextFrame();
      drawVideoFrame();
      const data = ctx.getImageData(0, 0, width, height).data;
      for (let p = 0, c = 0; p < data.length; p += 4, c += 3) {
        rgb[c] += data[p];
        rgb[c + 1] += data[p + 1];
        rgb[c + 2] += data[p + 2];
      }
      if (typeof onProgress === 'function') {
        onProgress(((f + 1) / framesCount) * 0.55);
      }
    }

    const inv = 1 / framesCount;
    for (let i = 0; i < rgb.length; i++) rgb[i] *= inv;
    await yieldUI();

    // 2. Smart HDR / Tone Mapping (L = 0.299R + 0.587G + 0.114B)
    const gainLUT = new Float32Array(256);
    const liftFn = (L) => {
      const n = L / 255;
      const lifted = Math.pow(n, 0.52);
      const w = 1 - smoothstep(45, 115, L);
      return n + (lifted - n) * w;
    };
    const at200 = liftFn(200);

    for (let l = 0; l < 256; l++) {
      let m = liftFn(l);
      if (l > 200) {
        m = at200 + (m - at200) * 0.55;
      }
      const target = m * 255;
      gainLUT[l] = l < 2 ? 1 : Math.min(3.4, target / l);
    }

    for (let c = 0; c < rgb.length; c += 3) {
      const L = 0.299 * rgb[c] + 0.587 * rgb[c + 1] + 0.114 * rgb[c + 2];
      const idx = L < 0 ? 0 : L > 255 ? 255 : L | 0;
      const g = gainLUT[idx];
      rgb[c] = clampByte(rgb[c] * g);
      rgb[c + 1] = clampByte(rgb[c + 1] * g);
      rgb[c + 2] = clampByte(rgb[c + 2] * g);
    }

    if (typeof onProgress === 'function') onProgress(0.72);
    await yieldUI();

    // 3. Intelligent Sharpening (Unsharp Mask na luminancji z progiem)
    const Y = new Float32Array(pixelCount);
    for (let p = 0, c = 0; p < pixelCount; p++, c += 3) {
      Y[p] = 0.299 * rgb[c] + 0.587 * rgb[c + 1] + 0.114 * rgb[c + 2];
    }

    const tmp = new Float32Array(pixelCount);
    for (let y = 0; y < height; y++) {
      const row = y * width;
      for (let x = 0; x < width; x++) {
        const x0 = x > 0 ? x - 1 : 0;
        const x2 = x < width - 1 ? x + 1 : width - 1;
        tmp[row + x] = (Y[row + x0] + 2 * Y[row + x] + Y[row + x2]) * 0.25;
      }
    }

    const blur = new Float32Array(pixelCount);
    for (let y = 0; y < height; y++) {
      const y0 = (y > 0 ? y - 1 : 0) * width;
      const y1 = y * width;
      const y2 = (y < height - 1 ? y + 1 : height - 1) * width;
      for (let x = 0; x < width; x++) {
        blur[y1 + x] = (tmp[y0 + x] + 2 * tmp[y1 + x] + tmp[y2 + x]) * 0.25;
      }
    }

    const maxDelta = 26;
    for (let p = 0, c = 0; p < pixelCount; p++, c += 3) {
      const diff = Y[p] - blur[p];
      const absDiff = Math.abs(diff);
      if (absDiff <= sharpenThreshold) continue;
      const weight = smoothstep(sharpenThreshold, sharpenThreshold * 2.5, absDiff);
      let delta = diff * sharpenAmount * weight;
      if (delta > maxDelta) delta = maxDelta;
      else if (delta < -maxDelta) delta = -maxDelta;

      rgb[c] = clampByte(rgb[c] + delta);
      rgb[c + 1] = clampByte(rgb[c + 1] + delta);
      rgb[c + 2] = clampByte(rgb[c + 2] + delta);
    }

    if (typeof onProgress === 'function') onProgress(0.86);
    await yieldUI();

    // 4. Apple Color Science (krzywa S + vibrance + ocieplenie balansu bieli)
    for (let c = 0; c < rgb.length; c += 3) {
      let r = clampByte(rgb[c] * (1 + warmthAmount));
      let g = clampByte(rgb[c + 1] * (1 + warmthAmount * 0.25));
      let b = clampByte(rgb[c + 2] * (1 - warmthAmount));

      const curveS = (v) => {
        const x = v / 255;
        const s = x * x * (3 - 2 * x);
        return 255 * (x + (s - x) * contrastAmount);
      };

      r = curveS(r);
      g = curveS(g);
      b = curveS(b);

      const mx = Math.max(r, g, b);
      const mn = Math.min(r, g, b);
      const sat = mx > 0 ? (mx - mn) / mx : 0;
      const vib = 1 + vibranceAmount * (1 - sat);
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;

      rgb[c] = clampByte(luma + (r - luma) * vib);
      rgb[c + 1] = clampByte(luma + (g - luma) * vib);
      rgb[c + 2] = clampByte(luma + (b - luma) * vib);
    }

    if (typeof onProgress === 'function') onProgress(0.95);

    // 5. Zapis do ImageData i eksport JPEG (0.95)
    const imgData = ctx.createImageData(width, height);
    const out = imgData.data;
    for (let p = 0, c = 0; p < out.length; p += 4, c += 3) {
      out[p] = rgb[c];
      out[p + 1] = rgb[c + 1];
      out[p + 2] = rgb[c + 2];
      out[p + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);

    const res =
      output === 'dataurl'
        ? canvas.toDataURL('image/jpeg', quality)
        : await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));

    if (typeof onProgress === 'function') onProgress(1);
    return res;
  }

  /* =========================================================================
   * 3. STYLE INTERFEJSU APARATU I GALERII
   * ========================================================================= */
  const STYLES = `
  .zc-wrap{position:relative;width:100%;height:100%;background:#000;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Roboto,sans-serif;display:flex;flex-direction:column;overflow:hidden;user-select:none;-webkit-tap-highlight-color:transparent}
  .zc-wrap button{background:none;border:0;color:inherit;font:inherit;cursor:pointer;padding:0}
  .zc-top{height:60px;display:flex;align-items:center;justify-content:space-between;padding:0 18px;flex:none;z-index:4}
  .zc-ic{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;transition:background .15s,color .15s}
  .zc-ic.on{background:#ffd60a;color:#000}
  .zc-chev{width:38px;height:28px;border-radius:14px;background:rgba(120,120,128,.36);display:grid;place-items:center}
  .zc-view{position:relative;flex:1;min-height:0;overflow:hidden;background:#0b0b0c;border-radius:20px;margin:0 4px}
  .zc-view video{width:100%;height:100%;object-fit:cover;display:block;transition:transform .2s ease-out}
  .zc-view video.mirror{transform:scaleX(-1)}
  .zc-grid{position:absolute;inset:0;pointer-events:none;display:none;background:
    linear-gradient(rgba(255,255,255,.35) 1px,transparent 1px) 0 33.333%/100% 33.333%,
    linear-gradient(90deg,rgba(255,255,255,.35) 1px,transparent 1px) 33.333% 0/33.333% 100%}
  .zc-grid.on{display:block}
  .zc-aeaf{position:absolute;top:12px;left:50%;transform:translateX(-50%);background:#ffd60a;color:#000;font-size:12px;font-weight:700;letter-spacing:.3px;padding:4px 10px;border-radius:4px;display:none;z-index:3}
  .zc-aeaf.on{display:block}
  .zc-focus{position:absolute;width:74px;height:74px;border:1.5px solid #ffd60a;transform:translate(-50%,-50%);pointer-events:none;display:none;z-index:3}
  .zc-focus::after{content:"☀";position:absolute;right:-24px;top:50%;transform:translateY(-50%);color:#ffd60a;font-size:16px;text-shadow:0 0 6px rgba(0,0,0,.8)}
  .zc-zoom{position:absolute;bottom:14px;left:50%;transform:translateX(-50%);display:flex;gap:8px;background:rgba(0,0,0,.38);backdrop-filter:blur(10px);padding:4px;border-radius:999px;z-index:3}
  .zc-zoom button{width:32px;height:32px;border-radius:50%;font-size:12px;font-weight:700;display:grid;place-items:center}
  .zc-zoom button.on{background:rgba(0,0,0,.72);color:#ffd60a;width:36px;height:36px}
  .zc-flash{position:absolute;inset:0;background:#000;opacity:0;pointer-events:none;z-index:4}
  .zc-flash.go{animation:zcFlash .22s ease-out}
  @keyframes zcFlash{0%{opacity:.92}100%{opacity:0}}
  .zc-count{position:absolute;inset:0;display:none;place-items:center;font-size:92px;font-weight:200;background:rgba(0,0,0,.22);z-index:4;pointer-events:none}
  .zc-prog{position:absolute;left:0;bottom:0;height:3px;width:0;background:#ffd60a;z-index:5;transition:width .1s linear}
  .zc-status{position:absolute;top:12px;right:12px;background:rgba(0,0,0,.6);backdrop-filter:blur(8px);padding:4px 9px;border-radius:999px;font-size:11px;font-weight:600;color:#ffd60a;display:none;z-index:4}
  .zc-status.on{display:block}
  .zc-modes{height:42px;display:flex;align-items:center;justify-content:center;gap:24px;font-size:12px;font-weight:700;letter-spacing:.6px;flex:none}
  .zc-modes button{color:rgba(255,255,255,.75)}
  .zc-modes button.on{color:#ffd60a}
  .zc-bar{height:102px;display:flex;align-items:center;justify-content:space-around;padding:0 16px;flex:none}
  .zc-thumb{width:50px;height:50px;border-radius:8px;background:#1c1c1e center/cover no-repeat;border:1.5px solid rgba(255,255,255,.25);overflow:hidden;position:relative;display:grid;place-items:center}
  .zc-thumb span{position:absolute;bottom:2px;right:4px;font-size:10px;font-weight:700;background:rgba(0,0,0,.65);padding:0 4px;border-radius:4px}
  .zc-shutter{width:74px;height:74px;border-radius:50%;border:3.5px solid #fff;display:grid;place-items:center;position:relative}
  .zc-shutter i{display:block;width:60px;height:60px;border-radius:50%;background:#fff;transition:transform .1s,background .18s,border-radius .18s}
  .zc-shutter:active i{transform:scale(.9)}
  .zc-shutter.rec i{background:#ff3b30;width:30px;height:30px;border-radius:7px}
  .zc-shutter.busy i{background:#ffd60a;animation:zcPulse 1s infinite}
  @keyframes zcPulse{0%,100%{opacity:1}50%{opacity:.4}}
  .zc-flip{width:48px;height:48px;border-radius:50%;background:rgba(120,120,128,.35);display:grid;place-items:center}

  /* Menu ustawień aparatu */
  .zc-menu{position:absolute;top:56px;left:12px;right:12px;background:rgba(28,28,30,.95);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:4px 0;display:none;z-index:10}
  .zc-menu.open{display:block}
  .zc-row{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.08);font-size:14px}
  .zc-row:last-child{border-bottom:0}
  .zc-row small{display:block;font-size:11px;color:rgba(255,255,255,.58);margin-top:2px}
  .zc-sw{width:44px;height:26px;border-radius:13px;background:#545458;position:relative;transition:background .2s;flex:none}
  .zc-sw::after{content:"";position:absolute;top:2px;left:2px;width:22px;height:22px;border-radius:50%;background:#fff;transition:transform .2s}
  .zc-sw.on{background:#30d158}
  .zc-sw.on::after{transform:translateX(18px)}
  .zc-seg{display:flex;gap:4px;background:rgba(255,255,255,.08);padding:3px;border-radius:10px}
  .zc-seg button{padding:4px 10px;border-radius:8px;font-size:12px;font-weight:600}
  .zc-seg button.on{background:#ffd60a;color:#000}

  /* Komunikat błędu / tryb podglądu bez kamery */
  .zc-err{position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px;text-align:center;background:rgba(10,10,12,.92);z-index:6;font-size:14px}
  .zc-err.on{display:flex}
  .zc-err button{background:#ffd60a;color:#000;font-weight:700;padding:8px 16px;border-radius:999px;font-size:13px}

  /* Wbudowana Galeria Zdjęć i Wideo */
  .zc-gal{position:absolute;inset:0;background:#000;z-index:20;display:none;flex-direction:column}
  .zc-gal.open{display:flex}
  .zc-gal-top{height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;border-bottom:1px solid rgba(255,255,255,.1);flex:none}
  .zc-gal-top h3{margin:0;font-size:16px;font-weight:600}
  .zc-gal-grid{flex:1;overflow-y:auto;padding:8px;display:grid;grid-template-columns:repeat(3,1fr);gap:4px;align-content:start}
  .zc-gal-cell{position:relative;aspect-ratio:1/1;background:#1c1c1e;overflow:hidden;cursor:pointer}
  .zc-gal-cell img,.zc-gal-cell video{width:100%;height:100%;object-fit:cover;display:block}
  .zc-gal-badge{position:absolute;bottom:4px;left:4px;background:rgba(0,0,0,.65);font-size:10px;font-weight:700;padding:2px 5px;border-radius:4px}
  .zc-gal-empty{grid-column:1/-1;text-align:center;padding:60px 20px;color:rgba(255,255,255,.55);font-size:14px}

  /* Podgląd pełnoekranowy pojedynczego elementu galerii */
  .zc-viewer{position:absolute;inset:0;background:#000;z-index:25;display:none;flex-direction:column}
  .zc-viewer.open{display:flex}
  .zc-viewer-top{height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;background:rgba(0,0,0,.75);flex:none}
  .zc-viewer-body{flex:1;display:grid;place-items:center;overflow:hidden;padding:12px}
  .zc-viewer-body img,.zc-viewer-body video{max-width:100%;max-height:100%;object-fit:contain;border-radius:8px}
  .zc-viewer-bot{height:54px;display:flex;align-items:center;justify-content:space-around;border-top:1px solid rgba(255,255,255,.1);flex:none}
  .zc-btn-del{color:#ff453a;font-weight:600;font-size:14px}
  .zc-btn-dl{color:#ffd60a;font-weight:600;font-size:14px}
  `;

  const SVG = {
    bolt: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>',
    chev: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="m6 15 6-6 6 6"/></svg>',
    live: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7" stroke-dasharray="2 2.5"/><path d="M4 4l16 16"/></svg>',
    flip: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 0 0-14-4L4 9"/><path d="M4 4v5h5"/><path d="M4 13a8 8 0 0 0 14 4l2-2"/><path d="M20 20v-5h-5"/></svg>'
  };

  /* =========================================================================
   * 4. GŁÓWNA FUNKCJA OTWIERAJĄCA APLIKACJĘ APARAT + GALERIĘ
   * ========================================================================= */
  function open(container) {
    if (!container) throw new Error('ZeniCamera.open wymaga elementu kontenera.');

    if (!document.getElementById('zc-styles')) {
      const style = document.createElement('style');
      style.id = 'zc-styles';
      style.textContent = STYLES;
      document.head.appendChild(style);
    }

    const root = document.createElement('div');
    root.className = 'zc-wrap';
    root.innerHTML = `
      <div class="zc-top">
        <button class="zc-ic" data-act="torch" title="Latarka">${SVG.bolt}</button>
        <button class="zc-chev" data-act="menu" title="Ustawienia">${SVG.chev}</button>
        <button class="zc-ic" data-act="pro-quick" title="Smart HDR + Deep Fusion" style="font-size:11px;font-weight:800;width:auto;padding:0 10px;border-radius:14px;background:rgba(255,214,10,.18);color:#ffd60a">PRO</button>
      </div>

      <div class="zc-menu">
        <div class="zc-row" data-act="toggle-pro">
          <div>
            <strong>Fotografia obliczeniowa (Pro)</strong>
            <small>10 klatek + Smart HDR + Wyostrzanie + Color Science</small>
          </div>
          <div class="zc-sw on" data-sw="pro"></div>
        </div>
        <div class="zc-row" data-act="toggle-grid">
          <div>
            <strong>Siatka kadru</strong>
            <small>Linie podziału 3×3</small>
          </div>
          <div class="zc-sw" data-sw="grid"></div>
        </div>
        <div class="zc-row">
          <div>
            <strong>Samowyzwalacz</strong>
            <small>Opóźnienie przed wykonaniem zdjęcia</small>
          </div>
          <div class="zc-seg">
            <button data-timer="0" class="on">Wył.</button>
            <button data-timer="3">3 s</button>
            <button data-timer="10">10 s</button>
          </div>
        </div>
      </div>

      <div class="zc-view">
        <video playsinline muted autoplay></video>
        <div class="zc-grid"></div>
        <div class="zc-aeaf">BLOKADA AE/AF</div>
        <div class="zc-focus"></div>
        <div class="zc-status">Przetwarzanie 10 klatek…</div>
        <div class="zc-count"></div>
        <div class="zc-flash"></div>
        <div class="zc-prog"></div>
        <div class="zc-zoom">
          <button data-zoom="0.5" style="display:none">0,5</button>
          <button data-zoom="1" class="on">1×</button>
        </div>
        <div class="zc-err">
          <div class="zc-err-msg">Brak dostępu do kamery.</div>
          <button data-act="retry-cam">Spróbuj ponownie</button>
        </div>
      </div>

      <div class="zc-modes">
        <button data-mode="video">WIDEO</button>
        <button data-mode="photo" class="on">ZDJĘCIE</button>
      </div>

      <div class="zc-bar">
        <button class="zc-thumb" data-act="open-gallery" title="Otwórz galerię"><span>0</span></button>
        <button class="zc-shutter" data-act="shutter" title="Migawka"><i></i></button>
        <button class="zc-flip" data-act="flip" title="Zmień kamerę">${SVG.flip}</button>
      </div>

      <!-- Wbudowana Galeria -->
      <div class="zc-gal">
        <div class="zc-gal-top">
          <button data-act="close-gallery" style="font-size:14px;color:#ffd60a;font-weight:600">Aparat</button>
          <h3>Galeria</h3>
          <button data-act="clear-gallery" style="font-size:12px;color:#ff453a;font-weight:600">Wyczyść</button>
        </div>
        <div class="zc-gal-grid"></div>
      </div>

      <!-- Podgląd pojedynczego zdjęcia/wideo -->
      <div class="zc-viewer">
        <div class="zc-viewer-top">
          <button data-act="close-viewer" style="font-size:14px;color:#ffd60a;font-weight:600">← Galeria</button>
          <span class="zc-viewer-date" style="font-size:12px;opacity:.7"></span>
          <span style="width:50px"></span>
        </div>
        <div class="zc-viewer-body"></div>
        <div class="zc-viewer-bot">
          <button class="zc-btn-dl" data-act="download-item">Pobierz plik</button>
          <button class="zc-btn-del" data-act="delete-item">Usuń</button>
        </div>
      </div>
    `;

    container.appendChild(root);

    const $ = (sel) => root.querySelector(sel);
    const video = $('video');
    const view = $('.zc-view');
    const shutter = $('.zc-shutter');
    const statusEl = $('.zc-status');
    const progEl = $('.zc-prog');
    const flashEl = $('.zc-flash');
    const countEl = $('.zc-count');
    const focusEl = $('.zc-focus');
    const lockEl = $('.zc-aeaf');
    const menuEl = $('.zc-menu');
    const galEl = $('.zc-gal');
    const galGrid = $('.zc-gal-grid');
    const viewerEl = $('.zc-viewer');
    const viewerBody = $('.zc-viewer-body');

    const state = {
      facing: 'environment',
      mode: 'photo',
      pro: true,
      grid: false,
      timer: 0,
      torch: false,
      aeafLocked: false,
      busy: false,
      stream: null,
      recorder: null,
      chunks: [],
      viewerItem: null,
      activeObjectURLs: []
    };

    const trackURL = (blob) => {
      const url = URL.createObjectURL(blob);
      state.activeObjectURLs.push(url);
      return url;
    };

    const revokeTrackedURLs = () => {
      while (state.activeObjectURLs.length) {
        URL.revokeObjectURL(state.activeObjectURLs.pop());
      }
    };

    /* --- Obsługa strumienia kamery --- */
    async function startCamera() {
      stopCamera();
      $('.zc-err').classList.remove('on');
      try {
        const constraints = {
          audio: false,
          video: {
            facingMode: { ideal: state.facing },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        };
        state.stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = state.stream;
        video.classList.toggle('mirror', state.facing === 'user');
        await video.play();

        const track = state.stream.getVideoTracks()[0];
        const caps = track && typeof track.getCapabilities === 'function' ? track.getCapabilities() : {};
        $('[data-zoom="0.5"]').style.display = caps.zoom && caps.zoom.min <= 0.5 ? '' : 'none';
        $('[data-act="torch"]').style.visibility = caps.torch ? 'visible' : 'hidden';
      } catch (err) {
        $('.zc-err-msg').textContent =
          'Nie udało się uruchomić kamery. Sprawdź uprawnienia w przeglądarce (wymagane HTTPS lub localhost).';
        $('.zc-err').classList.add('on');
      }
    }

    function stopCamera() {
      if (state.recorder && state.recorder.state !== 'inactive') {
        try { state.recorder.stop(); } catch (_) {}
      }
      if (state.stream) {
        state.stream.getTracks().forEach((t) => t.stop());
        state.stream = null;
      }
    }

    /* --- Aktualizacja miniatury i galerii --- */
    async function refreshGalleryUI() {
      const items = await ZeniGallery.all();
      const thumbBtn = $('.zc-thumb');
      const countBadge = thumbBtn.querySelector('span');
      if (countBadge) countBadge.textContent = String(items.length);

      const last = items[items.length - 1];
      if (last && last.type === 'photo') {
        thumbBtn.style.backgroundImage = `url("${URL.createObjectURL(last.blob)}")`;
      } else if (last && last.type === 'video') {
        thumbBtn.style.backgroundImage = 'none';
        if (countBadge) countBadge.textContent = `▶ ${items.length}`;
      } else {
        thumbBtn.style.backgroundImage = 'none';
      }

      if (galEl.classList.contains('open')) {
        renderGalleryGrid(items);
      }
    }

    function renderGalleryGrid(items) {
      revokeTrackedURLs();
      galGrid.innerHTML = '';
      if (!items.length) {
        galGrid.innerHTML = '<div class="zc-gal-empty">Brak zapisanych zdjęć ani nagrań.<br>Zrób zdjęcie, aby zapisać je w galerii.</div>';
        return;
      }

      // Najnowsze na górze
      const ordered = [...items].reverse();
      ordered.forEach((item) => {
        const cell = document.createElement('div');
        cell.className = 'zc-gal-cell';
        const url = trackURL(item.blob);

        if (item.type === 'video') {
          const vid = document.createElement('video');
          vid.src = url;
          vid.muted = true;
          vid.playsInline = true;
          cell.appendChild(vid);

          const badge = document.createElement('div');
          badge.className = 'zc-gal-badge';
          badge.textContent = 'WIDEO';
          cell.appendChild(badge);
        } else {
          const img = document.createElement('img');
          img.src = url;
          img.alt = 'Zdjęcie';
          img.loading = 'lazy';
          cell.appendChild(img);
        }

        cell.addEventListener('click', () => openViewer(item));
        galGrid.appendChild(cell);
      });
    }

    function openViewer(item) {
      state.viewerItem = item;
      viewerBody.innerHTML = '';
      const url = URL.createObjectURL(item.blob);
      $('.zc-viewer-date').textContent = new Date(item.date).toLocaleString('pl-PL');

      if (item.type === 'video') {
        const vid = document.createElement('video');
        vid.src = url;
        vid.controls = true;
        vid.autoplay = true;
        vid.playsInline = true;
        viewerBody.appendChild(vid);
      } else {
        const img = document.createElement('img');
        img.src = url;
        img.alt = 'Podgląd zdjęcia';
        viewerBody.appendChild(img);
      }
      viewerEl.classList.add('open');
    }

    function closeViewer() {
      const vid = viewerBody.querySelector('video');
      if (vid && vid.src) URL.revokeObjectURL(vid.src);
      const img = viewerBody.querySelector('img');
      if (img && img.src) URL.revokeObjectURL(img.src);
      viewerBody.innerHTML = '';
      state.viewerItem = null;
      viewerEl.classList.remove('open');
    }

    /* --- Samowyzwalacz i wykonanie zdjęcia --- */
    async function runCountdown(seconds) {
      countEl.style.display = 'grid';
      for (let s = seconds; s > 0; s--) {
        countEl.textContent = String(s);
        await new Promise((r) => setTimeout(r, 1000));
      }
      countEl.style.display = 'none';
    }

    async function handleTakePhoto() {
      if (state.busy) return;
      if (!video.videoWidth || !video.videoHeight) {
        await startCamera();
        if (!video.videoWidth) return;
      }

      state.busy = true;
      shutter.classList.add('busy');

      try {
        if (state.timer > 0) {
          await runCountdown(state.timer);
        }

        flashEl.classList.remove('go');
        void flashEl.offsetWidth;
        flashEl.classList.add('go');

        let photoBlob;
        if (state.pro) {
          statusEl.textContent = 'Smart HDR • 10 klatek…';
          statusEl.classList.add('on');
          photoBlob = await captureProPhoto(video, {
            framesCount: 10,
            quality: 0.95,
            output: 'blob',
            mirror: state.facing === 'user',
            onProgress: (p) => {
              progEl.style.width = `${Math.round(p * 100)}%`;
            }
          });
        } else {
          const c = document.createElement('canvas');
          c.width = video.videoWidth;
          c.height = video.videoHeight;
          const ctx = c.getContext('2d');
          if (state.facing === 'user') {
            ctx.translate(c.width, 0);
            ctx.scale(-1, 1);
          }
          ctx.drawImage(video, 0, 0);
          photoBlob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.95));
        }

        await ZeniGallery.add(photoBlob, 'photo', { pro: state.pro });
        await refreshGalleryUI();
      } catch (err) {
        console.error('Błąd podczas robienia zdjęcia:', err);
      } finally {
        statusEl.classList.remove('on');
        progEl.style.width = '0%';
        shutter.classList.remove('busy');
        state.busy = false;
      }
    }

    /* --- Nagrywanie wideo --- */
    function toggleVideoRecording() {
      if (state.recorder && state.recorder.state === 'recording') {
        state.recorder.stop();
        return;
      }
      if (!state.stream) return;

      state.chunks = [];
      const mimeTypes = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
      const mimeType = mimeTypes.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) || '';
      const mr = new MediaRecorder(state.stream, mimeType ? { mimeType } : undefined);

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) state.chunks.push(e.data);
      };

      mr.onstop = async () => {
        shutter.classList.remove('rec');
        statusEl.classList.remove('on');
        const blob = new Blob(state.chunks, { type: mr.mimeType || 'video/webm' });
        state.recorder = null;
        await ZeniGallery.add(blob, 'video');
        await refreshGalleryUI();
      };

      mr.start(250);
      state.recorder = mr;
      shutter.classList.add('rec');
      statusEl.textContent = 'Nagrywanie…';
      statusEl.classList.add('on');
    }

    /* --- Obsługa kliknięć --- */
    root.addEventListener('click', async (e) => {
      const target = e.target.closest('[data-act],[data-mode],[data-zoom],[data-timer]');
      if (!target) return;

      const act = target.dataset.act;
      if (act === 'shutter') {
        return state.mode === 'photo' ? handleTakePhoto() : toggleVideoRecording();
      }
      if (act === 'flip') {
        state.facing = state.facing === 'environment' ? 'user' : 'environment';
        return startCamera();
      }
      if (act === 'retry-cam') {
        return startCamera();
      }
      if (act === 'menu') {
        return menuEl.classList.toggle('open');
      }
      if (act === 'toggle-pro' || act === 'pro-quick') {
        state.pro = !state.pro;
        $('[data-sw="pro"]').classList.toggle('on', state.pro);
        $('[data-act="pro-quick"]').style.opacity = state.pro ? '1' : '0.45';
        return;
      }
      if (act === 'toggle-grid') {
        state.grid = !state.grid;
        $('[data-sw="grid"]').classList.toggle('on', state.grid);
        $('.zc-grid').classList.toggle('on', state.grid);
        return;
      }
      if (act === 'torch') {
        state.torch = !state.torch;
        target.classList.toggle('on', state.torch);
        try {
          const track = state.stream && state.stream.getVideoTracks()[0];
          if (track) await track.applyConstraints({ advanced: [{ torch: state.torch }] });
        } catch (_) {}
        return;
      }
      if (act === 'open-gallery') {
        menuEl.classList.remove('open');
        const items = await ZeniGallery.all();
        renderGalleryGrid(items);
        galEl.classList.add('open');
        return;
      }
      if (act === 'close-gallery') {
        closeViewer();
        galEl.classList.remove('open');
        revokeTrackedURLs();
        return;
      }
      if (act === 'clear-gallery') {
        await ZeniGallery.clear();
        await refreshGalleryUI();
        return;
      }
      if (act === 'close-viewer') {
        return closeViewer();
      }
      if (act === 'download-item' && state.viewerItem) {
        const ext = state.viewerItem.type === 'video' ? 'webm' : 'jpg';
        const url = URL.createObjectURL(state.viewerItem.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `zeni_${state.viewerItem.type}_${state.viewerItem.date}.${ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return;
      }
      if (act === 'delete-item' && state.viewerItem) {
        const id = state.viewerItem.id;
        closeViewer();
        await ZeniGallery.remove(id);
        await refreshGalleryUI();
        return;
      }
      if (target.dataset.timer !== undefined) {
        state.timer = Number(target.dataset.timer);
        target.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === target));
        return;
      }
      if (target.dataset.mode) {
        state.mode = target.dataset.mode;
        root.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('on', b === target));
        return;
      }
      if (target.dataset.zoom) {
        const z = Number(target.dataset.zoom);
        root.querySelectorAll('[data-zoom]').forEach((b) => b.classList.toggle('on', b === target));
        try {
          const track = state.stream && state.stream.getVideoTracks()[0];
          if (track && track.getCapabilities && track.getCapabilities().zoom) {
            await track.applyConstraints({ advanced: [{ zoom: z }] });
          } else {
            const mirrorScale = state.facing === 'user' ? -1 : 1;
            video.style.transform = `scale(${mirrorScale * z}, ${z})`;
          }
        } catch (_) {}
      }
    });

    /* --- Ostrość i blokada AE/AF --- */
    let holdTimer = null;
    let hideFocusTimer = null;

    view.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.zc-zoom') || e.target.closest('.zc-err')) return;
      menuEl.classList.remove('open');

      const rect = view.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      focusEl.style.left = `${x}px`;
      focusEl.style.top = `${y}px`;
      focusEl.style.display = 'block';
      clearTimeout(hideFocusTimer);
      clearTimeout(holdTimer);

      holdTimer = setTimeout(() => {
        state.aeafLocked = true;
        lockEl.classList.add('on');
      }, 550);
    });

    view.addEventListener('pointerup', () => {
      clearTimeout(holdTimer);
      if (!state.aeafLocked) {
        hideFocusTimer = setTimeout(() => {
          if (!state.aeafLocked) focusEl.style.display = 'none';
        }, 1200);
      }
    });

    lockEl.addEventListener('click', (e) => {
      e.stopPropagation();
      state.aeafLocked = false;
      lockEl.classList.remove('on');
      focusEl.style.display = 'none';
    });

    /* --- Synchronizacja zmian galerii w czasie rzeczywistym --- */
    const onGalleryChanged = () => {
      refreshGalleryUI().catch(() => {});
    };
    window.addEventListener('zeni:gallery-changed', onGalleryChanged);

    /* --- Start --- */
    startCamera();
    refreshGalleryUI();

    return {
      openGallery() {
        const btn = $('[data-act="open-gallery"]');
        if (btn) btn.click();
      },
      close() {
        stopCamera();
        revokeTrackedURLs();
        window.removeEventListener('zeni:gallery-changed', onGalleryChanged);
        root.remove();
      },
      state
    };
  }

  global.captureProPhoto = captureProPhoto;
  global.ZeniGallery = ZeniGallery;
  global.ZeniCamera = { open };
})(typeof window !== 'undefined' ? window : globalThis);
