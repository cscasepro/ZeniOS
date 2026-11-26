const Display = {
    init() {
        this.renderDesktop();
    },

    renderDesktop() {
        const grid = document.getElementById('app-grid');
        if (!grid) return;

        const isSafeMode = typeof Bootloader !== 'undefined' && Bootloader.isSafeMode;
        const apps = typeof Manifest !== 'undefined' ? Manifest.getApps() : [];

        grid.innerHTML = '';

        apps.forEach(app => {
            if (!app.enabled) return;
            if (isSafeMode && app.id !== 'ustawienia' && app.id !== 'aktualizacje') return;

            const iconEl = document.createElement('div');
            iconEl.className = 'app-icon priority-top';
            iconEl.dataset.appId = app.id;
            iconEl.onclick = () => {
                if (typeof Kernel !== 'undefined') Kernel.openApp(app.id);
            };

            const box = document.createElement('div');
            box.className = 'app-icon-box';

            const fallbackSpan = document.createElement('span');
            fallbackSpan.className = 'app-icon-fallback';
            fallbackSpan.textContent = app.fallback || app.name.slice(0, 1).toUpperCase();

            if (app.icon) {
                const img = document.createElement('img');
                img.src = app.icon;
                img.alt = app.name;
                img.loading = 'eager';
                img.onerror = () => {
                    img.remove();
                    box.appendChild(fallbackSpan);
                };
                box.appendChild(img);
            } else {
                box.appendChild(fallbackSpan);
            }

            const label = document.createElement('span');
            label.className = 'app-label';
            label.textContent = app.name;

            iconEl.appendChild(box);
            iconEl.appendChild(label);
            grid.appendChild(iconEl);
        });
    },

    showHome() {
        this.hideOverlays(['recents-view', 'control-center-frame', 'notifications-frame', 'search-frame']);
        if (typeof PerformanceManager !== 'undefined') {
            PerformanceManager.suspendAllBackground();
        }
    },

    toggleOverlay(frameId) {
        const target = document.getElementById(frameId);
        if (!target) return;

        const willOpen = target.classList.contains('hidden');
        this.hideOverlays(['recents-view', 'control-center-frame', 'notifications-frame', 'search-frame']);

        if (willOpen) {
            target.classList.remove('hidden');
            target.contentWindow?.postMessage({ type: 'OVERLAY_OPENED' }, '*');
        }
    },

    hideOverlays(ids = []) {
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });
    },

    renderRecents() {
        const view = document.getElementById('recents-view');
        const list = document.getElementById('recents-list');
        if (!view || !list) return;

        const willOpen = view.classList.contains('hidden');
        this.hideOverlays(['control-center-frame', 'notifications-frame', 'search-frame']);

        if (!willOpen) {
            view.classList.add('hidden');
            return;
        }

        view.classList.remove('hidden');
        list.innerHTML = '';

        const history = typeof PerformanceManager !== 'undefined' ? PerformanceManager.tabHistory : [];
        const apps = typeof Manifest !== 'undefined' ? Manifest.getApps() : [];

        if (!history.length) {
            list.innerHTML = '<p style="color:#94a3b8;font-size:12px;">Brak otwartych zakładek w pamięci.</p>';
            return;
        }

        history.slice().reverse().forEach(appId => {
            const app = apps.find(a => a.id === appId) || { id: appId, name: appId, fallback: '📱' };
            const row = document.createElement('div');
            row.className = 'recent-item';

            const openBtn = document.createElement('span');
            openBtn.style.cursor = 'pointer';
            openBtn.textContent = `${app.fallback} ${app.name}`;
            openBtn.onclick = () => {
                view.classList.add('hidden');
                if (typeof Kernel !== 'undefined') Kernel.openApp(app.id);
            };

            const closeBtn = document.createElement('button');
            closeBtn.textContent = '✕';
            closeBtn.style.cssText = 'background:none;border:none;color:#f87171;font-size:15px;cursor:pointer;padding:4px 8px;';
            closeBtn.onclick = () => {
                if (typeof Kernel !== 'undefined') Kernel.killApp(app.id, true);
            };

            row.appendChild(openBtn);
            row.appendChild(closeBtn);
            list.appendChild(row);
        });
    }
};
