/* =====================================================================
   ZeniOS — personalizacja ekranu blokady (window.ZeniLock)
   ---------------------------------------------------------------------
   • styl i wykończenie zegara, rozmiar, wysokość, położenie
   • tapeta ekranu blokady + EFEKT GŁĘBI (zegar chowa się za pierwszym planem)
   • sceny z gotową warstwą pierwszego planu + automatyczna analiza horyzontu
     (canvas) dla dowolnej innej tapety, także wgranej przez użytkownika
   • „strażnik czytelności": gdy zegar byłby zbyt zasłonięty, maska jest
     płynnie chowana, a godzina zawsze zostaje czytelna
   • ten sam renderer rysuje miniaturę w Ustawieniach i prawdziwy ekran blokady
   Ładować PO loading.js.
   ===================================================================== */
(function () {
  'use strict';

  const STORE_KEY = 'zenios.lockscreen.v1';
  const HIDE_FRACTION = 0.36;   // jaka część cyfr ma wejść pod pierwszy plan (tryb Auto)
  const COV_OK = 0.45;          // do tego pokrycia cyfr maska jest w pełni widoczna
  const COV_MAX = 0.62;         // powyżej tego pokrycia maska jest całkiem schowana

  /* ------------------------------ konfiguracja ------------------------------ */
  const DEFAULTS = {
    clockStyle: 'slim',      // slim | classic | bold | serif
    finish: 'metal',         // light | metal | match
    size: 1,                 // 0.7 – 1.3
    stretch: 1,              // 0.8 – 1.5 (wysokość cyfr)
    posMode: 'auto',         // auto | manual
    posY: 0.2,               // manual: górna krawędź zegara jako ułamek wysokości ekranu
    depth: true,
    wallpaper: 'sync',       // sync | scene:<id> | custom
    custom: null             // data URL wgranej tapety
  };

  const CLOCK_STYLES = {
    slim:    { name: 'Smukły',      font: '"Helvetica Neue","SF Pro Display","Segoe UI",system-ui,sans-serif', weight: 200, ls: '-0.045em', sx: 0.8,  sy: 1.5 },
    classic: { name: 'Klasyczny',   font: '"Helvetica Neue","SF Pro Display","Segoe UI",system-ui,sans-serif', weight: 500, ls: '-0.03em',  sx: 0.9,  sy: 1.08 },
    bold:    { name: 'Pogrubiony',  font: 'ui-rounded,"SF Pro Rounded","Segoe UI",system-ui,sans-serif',       weight: 800, ls: '-0.04em',  sx: 0.88, sy: 1.05 },
    serif:   { name: 'Elegancki',   font: '"Iowan Old Style","Palatino Linotype",Georgia,serif',               weight: 400, ls: '-0.03em',  sx: 0.95, sy: 1.12 }
  };

  const FINISHES = {
    light: { name: 'Jasny',       fill: 'linear-gradient(180deg,#ffffff 0%,rgba(255,255,255,0.8) 100%)' },
    metal: { name: 'Metaliczny',  fill: 'linear-gradient(165deg,#fff8ec 0%,#e8d4ba 38%,#fffdf8 54%,#d2b48c 100%)' },
    match: { name: 'Z tapety',    fill: null }   // liczone z palety tapety
  };

  /* ----------------------- przykładowe sceny z głębią ----------------------- */
  const SVG_OPEN = '<svg xmlns="http://www.w3.org/2000/svg" width="390" height="844" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice">';
  const toURI = (inner) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(SVG_OPEN + inner + '</svg>');

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function cityFg() {
    const r = mulberry32(7);
    let x = 0, out = '';
    while (x < 390) {
      const w = 24 + Math.floor(r() * 22);
      const top = 515 + Math.floor(r() * 130);
      out += `<rect x="${x}" y="${top}" width="${w}" height="${844 - top}" fill="#0a0612"/>`;
      for (let wy = top + 10; wy < top + 110; wy += 14) {
        for (let wx = x + 5; wx < x + w - 6; wx += 9) {
          if (r() < 0.28) out += `<rect x="${wx}" y="${wy}" width="4" height="6" fill="#ffd479" opacity="0.8"/>`;
        }
      }
      x += w;
    }
    return out;
  }

  const SCENE_DEFS = {
    dunes: {
      name: 'Wydmy',
      bg: '<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a1240"/><stop offset=".38" stop-color="#6b2d73"/><stop offset=".62" stop-color="#ef5f5f"/><stop offset=".78" stop-color="#ffb36b"/></linearGradient><radialGradient id="g"><stop offset="0" stop-color="#fff1c2" stop-opacity=".95"/><stop offset="1" stop-color="#ffb36b" stop-opacity="0"/></radialGradient></defs><rect width="390" height="844" fill="url(#s)"/><circle cx="195" cy="500" r="150" fill="url(#g)"/><circle cx="195" cy="500" r="46" fill="#fff0c4"/><path d="M0 590C90 560 150 575 230 556S350 548 390 566V844H0Z" fill="#7a2e62"/>',
      fg: '<path d="M0 640C70 590 150 585 230 610S340 600 390 570V844H0Z" fill="#2a1233"/><path d="M0 730C90 690 190 700 270 725S360 720 390 700V844H0Z" fill="#12081a"/>'
    },
    waves: {
      name: 'Fala',
      bg: '<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050d24"/><stop offset=".45" stop-color="#0a2f55"/><stop offset=".62" stop-color="#1c7a8c"/></linearGradient><linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0e5a78"/><stop offset="1" stop-color="#06283d"/></linearGradient><radialGradient id="m"><stop offset="0" stop-color="#eaf6ff" stop-opacity=".8"/><stop offset="1" stop-color="#eaf6ff" stop-opacity="0"/></radialGradient></defs><rect width="390" height="844" fill="url(#s)"/><circle cx="300" cy="170" r="90" fill="url(#m)"/><circle cx="300" cy="170" r="30" fill="#eaf6ff"/><rect y="520" width="390" height="324" fill="url(#sea)"/>',
      fg: '<defs><linearGradient id="w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0e6a8a"/><stop offset="1" stop-color="#03202f"/></linearGradient></defs><path d="M0 700C80 640 170 620 250 650S360 700 390 690V844H0Z" fill="#0b3f5c"/><path d="M0 760C40 640 110 520 215 500C300 485 350 530 390 600V844H0Z" fill="url(#w)"/><path d="M0 760C40 640 110 520 215 500C300 485 350 530 390 600" fill="none" stroke="#e6faff" stroke-width="4" stroke-linecap="round" opacity=".7"/>'
    },
    peaks: {
      name: 'Góry',
      bg: '<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d2b64"/><stop offset=".55" stop-color="#8a6fb3"/><stop offset=".8" stop-color="#f8cdda"/></linearGradient><radialGradient id="g"><stop offset="0" stop-color="#fff4d6" stop-opacity=".9"/><stop offset="1" stop-color="#fff4d6" stop-opacity="0"/></radialGradient></defs><rect width="390" height="844" fill="url(#s)"/><circle cx="110" cy="470" r="130" fill="url(#g)"/><circle cx="110" cy="470" r="34" fill="#fff6dc"/><path d="M0 560L60 520L120 560L190 490L260 555L330 515L390 550V844H0Z" fill="#5b4a8c" opacity=".92"/>',
      fg: '<path d="M0 844V610L38 585L82 612L140 520L186 575L232 538L290 602L336 566L390 596V844Z" fill="#150d2e"/>'
    },
    city: {
      name: 'Miasto',
      bg: '<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#240b36"/><stop offset=".6" stop-color="#8b1e5a"/><stop offset=".82" stop-color="#e5533d"/></linearGradient></defs><rect width="390" height="844" fill="url(#s)"/><circle cx="260" cy="440" r="120" fill="#ffb199" opacity=".25"/>',
      fg: cityFg()
    }
  };
  const SCENES = {};
  Object.keys(SCENE_DEFS).forEach((id) => {
    const d = SCENE_DEFS[id];
    SCENES[id] = { id, name: d.name, full: toURI(d.bg + d.fg), fgURI: toURI(d.fg) };
  });

  /* -------------------------------- helpery -------------------------------- */
  const $ = (id) => document.getElementById(id);
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
  const toast = (m) => { if (typeof window.zeniToast === 'function') window.zeniToast(m); };
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function drawCover(ctx, img, w, h) {
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;
    const s = Math.max(w / iw, h / ih);
    const dw = iw * s, dh = ih * s;
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }

  /* Paleta tapety (do wykończenia „Z tapety”). Zwraca null, gdy przeglądarka blokuje odczyt pikseli. */
  function samplePalette(img) {
    try {
      const c = document.createElement('canvas'); c.width = c.height = 32;
      const ctx = c.getContext('2d');
      drawCover(ctx, img, 32, 32);
      const d = ctx.getImageData(0, 0, 32, 32).data;
      let r = 0, g = 0, b = 0, wsum = 0;
      for (let i = 0; i < d.length; i += 4) {
        const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
        const sat = mx ? (mx - mn) / mx : 0;
        const lum = mx / 255;
        const w = 0.05 + sat * (lum > 0.15 ? 1 : 0.2);      // kolorowe, nie-czarne piksele ważą więcej
        r += d[i] * w; g += d[i + 1] * w; b += d[i + 2] * w; wsum += w;
      }
      r /= wsum; g /= wsum; b /= wsum;
      const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255;
      let h = 0; const dl = mx - mn;
      if (dl > 0.001) {
        if (mx === r / 255) h = ((g - b) / 255 / dl) % 6;
        else if (mx === g / 255) h = (b - r) / 255 / dl + 2;
        else h = (r - g) / 255 / dl + 4;
        h = (h * 60 + 360) % 360;
      }
      const sat = clamp(mx ? dl / mx : 0, 0.45, 0.9);
      return { h: Math.round(h), s: Math.round(sat * 100) };
    } catch (e) { return null; }
  }

  /* ---- Analiza horyzontu: szuka ciągłej krawędzi (seam, programowanie dynamiczne) ---- */
  function analyze(img, aspect) {
    try {
      const SW = 72, SH = Math.max(40, Math.round(SW / aspect));
      const c = document.createElement('canvas'); c.width = SW; c.height = SH;
      const ctx = c.getContext('2d');
      drawCover(ctx, img, SW, SH);
      const d = ctx.getImageData(0, 0, SW, SH).data;
      const L = new Float32Array(SW * SH);
      for (let i = 0; i < SW * SH; i++) L[i] = (0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]) / 255;

      const r0 = Math.round(SH * 0.38), r1 = Math.round(SH * 0.93);
      const S = [], sign = [];
      for (let x = 0; x < SW; x++) {
        S.push(new Float32Array(SH)); sign.push(new Int8Array(SH));
        for (let y = r0; y <= r1; y++) {
          let a = 0, b = 0;
          for (let k = 1; k <= 3; k++) { a += L[(y - k) * SW + x]; b += L[Math.min(SH - 1, y + k) * SW + x]; }
          const diff = (b - a) / 3;
          S[x][y] = Math.abs(diff); sign[x][y] = diff >= 0 ? 1 : -1;
        }
      }
      const dp = [], from = [];
      for (let x = 0; x < SW; x++) { dp.push(new Float32Array(SH)); from.push(new Int16Array(SH)); }
      for (let y = r0; y <= r1; y++) dp[0][y] = S[0][y];
      for (let x = 1; x < SW; x++) {
        for (let y = r0; y <= r1; y++) {
          let best = -1, by = y;
          for (let dy = -1; dy <= 1; dy++) {
            const py = y + dy;
            if (py < r0 || py > r1) continue;
            if (dp[x - 1][py] > best) { best = dp[x - 1][py]; by = py; }
          }
          dp[x][y] = S[x][y] + best; from[x][y] = by;
        }
      }
      let endY = r0, best = -1;
      for (let y = r0; y <= r1; y++) if (dp[SW - 1][y] > best) { best = dp[SW - 1][y]; endY = y; }
      const path = new Array(SW);
      let y = endY;
      for (let x = SW - 1; x >= 0; x--) { path[x] = y; y = from[x][y]; }

      let sum = 0, strong = 0, pos = 0, neg = 0;
      for (let x = 0; x < SW; x++) {
        const sc = S[x][path[x]]; sum += sc;
        if (sc > 0.05) { strong++; if (sign[x][path[x]] > 0) pos++; else neg++; }
      }
      const mean = sum / SW, strongFrac = strong / SW;
      const consist = strong ? Math.max(pos, neg) / strong : 0;
      if (mean < 0.06 || strongFrac < 0.65 || consist < 0.7) return { ok: false, reason: 'nofg' };

      let line = path.map((v) => (v + 0.5) / SH);
      for (let pass = 0; pass < 2; pass++) {
        line = line.map((v, i) => (line[Math.max(0, i - 1)] + v + line[Math.min(SW - 1, i + 1)]) / 3);
      }
      return { ok: true, line };
    } catch (e) {
      return { ok: false, reason: 'blocked' };
    }
  }

  /* ------------------------- rozwiązywanie tapety ------------------------- */
  let systemBase = null;
  const cache = new Map();

  async function resolve(cfg) {
    const w = cfg.wallpaper;
    let key, candidates = [], fgSrc = null;
    if (w.indexOf('scene:') === 0) {
      const sc = SCENES[w.slice(6)] || SCENES.dunes;
      key = 'scene:' + sc.id; candidates = [sc.full]; fgSrc = sc.fgURI;
    } else if (w === 'custom' && cfg.custom) {
      key = 'custom:' + cfg.custom.length + ':' + cfg.custom.slice(-24); candidates = [cfg.custom];
    } else {
      key = 'sync:' + systemBase;
      if (systemBase && typeof resolveWallpaperCandidates === 'function') candidates = resolveWallpaperCandidates(systemBase);
    }
    if (cache.has(key)) return cache.get(key);

    const res = { key, imgSrc: null, wallImg: null, fgImg: null, palette: null, reason: null, an: {} };
    for (const c of candidates) {
      try { res.wallImg = await loadImage(c); res.imgSrc = c; break; } catch (e) { /* następny kandydat */ }
    }
    if (fgSrc) { try { res.fgImg = await loadImage(fgSrc); } catch (e) { /* brak warstwy */ } }
    if (res.wallImg) res.palette = samplePalette(res.wallImg);
    if (!res.wallImg) res.reason = 'noimage';
    else if (!res.fgImg && !res.palette) res.reason = 'blocked';   // canvas „zabrudzony” (np. file://)
    cache.set(key, res);
    return res;
  }

  /* ------------------------------ renderer sceny ------------------------------ */
  /* refs: { root, img, block, date, clock, canvas }, opts: { dpr } */
  function renderScene(S, cfg, res) {
    const root = S.root;
    const st = CLOCK_STYLES[cfg.clockStyle] || CLOCK_STYLES.slim;
    const sx = st.sx, sy = st.sy * cfg.stretch;

    root.style.setProperty('--lk-font', st.font);
    root.style.setProperty('--lk-weight', st.weight);
    root.style.setProperty('--lk-ls', st.ls);
    root.style.setProperty('--lk-size', cfg.size);
    root.style.setProperty('--lk-sx', sx);
    root.style.setProperty('--lk-sy', sy);

    let fill = FINISHES[cfg.finish] && FINISHES[cfg.finish].fill;
    if (cfg.finish === 'match') {
      const p = res && res.palette;
      fill = p
        ? `linear-gradient(170deg,hsl(${p.h},${p.s}%,90%) 0%,hsl(${p.h},${Math.min(95, p.s + 10)}%,74%) 100%)`
        : FINISHES.metal.fill;
    }
    root.style.setProperty('--lk-fill', fill);

    if (res && res.imgSrc && S.img.dataset.src !== res.imgSrc) { S.img.src = res.imgSrc; S.img.dataset.src = res.imgSrc; }

    const W = root.clientWidth, H = root.clientHeight;
    const info = { state: 'off', coverage: 0, topFrac: 0, W, H };
    if (!W || !H) return info;

    /* geometria zegara z układu (offset* nie zależą od trwającej animacji transform) */
    const baseTop = S.block.offsetTop + S.clock.offsetTop;
    const hc = S.clock.offsetHeight * sy;
    const wc = S.clock.offsetWidth * sx;
    const gH = hc * 0.8;

    /* warstwa głębi */
    const dpr = S.dpr || 1;
    const cv = S.canvas;
    let depthReady = false, grid = null, GW = 0, GH = 0, refTop = null;

    if (cfg.depth && res) {
      let line = null, usable = false;
      if (res.fgImg) usable = true;
      else if (res.wallImg) {
        const key = (W / H).toFixed(2);
        if (!res.an[key]) res.an[key] = analyze(res.wallImg, W / H);
        const an = res.an[key];
        if (an.ok) { line = an.line; usable = true; } else info.reason = an.reason;
      } else info.reason = res.reason || 'noimage';
      if (res.reason === 'blocked' && !res.fgImg) { usable = false; info.reason = 'blocked'; }

      if (usable) {
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
        const ctx = cv.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
        if (res.fgImg) {
          drawCover(ctx, res.fgImg, W, H);
        } else {
          const mask = document.createElement('canvas'); mask.width = W; mask.height = H;
          const mctx = mask.getContext('2d');
          mctx.beginPath(); mctx.moveTo(0, H);
          line.forEach((v, i) => mctx.lineTo(i / (line.length - 1) * W, v * H));
          mctx.lineTo(W, H); mctx.closePath(); mctx.fillStyle = '#000'; mctx.fill();
          drawCover(ctx, res.wallImg, W, H);
          ctx.globalCompositeOperation = 'destination-in';
          ctx.filter = 'blur(0.8px)';
          ctx.drawImage(mask, 0, 0, W, H);
          ctx.filter = 'none';
        }
        /* ten sam przyciemniający gradient co .lock-scrim, tylko na pikselach pierwszego planu */
        ctx.globalCompositeOperation = 'source-atop';
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, 'rgba(0,0,0,0.22)'); g.addColorStop(0.42, 'rgba(0,0,0,0.08)'); g.addColorStop(1, 'rgba(0,0,0,0.48)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'source-over';

        /* siatka alfa do pomiaru pokrycia */
        GW = 84; GH = Math.max(20, Math.round(GW * H / W));
        const sm = document.createElement('canvas'); sm.width = GW; sm.height = GH;
        const sctx = sm.getContext('2d');
        sctx.drawImage(cv, 0, 0, GW, GH);
        try {
          const px = sctx.getImageData(0, 0, GW, GH).data;
          grid = new Uint8Array(GW * GH);
          for (let i = 0; i < GW * GH; i++) grid[i] = px[i * 4 + 3] > 128 ? 1 : 0;
          depthReady = true;
        } catch (e) { info.reason = 'blocked'; }
      }
    }

    /* wysokość linii pierwszego planu w centrum ekranu */
    if (depthReady) {
      let sum = 0, n = 0;
      for (let gx = Math.round(GW * 0.25); gx <= Math.round(GW * 0.75); gx++) {
        let gy = 0; while (gy < GH && !grid[gy * GW + gx]) gy++;
        sum += gy / GH; n++;
      }
      refTop = (sum / n) * H;
    }

    /* położenie zegara */
    let boxTop = baseTop;
    if (cfg.posMode === 'manual') boxTop = cfg.posY * H;
    else if (depthReady && refTop != null && refTop < H * 0.97) {
      boxTop = clamp(refTop - (1 - HIDE_FRACTION) * gH - 0.1 * hc, H * 0.06, H * 0.72);
    }
    const ty = boxTop - baseTop;
    S.block.style.setProperty('--lk-ty', `${ty}px`);
    info.topFrac = boxTop / H;

    /* strażnik czytelności: pokrycie cyfr i daty przez pierwszy plan */
    const rectCov = (x0, y0, x1, y1) => {
      if (!grid) return 0;
      const cx0 = clamp(Math.floor(x0 / W * GW), 0, GW - 1), cx1 = clamp(Math.ceil(x1 / W * GW), 1, GW);
      const cy0 = clamp(Math.floor(y0 / H * GH), 0, GH - 1), cy1 = clamp(Math.ceil(y1 / H * GH), 1, GH);
      let hit = 0, tot = 0;
      for (let gy = cy0; gy < cy1; gy++) for (let gx = cx0; gx < cx1; gx++) { tot++; hit += grid[gy * GW + gx]; }
      return tot ? hit / tot : 0;
    };
    let opacity = 0;
    if (depthReady) {
      const x0 = (W - wc) / 2, x1 = (W + wc) / 2;
      const cov = rectCov(x0, boxTop + 0.1 * hc, x1, boxTop + 0.9 * hc);
      const dTop = S.block.offsetTop + S.date.offsetTop + ty;
      const dateCov = rectCov(x0, dTop, x1, dTop + S.date.offsetHeight);
      info.coverage = cov;
      opacity = clamp((COV_MAX - cov) / (COV_MAX - COV_OK), 0, 1);
      if (dateCov > 0.03) opacity = 0;
      info.state = opacity < 1 ? 'faded' : (cov < 0.03 ? 'nocontact' : 'active');
    } else if (cfg.depth) {
      info.state = 'unavailable';
    }
    cv.style.opacity = String(opacity);
    S.canvas.dataset.depth = info.state;
    return info;
  }

  /* ---------------------------- kontroler / stan ---------------------------- */
  let cfg = Object.assign({}, DEFAULTS);
  let current = null;          // wynik resolve()
  let token = 0;
  let live = null, prev = null;
  let prevInfo = null, liveInfo = null;
  let settingsOpen = false;
  let ui = {};

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) cfg = Object.assign({}, DEFAULTS, JSON.parse(raw));
    } catch (e) { /* brak localStorage */ }
    if (!CLOCK_STYLES[cfg.clockStyle]) cfg.clockStyle = DEFAULTS.clockStyle;
    if (!FINISHES[cfg.finish]) cfg.finish = DEFAULTS.finish;
    if (cfg.wallpaper === 'custom' && !cfg.custom) cfg.wallpaper = 'sync';
  }

  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(cfg)); }
      catch (e) {
        try { localStorage.setItem(STORE_KEY, JSON.stringify(Object.assign({}, cfg, { custom: null, wallpaper: cfg.wallpaper === 'custom' ? 'sync' : cfg.wallpaper }))); }
        catch (e2) { /* ignoruj */ }
        if (cfg.custom) toast('Własna tapeta jest za duża do zapisu — działa do końca sesji');
      }
    }, 120);
  }

  function tickPreview() {
    if (!prev) return;
    try {
      prev.clock.textContent = formatCurrentClock();
      prev.date.textContent = formatCurrentLockDate();
    } catch (e) { /* funkcje z loading.js niedostępne */ }
  }

  function renderAll() {
    if (live) liveInfo = renderScene(live, cfg, current);
    if (prev && settingsOpen) { tickPreview(); prevInfo = renderScene(prev, cfg, current); }
    updateUI();
  }

  async function refresh() {
    const my = ++token;
    const res = await resolve(cfg);
    if (my !== token) return;
    current = res;
    renderAll();
    buildWallpaperGrid();
  }

  function set(patch) {
    Object.assign(cfg, patch);
    save();
    if (patch.wallpaper !== undefined || patch.custom !== undefined) refresh(); else renderAll();
  }

  function reset() {
    cfg = Object.assign({}, DEFAULTS);
    save();
    refresh();
    toast('Przywrócono ustawienia ekranu blokady');
  }

  /* --------------------------- interfejs w Ustawieniach --------------------------- */
  const NOTES = {
    off: 'Efekt głębi jest wyłączony — zegar zostaje przed tapetą.',
    nocontact: 'Efekt głębi jest aktywny, ale zegar nie dotyka pierwszego planu. Ustaw Położenie na Auto albo przesuń zegar niżej.',
    faded: 'Zegar byłby zbyt zasłonięty — maska głębi została schowana, żeby godzina pozostała czytelna.',
    nofg: 'Ta tapeta nie ma wyraźnego pierwszego planu — efekt głębi wyłączył się automatycznie. Wybierz scenę z listy lub inną tapetę z horyzontem.',
    blocked: 'Przeglądarka blokuje analizę tej tapety (np. przy otwarciu z pliku lokalnego). Wybierz scenę z listy, wgraj własną tapetę albo uruchom ZeniOS z serwera.',
    noimage: 'Nie udało się wczytać tapety.'
  };

  function noteFor(info) {
    if (!info) return '';
    if (info.state === 'active') return `Efekt głębi aktywny — około ${Math.round(info.coverage * 100)}% cyfr wchodzi pod pierwszy plan.`;
    if (info.state === 'unavailable') return NOTES[info.reason] || NOTES.nofg;
    return NOTES[info.state] || '';
  }

  function buildStaticUI() {
    const styleRow = $('lk-style-row');
    if (styleRow && !styleRow.children.length) {
      Object.keys(CLOCK_STYLES).forEach((id) => {
        const st = CLOCK_STYLES[id];
        const b = el('button', 'lk-chip'); b.type = 'button'; b.dataset.style = id;
        const sample = el('span', 'lk-chip-sample', '12:34');
        sample.style.fontFamily = st.font; sample.style.fontWeight = st.weight;
        sample.style.transform = `scale(${st.sx + 0.1}, ${Math.min(1.25, st.sy)})`;
        b.append(sample, el('span', '', st.name));
        b.addEventListener('click', () => set({ clockStyle: id }));
        styleRow.appendChild(b);
      });
    }
    const finRow = $('lk-finish-row');
    if (finRow && !finRow.children.length) {
      Object.keys(FINISHES).forEach((id) => {
        const b = el('button', 'lk-chip'); b.type = 'button'; b.dataset.finish = id;
        const sw = el('span', 'lk-swatch'); sw.dataset.finish = id;
        sw.style.background = FINISHES[id].fill || 'conic-gradient(#ff6b6b,#ffd166,#06d6a0,#4cc9f0,#b388ff,#ff6b6b)';
        b.append(sw, el('span', '', FINISHES[id].name));
        b.addEventListener('click', () => set({ finish: id }));
        finRow.appendChild(b);
      });
    }

    const bindRange = (id, key, fmt) => {
      const r = $(id); if (!r) return;
      r.addEventListener('input', () => {
        const v = parseFloat(r.value);
        const patch = { [key]: v };
        set(patch);
        const out = $(id + '-val'); if (out) out.textContent = fmt(v);
      });
    };
    bindRange('lk-size', 'size', (v) => `${Math.round(v * 100)}%`);
    bindRange('lk-stretch', 'stretch', (v) => `${Math.round(v * 100)}%`);
    bindRange('lk-posy', 'posY', (v) => `${Math.round(v * 100)}%`);

    document.querySelectorAll('[data-lk-pos]').forEach((b) => b.addEventListener('click', () => {
      const mode = b.dataset.lkPos;
      if (mode === 'manual' && cfg.posMode !== 'manual' && prevInfo && prevInfo.topFrac) {
        set({ posMode: 'manual', posY: clamp(prevInfo.topFrac, 0.04, 0.75) });
      } else set({ posMode: mode });
    }));

    const dt = $('lk-depth-toggle');
    if (dt) dt.addEventListener('change', () => set({ depth: dt.checked }));

    const up = $('lk-upload');
    if (up) up.addEventListener('change', () => {
      const f = up.files && up.files[0];
      if (f) handleUpload(f);
      up.value = '';
    });
    const show = $('lk-show-lock');
    if (show) show.addEventListener('click', () => { if (typeof lockScreen === 'function') lockScreen(); });
    const rst = $('lk-reset');
    if (rst) rst.addEventListener('click', reset);
    const row = $('open-lockscreen-picker');
    if (row) row.addEventListener('click', () => { if (typeof openSettingsSubscreen === 'function') openSettingsSubscreen('settings-lockscreen'); });
  }

  function buildWallpaperGrid() {
    const grid = $('lk-wp-grid');
    if (!grid) return;
    grid.textContent = '';
    const tile = (id, label, src, badge) => {
      const b = el('button', 'lk-wp' + (cfg.wallpaper === id ? ' active' : '')); b.type = 'button';
      if (src) { const i = el('img'); i.alt = label; i.src = src; b.appendChild(i); }
      b.appendChild(el('span', 'lk-wp-label', label));
      if (badge) b.appendChild(el('span', 'lk-wp-badge', badge));
      return b;
    };
    const sysImg = $('system-wallpaper');
    const sync = tile('sync', 'Jak ekran główny', sysImg && sysImg.src, null);
    sync.addEventListener('click', () => set({ wallpaper: 'sync' }));
    grid.appendChild(sync);
    Object.keys(SCENES).forEach((id) => {
      const t = tile('scene:' + id, SCENES[id].name, SCENES[id].full, 'Głębia');
      t.addEventListener('click', () => set({ wallpaper: 'scene:' + id }));
      grid.appendChild(t);
    });
    const custom = tile('custom', 'Własna', cfg.custom, null);
    if (!cfg.custom) { custom.classList.add('empty'); custom.insertBefore(el('span', 'lk-wp-plus', '+'), custom.firstChild); }
    custom.addEventListener('click', () => { if (cfg.custom && cfg.wallpaper !== 'custom') set({ wallpaper: 'custom' }); else $('lk-upload').click(); });
    grid.appendChild(custom);
  }

  function updateUI() {
    const setActive = (sel, attr, val) => document.querySelectorAll(sel).forEach((n) => n.classList.toggle('active', n.dataset[attr] === val));
    setActive('#lk-style-row .lk-chip', 'style', cfg.clockStyle);
    setActive('#lk-finish-row .lk-chip', 'finish', cfg.finish);
    document.querySelectorAll('[data-lk-pos]').forEach((n) => n.classList.toggle('active', n.dataset.lkPos === cfg.posMode));
    const dt = $('lk-depth-toggle'); if (dt) dt.checked = cfg.depth;
    [['lk-size', cfg.size], ['lk-stretch', cfg.stretch], ['lk-posy', cfg.posY]].forEach(([id, v]) => {
      const r = $(id); if (!r) return;
      if (document.activeElement !== r) r.value = v;
      const out = $(id + '-val'); if (out) out.textContent = `${Math.round(v * 100)}%`;
    });
    const posy = $('lk-posy'); if (posy) { posy.disabled = cfg.posMode !== 'manual'; posy.closest('.lk-slider-row').classList.toggle('disabled', cfg.posMode !== 'manual'); }
    const note = $('lk-depth-note');
    if (note) {
      const info = prevInfo || liveInfo;
      note.textContent = noteFor(info);
      note.dataset.state = (info && info.state) || 'off';
    }
    const rv = $('lk-row-value');
    if (rv) rv.textContent = `${CLOCK_STYLES[cfg.clockStyle].name} · ${cfg.depth ? 'Głębia' : 'Bez głębi'}`;
    document.querySelectorAll('#lk-wp-grid .lk-wp').forEach(() => {});
  }

  /* wgrywanie własnej tapety: zmniejszamy, żeby zmieścić się w localStorage */
  function handleUpload(file) {
    if (!file.type || file.type.indexOf('image/') !== 0) { toast('Wybierz plik graficzny'); return; }
    const fr = new FileReader();
    fr.onload = async () => {
      try {
        const img = await loadImage(fr.result);
        const maxW = 900, maxH = 1800;
        const s = Math.min(1, maxW / img.naturalWidth, maxH / img.naturalHeight);
        const c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        set({ custom: c.toDataURL('image/jpeg', 0.86), wallpaper: 'custom' });
        toast('Ustawiono własną tapetę');
      } catch (e) { toast('Nie udało się wczytać obrazu'); }
    };
    fr.readAsDataURL(file);
  }

  /* ---------------------------------- init ---------------------------------- */
  function makeScene(root, img, block, date, clock, canvas, dpr) {
    return { root, img, block, date, clock, canvas, dpr };
  }

  function init() {
    load();
    buildStaticUI();

    const layer = $('lockscreen-layer');
    if (layer) {
      live = makeScene(layer, $('lock-wallpaper'), layer.querySelector('.lock-top-block'), $('lock-date'), $('lock-clock'), $('lock-depth'),
        Math.min(2, window.devicePixelRatio || 1));
      if ('ResizeObserver' in window) {
        let t = null;
        new ResizeObserver(() => { clearTimeout(t); t = setTimeout(() => { if (current) renderAll(); }, 60); }).observe(layer);
      }
    }
    const stage = $('lk-stage');
    if (stage) {
      prev = makeScene(stage, $('lk-prev-wall'), $('lk-prev-top'), $('lk-prev-date'), $('lk-prev-clock'), $('lk-prev-depth'), 1);
      setInterval(() => { if (settingsOpen) tickPreview(); }, 1000);
    }

    const sub = $('settings-lockscreen');
    if (sub && 'MutationObserver' in window) {
      new MutationObserver(() => {
        const open = sub.classList.contains('active');
        if (open === settingsOpen) return;
        settingsOpen = open;
        if (open) { buildWallpaperGrid(); requestAnimationFrame(renderAll); }
      }).observe(sub, { attributes: true, attributeFilter: ['class'] });
    }

    buildWallpaperGrid();
    refresh();
  }

  window.ZeniLock = {
    get config() { return Object.assign({}, cfg); },
    get status() { return { live: liveInfo, preview: prevInfo }; },
    set, reset, refresh,
    scenes: SCENES,
    /* wywoływane z setWallpaper() w loading.js, gdy zmienia się tapeta systemowa */
    syncSystemWallpaper(basePath) {
      systemBase = basePath;
      if (live && cfg.wallpaper === 'sync') refresh();
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
