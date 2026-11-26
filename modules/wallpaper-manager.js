const WallpaperManager = (() => {
    const STORAGE_KEY = 'zenos_wallpaper_v1';
    const BASE_PATH = 'default_wallpapers/';
    const EXTENSIONS = ['', '.png', '.jpg', '.jpeg', '.webp'];

    const DEFAULT_WALLPAPERS = [
        { id: 'wp-1', name: 'Tapeta 1', file: 'default_wallpaper_1' },
        { id: 'wp-2', name: 'Tapeta 2', file: 'default_wallpaper_2' },
        { id: 'wp-3', name: 'Tapeta 3', file: 'default_wallpaper_3' },
        { id: 'wp-4', name: 'Tapeta 4', file: 'default_wallpaper_4' },
        { id: 'wp-5', name: 'Tapeta 5', file: 'default_wallpaper_5' },
        { id: 'wp-6', name: 'Tapeta 6', file: 'default_wallpaper_6' },
        { id: 'wp-7', name: 'Tapeta 7', file: 'default_wallpaper_7' }
    ];

    let current = loadState();

    function loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return { wallpaperId: 'wp-1', customDataUrl: '' };
            return { wallpaperId: 'wp-1', customDataUrl: '', ...JSON.parse(raw) };
        } catch {
            return { wallpaperId: 'wp-1', customDataUrl: '' };
        }
    }

    function saveState() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
        } catch {}
    }

    function resolveImageUrl(wp, callback) {
        if (!wp) return;
        if (wp.customDataUrl) {
            callback(wp.customDataUrl);
            return;
        }
        const candidates = EXTENSIONS.map(ext => `${BASE_PATH}${wp.file}${ext}`);
        let idx = 0;

        const tryNext = () => {
            if (idx >= candidates.length) {
                callback(`${BASE_PATH}${wp.file}`);
                return;
            }
            const url = candidates[idx++];
            const img = new Image();
            img.onload = () => callback(url);
            img.onerror = tryNext;
            img.src = url;
        };
        tryNext();
    }

    function applyToDom(url) {
        const bgValue = `url("${url}") center / cover no-repeat fixed`;
        document.documentElement.style.setProperty('--zenos-wallpaper', `url("${url}")`);
        document.body.style.background = bgValue;

        const layer = document.querySelector('#wallpaper-layer, .wallpaper-layer, [data-wallpaper-layer]');
        if (layer) {
            layer.style.background = `url("${url}") center / cover no-repeat`;
        }
    }

    function applyCurrent() {
        if (current.customDataUrl) {
            applyToDom(current.customDataUrl);
            broadcast();
            return;
        }
        const wp = DEFAULT_WALLPAPERS.find(w => w.id === current.wallpaperId) || DEFAULT_WALLPAPERS[0];
        resolveImageUrl(wp, (resolvedUrl) => {
            applyToDom(resolvedUrl);
            broadcast(resolvedUrl);
        });
    }

    function broadcast(resolvedUrl = '') {
        const payload = {
            type: 'WALLPAPER_CHANGED',
            wallpaperId: current.wallpaperId,
            hasCustom: Boolean(current.customDataUrl),
            url: current.customDataUrl || resolvedUrl
        };
        try {
            window.postMessage(payload, '*');
            document.querySelectorAll('iframe').forEach(frame => {
                try { frame.contentWindow?.postMessage(payload, '*'); } catch {}
            });
        } catch {}
    }

    function setWallpaper(wallpaperId) {
        current.wallpaperId = wallpaperId;
        current.customDataUrl = '';
        saveState();
        applyCurrent();
    }

    function setCustomWallpaper(dataUrl) {
        if (!dataUrl) return;
        current.wallpaperId = 'custom';
        current.customDataUrl = dataUrl;
        saveState();
        applyCurrent();
    }

    function getWallpapers() {
        return DEFAULT_WALLPAPERS.slice();
    }

    function openQuickPicker() {
        if (document.getElementById('zenos-wp-picker')) return;

        const overlay = document.createElement('div');
        overlay.id = 'zenos-wp-picker';
        overlay.style.cssText = `
            position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.65);
            backdrop-filter:blur(14px);display:flex;align-items:flex-end;justify-content:center;
            font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display",system-ui,sans-serif;
        `;

        const sheet = document.createElement('div');
        sheet.style.cssText = `
            width:100%;max-width:460px;background:rgba(24,25,30,0.94);color:#fff;
            border-top-left-radius:26px;border-top-right-radius:26px;padding:18px 16px 32px;
            border-top:1px solid rgba(255,255,255,0.16);
        `;

        sheet.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                <strong style="font-size:17px;">Wybierz tapetę</strong>
                <button id="zenos-wp-close" style="background:rgba(255,255,255,0.14);color:#fff;border:1px solid rgba(255,255,255,0.2);border-radius:999px;padding:6px 12px;font-weight:600;cursor:pointer;">Gotowe</button>
            </div>
            <div id="zenos-wp-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px;"></div>
            <label style="display:block;text-align:center;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.18);border-radius:14px;padding:10px;font-size:13.5px;font-weight:600;cursor:pointer;">
                Własny obrazek z urządzenia
                <input id="zenos-wp-file" type="file" accept="image/*" style="display:none;">
            </label>
        `;

        overlay.appendChild(sheet);
        document.body.appendChild(overlay);

        const grid = sheet.querySelector('#zenos-wp-grid');
        DEFAULT_WALLPAPERS.forEach(wp => {
            const tile = document.createElement('div');
            const active = current.wallpaperId === wp.id && !current.customDataUrl;
            tile.style.cssText = `
                aspect-ratio:9/16;border-radius:14px;overflow:hidden;position:relative;cursor:pointer;
                border:2px solid ${active ? '#ffd60a' : 'rgba(255,255,255,0.16)'};
                background:#1a1c24;display:flex;align-items:flex-end;padding:6px;
            `;
            resolveImageUrl(wp, (url) => {
                tile.style.background = `url("${url}") center / cover no-repeat`;
            });
            tile.innerHTML = `<span style="font-size:11px;font-weight:700;background:rgba(0,0,0,0.55);padding:2px 6px;border-radius:8px;">${wp.name}</span>`;
            tile.onclick = () => {
                setWallpaper(wp.id);
                overlay.remove();
            };
            grid.appendChild(tile);
        });

        sheet.querySelector('#zenos-wp-file').onchange = (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                setCustomWallpaper(String(reader.result || ''));
                overlay.remove();
            };
            reader.readAsDataURL(file);
        };

        const close = () => overlay.remove();
        sheet.querySelector('#zenos-wp-close').onclick = close;
        overlay.onclick = (e) => { if (e.target === overlay) close(); };
    }

    function bindLongPress(selectorOrEl, delayMs = 550) {
        const target = typeof selectorOrEl === 'string'
            ? document.querySelector(selectorOrEl)
            : (selectorOrEl || document.body);
        if (!target) return;

        let timer = null;
        let startX = 0;
        let startY = 0;

        const clear = () => {
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
        };

        target.addEventListener('pointerdown', (e) => {
            if (e.target.closest('button, a, input, .app-icon, .widget, .dock, .modal, .sheet')) return;
            startX = e.clientX;
            startY = e.clientY;
            clear();
            timer = setTimeout(() => {
                timer = null;
                openQuickPicker();
            }, delayMs);
        });

        target.addEventListener('pointermove', (e) => {
            if (!timer) return;
            if (Math.hypot(e.clientX - startX, e.clientY - startY) > 12) {
                clear();
            }
        });

        ['pointerup', 'pointercancel', 'contextmenu'].forEach(ev => {
            target.addEventListener(ev, (e) => {
                if (ev === 'contextmenu' && timer) e.preventDefault();
                clear();
            });
        });
    }

    function init(options = {}) {
        applyCurrent();
        bindLongPress(options.longPressTarget || document.body, options.longPressMs || 550);
    }

    return { init, setWallpaper, setCustomWallpaper, getWallpapers, openQuickPicker, bindLongPress };
})();
