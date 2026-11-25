/* zeni-camera.js – obsługa gotowego aparatu z HTML + ZeniGallery */
(function (global) {
  'use strict';

  // Baza danych dla zdjęć
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

  // Główna funkcja otwierająca aparat
  function open(container) {
    const camLayer = document.getElementById('camera-layer');
    if (!camLayer) {
      console.error('Brak #camera-layer w HTML');
      return;
    }

    // Pokaż aparat
    camLayer.classList.add('active');
    camLayer.setAttribute('aria-hidden', 'false');

    const video = document.getElementById('camera-video');
    const shutter = document.getElementById('camera-shutter');
    const closeBtn = document.getElementById('camera-close');
    const thumb = document.getElementById('camera-thumb');
    const switchBtn = document.getElementById('camera-switch');
    const flashBtn = document.getElementById('camera-flash-btn');
    const gridBtn = document.getElementById('camera-grid-btn');
    const liveBtn = document.getElementById('camera-live');
    const roll = document.getElementById('camera-roll');
    const rollGrid = document.getElementById('camera-roll-grid');
    const rollClose = document.getElementById('camera-roll-close');

    let stream = null;
    let facing = 'environment';
    let flashMode = 'auto';
    let isGridOn = false;
    let isBusy = false;

    // Uruchom kamerę
    async function start() {
      stop();
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 3840 }, height: { ideal: 2160 } },
          audio: false
        });
        video.srcObject = stream;
        await video.play();
      } catch (e) {
        console.error('Błąd kamery:', e);
      }
    }

    function stop() {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
        stream = null;
      }
    }

    // Miniatura
    async function refreshThumb() {
      try {
        const items = await ZeniGallery.all();
        const last = items[items.length - 1];
        if (last && last.type === 'photo') {
          thumb.style.backgroundImage = `url(${URL.createObjectURL(last.blob)})`;
          thumb.classList.remove('empty');
        }
      } catch (_) {}
    }

    // Robienie zdjęcia
    async function takePhoto() {
      if (isBusy || !video.videoWidth) return;
      isBusy = true;
      shutter.style.opacity = '0.5';

      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);

        const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.95));
        await ZeniGallery.add(blob, 'photo');
        await refreshThumb();

        // Błysk
        const flash = document.getElementById('camera-flash');
        if (flash) {
          flash.style.opacity = '1';
          setTimeout(() => flash.style.opacity = '0', 150);
        }
      } catch (e) {
        console.error('Błąd zdjęcia:', e);
      }

      shutter.style.opacity = '1';
      isBusy = false;
    }

    // Rolka zdjęć
    async function openRoll() {
      rollGrid.innerHTML = '';
      const items = await ZeniGallery.all();
      if (items.length === 0) {
        rollGrid.innerHTML = '<p style="color:#888;text-align:center;padding:20px;">Brak zdjęć</p>';
      } else {
        items.reverse().forEach(item => {
          if (item.type === 'photo') {
            const img = document.createElement('img');
            img.src = URL.createObjectURL(item.blob);
            img.style.cssText = 'width:100%; aspect-ratio:1; object-fit:cover;';
            rollGrid.appendChild(img);
          }
        });
      }
      roll.classList.add('open');
      roll.setAttribute('aria-hidden', 'false');
    }

    function closeRoll() {
      roll.classList.remove('open');
      roll.setAttribute('aria-hidden', 'true');
    }

    // Zamykanie
    function close() {
      stop();
      camLayer.classList.remove('active');
      camLayer.setAttribute('aria-hidden', 'true');
      if (currentInstance === api) currentInstance = null;
    }

    // Podpięcie zdarzeń
    closeBtn.onclick = close;
    shutter.onclick = takePhoto;
    switchBtn.onclick = () => {
      facing = facing === 'environment' ? 'user' : 'environment';
      start();
    };
    flashBtn.onclick = () => {
      const modes = ['auto', 'on', 'off'];
      flashMode = modes[(modes.indexOf(flashMode) + 1) % modes.length];
      flashBtn.querySelector('span').textContent = flashMode === 'auto' ? 'Auto' : flashMode === 'on' ? 'Wł.' : 'Wył.';
    };
    gridBtn.onclick = () => {
      isGridOn = !isGridOn;
      const grid = document.getElementById('camera-grid');
      if (grid) grid.style.display = isGridOn ? 'grid' : 'none';
    };
    liveBtn.onclick = openRoll;
    rollClose.onclick = closeRoll;
    thumb.onclick = openRoll;

    start();
    refreshThumb();

    const api = { close };
    currentInstance = api;
    return api;
  }

  let currentInstance = null;

  global.ZeniGallery = ZeniGallery;
  global.ZeniCamera = {
    open,
    close: () => {
      if (currentInstance) currentInstance.close();
    }
  };
})(window);
