/**
 * Silnik fotografii obliczeniowej (Smart HDR + Deep Fusion style)
 * Wykorzystuje niewidoczny <canvas> oraz operacje na ImageData / Float32Array.
 *
 * @param {HTMLVideoElement} videoElement - Aktywny element <video> ze strumieniem kamery
 * @param {Object} [options] - Opcjonalne parametry przetwarzania
 * @returns {Promise<Blob|string>} Gotowe zdjęcie JPEG (domyślnie Blob, lub DataURL)
 */
async function captureProPhoto(videoElement, options = {}) {
  if (!videoElement || !videoElement.videoWidth || !videoElement.videoHeight) {
    throw new Error('Element <video> nie ma jeszcze aktywnego strumienia ani wymiarów.');
  }

  const {
    framesCount = 10,
    quality = 0.95,
    output = 'blob', // 'blob' | 'dataurl'
    sharpenThreshold = 8,
    sharpenAmount = 1.15,
    contrastAmount = 0.22,
    vibranceAmount = 0.35,
    warmthAmount = 0.04,
    onProgress = null
  } = options;

  const width = videoElement.videoWidth;
  const height = videoElement.videoHeight;
  const pixelCount = width * height;

  // Niewidoczny <canvas> poza drzewem DOM
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const clampByte = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
  const smoothstep = (edge0, edge1, x) => {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  };
  const yieldToUI = () => new Promise((resolve) => setTimeout(resolve, 0));

  // Czeka na kolejną klatkę wideo w pętli requestAnimationFrame
  const waitNextFrame = () =>
    new Promise((resolve) => {
      requestAnimationFrame(() => resolve());
    });

  // ---------------------------------------------------------------------------
  // 1. MULTI-FRAME NOISE REDUCTION (Uśrednianie 10 klatek w pętli rAF)
  // ---------------------------------------------------------------------------
  // Akumulator RGB w Float32Array (3 wartości na piksel: R, G, B)
  const rgbBuffer = new Float32Array(pixelCount * 3);

  for (let f = 0; f < framesCount; f++) {
    await waitNextFrame();
    ctx.drawImage(videoElement, 0, 0, width, height);
    const frameData = ctx.getImageData(0, 0, width, height).data;

    for (let p = 0, c = 0; p < frameData.length; p += 4, c += 3) {
      rgbBuffer[c] += frameData[p];
      rgbBuffer[c + 1] += frameData[p + 1];
      rgbBuffer[c + 2] += frameData[p + 2];
    }

    if (typeof onProgress === 'function') {
      onProgress(((f + 1) / framesCount) * 0.55);
    }
  }

  const invFrames = 1 / framesCount;
  for (let i = 0; i < rgbBuffer.length; i++) {
    rgbBuffer[i] *= invFrames;
  }

  await yieldToUI();

  // ---------------------------------------------------------------------------
  // 2. SMART HDR / TONE MAPPING (Rozpiętość tonalna wg luminancji L)
  // L = 0.299R + 0.587G + 0.114B
  // Mocne rozjaśnienie cieni (L < 80), środek neutralny, kompresja świateł (L > 200)
  // ---------------------------------------------------------------------------
  const toneGainLUT = new Float32Array(256);

  const shadowLiftCurve = (L) => {
    const norm = L / 255;
    // Podniesienie cieni (gamma < 1) z płynnym zanikiem powyżej L ~ 80-115
    const lifted = Math.pow(norm, 0.52);
    const shadowWeight = 1 - smoothstep(45, 115, L);
    return norm + (lifted - norm) * shadowWeight;
  };

  const baseAt200 = shadowLiftCurve(200);

  for (let l = 0; l < 256; l++) {
    let mappedNorm = shadowLiftCurve(l);

    // Delikatna kompresja świateł powyżej L = 200, aby uniknąć przepaleń
    if (l > 200) {
      const highlightExcess = mappedNorm - baseAt200;
      mappedNorm = baseAt200 + highlightExcess * 0.55;
    }

    const targetL = mappedNorm * 255;
    // Ograniczamy maksymalne wzmocnienie (gain), aby nie wyciągać szumu z głębokiej czerni
    const gain = l < 2 ? 1.0 : Math.min(3.4, targetL / l);
    toneGainLUT[l] = gain;
  }

  for (let c = 0; c < rgbBuffer.length; c += 3) {
    const r = rgbBuffer[c];
    const g = rgbBuffer[c + 1];
    const b = rgbBuffer[c + 2];

    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const lumIdx = lum < 0 ? 0 : lum > 255 ? 255 : lum | 0;
    const gain = toneGainLUT[lumIdx];

    rgbBuffer[c] = clampByte(r * gain);
    rgbBuffer[c + 1] = clampByte(g * gain);
    rgbBuffer[c + 2] = clampByte(b * gain);
  }

  if (typeof onProgress === 'function') onProgress(0.72);
  await yieldToUI();

  // ---------------------------------------------------------------------------
  // 3. INTELLIGENT SHARPENING (Unsharp Mask na luminancji z progiem)
  // Wyostrza tylko krawędzie przekraczające próg, chroniąc gładkie powierzchnie
  // ---------------------------------------------------------------------------
  const lumPlane = new Float32Array(pixelCount);
  for (let p = 0, c = 0; p < pixelCount; p++, c += 3) {
    lumPlane[p] = 0.299 * rgbBuffer[c] + 0.587 * rgbBuffer[c + 1] + 0.114 * rgbBuffer[c + 2];
  }

  // Separowalne rozmycie Gaussa 3x3 ([1, 2, 1] / 4 w poziomie i pionie)
  const horizBlur = new Float32Array(pixelCount);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      const xLeft = x > 0 ? x - 1 : 0;
      const xRight = x < width - 1 ? x + 1 : width - 1;
      horizBlur[rowOffset + x] =
        (lumPlane[rowOffset + xLeft] + 2 * lumPlane[rowOffset + x] + lumPlane[rowOffset + xRight]) * 0.25;
    }
  }

  const blurredLum = new Float32Array(pixelCount);
  for (let y = 0; y < height; y++) {
    const yUp = (y > 0 ? y - 1 : 0) * width;
    const yMid = y * width;
    const yDown = (y < height - 1 ? y + 1 : height - 1) * width;
    for (let x = 0; x < width; x++) {
      blurredLum[yMid + x] =
        (horizBlur[yUp + x] + 2 * horizBlur[yMid + x] + horizBlur[yDown + x]) * 0.25;
    }
  }

  const maxEdgeDelta = 26; // zabezpieczenie przed jasnymi/ciemnymi obwódkami (halo)
  for (let p = 0, c = 0; p < pixelCount; p++, c += 3) {
    const detail = lumPlane[p] - blurredLum[p];
    const absDetail = Math.abs(detail);

    if (absDetail <= sharpenThreshold) {
      continue; // brak wyostrzania na gładkich powierzchniach i szumie
    }

    const maskWeight = smoothstep(sharpenThreshold, sharpenThreshold * 2.5, absDetail);
    let delta = detail * sharpenAmount * maskWeight;
    if (delta > maxEdgeDelta) delta = maxEdgeDelta;
    else if (delta < -maxEdgeDelta) delta = -maxEdgeDelta;

    rgbBuffer[c] = clampByte(rgbBuffer[c] + delta);
    rgbBuffer[c + 1] = clampByte(rgbBuffer[c + 1] + delta);
    rgbBuffer[c + 2] = clampByte(rgbBuffer[c + 2] + delta);
  }

  if (typeof onProgress === 'function') onProgress(0.86);
  await yieldToUI();

  // ---------------------------------------------------------------------------
  // 4. APPLE COLOR SCIENCE (Krzywa S kontrastu + Vibrance + ocieplenie WB)
  // ---------------------------------------------------------------------------
  for (let c = 0; c < rgbBuffer.length; c += 3) {
    // Subtelne ocieplenie balansu bieli (lekko więcej czerwieni, mniej niebieskiego)
    let r = clampByte(rgbBuffer[c] * (1 + warmthAmount));
    let g = clampByte(rgbBuffer[c + 1] * (1 + warmthAmount * 0.25));
    let b = clampByte(rgbBuffer[c + 2] * (1 - warmthAmount));

    // Delikatna krzywa S dla kontrastu i mikrokontrastu
    const applySCurve = (val) => {
      const x = val / 255;
      const sCurve = x * x * (3 - 2 * x);
      return 255 * (x + (sCurve - x) * contrastAmount);
    };

    r = applySCurve(r);
    g = applySCurve(g);
    b = applySCurve(b);

    // Vibrance: mocniej podbija kolory mało nasycone, łagodniej już nasycone
    const maxCh = Math.max(r, g, b);
    const minCh = Math.min(r, g, b);
    const saturation = maxCh > 0 ? (maxCh - minCh) / maxCh : 0;
    const vibranceBoost = 1 + vibranceAmount * (1 - saturation);
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;

    rgbBuffer[c] = clampByte(luma + (r - luma) * vibranceBoost);
    rgbBuffer[c + 1] = clampByte(luma + (g - luma) * vibranceBoost);
    rgbBuffer[c + 2] = clampByte(luma + (b - luma) * vibranceBoost);
  }

  if (typeof onProgress === 'function') onProgress(0.95);

  // ---------------------------------------------------------------------------
  // 5. ZAPIS DO ImageData I EKSPORT DO JPEG (0.95)
  // ---------------------------------------------------------------------------
  const outputImageData = ctx.createImageData(width, height);
  const outData = outputImageData.data;

  for (let p = 0, c = 0; p < outData.length; p += 4, c += 3) {
    outData[p] = rgbBuffer[c];
    outData[p + 1] = rgbBuffer[c + 1];
    outData[p + 2] = rgbBuffer[c + 2];
    outData[p + 3] = 255;
  }

  ctx.putImageData(outputImageData, 0, 0);

  const result =
    output === 'dataurl'
      ? canvas.toDataURL('image/jpeg', quality)
      : await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));

  if (typeof onProgress === 'function') onProgress(1);
  return result;
}
