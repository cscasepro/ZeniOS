const Display = {
    dockAppIds: ['telefon', 'wiadomosci', 'aparat', 'ustawienia'],

    init() {
        this.renderDesktop();
    },

    createAppIconElement(app) {
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
        return iconEl;
    },

    renderDesktop() {
        const grid = document.getElementById('app-grid');
        const dock = document.getElementById('iphone-dock');
        if (!grid) return;

        const isSafeMode = typeof Bootloader !== 'undefined' && Bootloader.isSafeMode;
        const apps = typeof Manifest !== 'undefined' ? Manifest.getApps().filter(a => a.enabled) : [];

        grid.innerHTML = '';
        if (dock) dock.innerHTML = '';

        const dockApps = this.dockAppIds
            .map(id => apps.find(a => a.id === id))
            .filter(Boolean);

        const dockSet = new Set(dockApps.map(a => a.id));

        apps.forEach(app => {
            if (isSafeMode && app.id !== 'ustawienia' && app.id !== 'aktualizacje') return;
            if (dock && dockSet.has(app.id)) return;
            grid.appendChild(this.createAppIconElement(app));
        });

        if (dock && !isSafeMode) {
            dockApps.forEach(app => {
                dock.appendChild(this.createAppIconElement(app));
            });
        }
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
            list.innerHTML = '<p style="color:#98989f;font-size:12px;">Brak otwartych zakładek w pamięci.</p>';
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
            closeBtn.style.cssText = 'background:none;border:none;color:#ff453a;font-size:15px;cursor:pointer;padding:4px 8px;';
            closeBtn.onclick = () => {
                if (typeof Kernel !== 'undefined') Kernel.killApp(app.id, true);
            };

            row.appendChild(openBtn);
            row.appendChild(closeBtn);
            list.appendChild(row);
        });
    }
};
