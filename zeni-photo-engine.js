/* zeni-photo-engine.js
 * Silnik "fotografii obliczeniowej" w czystym JS (Canvas + ImageData).
 * Użycie: const blob = await captureProPhoto(videoEl);
 *         const url  = await captureProPhoto(videoEl, { output: 'dataurl' });
 */
(function (global) {
  'use strict';

  const smooth = (e0, e1, x) => {
    const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  };
  const clamp255 = v => (v < 0 ? 0 : v > 255 ? 255 : v);
  const tick = () => new Promise(r => setTimeout(r, 0)); // oddaje wątek UI

  // Czeka na NOWĄ klatkę wideo (rVFC), a gdy brak – na requestAnimationFrame
  function nextFrame(video) {
    return new Promise(res => {
      if ('requestVideoFrameCallback' in video) video.requestVideoFrameCallback(() => res());
      else requestAnimationFrame(() => res());
    });
  }

  /* 1. Multi-Frame Noise Reduction – akumulacja w Float32 (bez trzymania 10 klatek w RAM) */
  async function averageFrames(video, ctx, W, H, frames, onProgress) {
    const acc = new Float32Array(W * H * 3);
    for (let f = 0; f < frames; f++) {
      await nextFrame(video);
      ctx.drawImage(video, 0, 0, W, H);
      const d = ctx.getImageData(0, 0, W, H).data;
      for (let p = 0, j = 0; p < d.length; p += 4, j += 3) {
        acc[j] += d[p]; acc[j + 1] += d[p + 1]; acc[j + 2] += d[p + 2];
      }
      onProgress && onProgress((f + 1) / frames * 0.6);
    }
    const inv = 1 / frames;
    for (let i = 0; i < acc.length; i++) acc[i] *= inv;
    return acc;
  }

  /* 2. Smart HDR / Tone mapping: mocno rozjaśnia cienie (L<80), środek bez zmian, światła (L>200) kompresuje */
  function buildToneGainLUT() {
    const y = L => {
      const t = L / 255;
      const lifted = Math.pow(t, 0.55);
      const w = 1 - smooth(40, 110, L);          // wpływ tylko w cieniach, wygasa do ~110
      return t + (lifted - t) * w;
    };
    const y200 = y(200);
    const lut = new Float32Array(256);
    for (let L = 0; L < 256; L++) {
      let v = y(L);
      if (L > 200) v = y200 + (v - y200) * 0.6;  // miękkie ramię świateł
      lut[L] = L < 1 ? 1 : Math.min(3.5, (v * 255) / L); // limit zysku, by nie wzmacniać szumu
    }
    return lut;
  }

  function toneMap(px) {
    const lut = buildToneGainLUT();
    for (let i = 0; i < px.length; i += 3) {
      const L = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      const g = lut[Math.min(255, L | 0)];
      px[i] = clamp255(px[i] * g);
      px[i + 1] = clamp255(px[i + 1] * g);
      px[i + 2] = clamp255(px[i + 2] * g);
    }
  }

  /* 3. Inteligentne wyostrzanie: unsharp mask na luminancji z progiem */
  function sharpen(px, W, H, { threshold = 6, amount = 1.2, maxBoost = 28 } = {}) {
    const n = W * H;
    const Y = new Float32Array(n);
    for (let p = 0, i = 0; p < n; p++, i += 3) Y[p] = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];

    // rozmycie [1 2 1] separowalne
    const tmp = new Float32Array(n), B = new Float32Array(n);
    for (let y = 0; y < H; y++) {
      const r = y * W;
      for (let x = 0; x < W; x++) {
        const a = Y[r + Math.max(0, x - 1)], b = Y[r + x], c = Y[r + Math.min(W - 1, x + 1)];
        tmp[r + x] = (a + 2 * b + c) * 0.25;
      }
    }
    for (let y = 0; y < H; y++) {
      const y0 = Math.max(0, y - 1) * W, y1 = y * W, y2 = Math.min(H - 1, y + 1) * W;
      for (let x = 0; x < W; x++) B[y1 + x] = (tmp[y0 + x] + 2 * tmp[y1 + x] + tmp[y2 + x]) * 0.25;
    }
    for (let p = 0, i = 0; p < n; p++, i += 3) {
      const d = Y[p] - B[p];
      const a = Math.abs(d);
      if (a <= threshold) continue;                       // gładkie powierzchnie: bez zmian
      let boost = d * amount * smooth(threshold, threshold * 2.5, a);
      boost = Math.max(-maxBoost, Math.min(maxBoost, boost)); // ogranicza halo
      px[i] = clamp255(px[i] + boost);
      px[i + 1] = clamp255(px[i + 1] + boost);
      px[i + 2] = clamp255(px[i + 2] + boost);
    }
  }

  /* 4. Apple Color Science: krzywa S + vibrance + lekkie ocieplenie */
  function colorScience(px, { contrast = 0.22, vibrance = 0.38, warmth = 0.03 } = {}) {
    for (let i = 0; i < px.length; i += 3) {
      let r = px[i] * (1 + warmth), g = px[i + 1], b = px[i + 2] * (1 - warmth);
      r = clamp255(r); b = clamp255(b);

      // krzywa S (mieszanie z smoothstep)
      const s = c => { const x = c / 255; return 255 * (x + (x * x * (3 - 2 * x) - x) * contrast); };
      r = s(r); g = s(g); b = s(b);

      // vibrance: mocniej dla mało nasyconych
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      const sat = mx > 0 ? (mx - mn) / mx : 0;
      const k = 1 + vibrance * (1 - sat);
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      px[i] = clamp255(gray + (r - gray) * k);
      px[i + 1] = clamp255(gray + (g - gray) * k);
      px[i + 2] = clamp255(gray + (b - gray) * k);
    }
  }

  /* 5. Integracja */
  async function captureProPhoto(videoElement, opts = {}) {
    const { frames = 10, quality = 0.95, output = 'blob', onProgress } = opts;
    const W = videoElement.videoWidth, H = videoElement.videoHeight;
    if (!W || !H) throw new Error('Wideo nie jest gotowe (brak wymiarów).');

    const canvas = document.createElement('canvas'); // niewidoczny, nie dodajemy do DOM
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const px = await averageFrames(videoElement, ctx, W, H, frames, onProgress);
    await tick(); toneMap(px);                onProgress && onProgress(0.72);
    await tick(); sharpen(px, W, H, opts.sharpen); onProgress && onProgress(0.86);
    await tick(); colorScience(px, opts.color);    onProgress && onProgress(0.95);

    const img = ctx.createImageData(W, H);
    const out = img.data;
    for (let p = 0, j = 0; p < out.length; p += 4, j += 3) {
      out[p] = px[j]; out[p + 1] = px[j + 1]; out[p + 2] = px[j + 2]; out[p + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);

    const result = output === 'dataurl'
      ? canvas.toDataURL('image/jpeg', quality)
      : await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality));
    onProgress && onProgress(1);
    return result;
  }

  global.captureProPhoto = captureProPhoto;
})(typeof window !== 'undefined' ? window : globalThis);
