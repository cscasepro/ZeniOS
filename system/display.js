const Display = {
    currentPage: 0,
    brightness: 85,

    init() {
        this.brightness = Number(StorageManager.get('brightness', 85)) || 85;
        this.setBrightness(this.brightness, false);
        this.renderGrid();
        this.setupSwipe();
        this.startClock();
    },

    renderGrid() {
        const g1 = document.getElementById('app-grid-1');
        const g2 = document.getElementById('app-grid-2');
        const dock = document.getElementById('iphone-dock');
        if (!g1 || !g2 || !dock) return;

        g1.innerHTML = '';
        g2.innerHTML = '';
        dock.innerHTML = '';

        const allApps = (typeof ZenManifest !== 'undefined' && ZenManifest.apps) || [];
        const dockApps = allApps.filter(a => a.dock).slice(0, 4);
        const gridApps = allApps.filter(a => !a.dock);

        dockApps.forEach(app => dock.appendChild(this.createIconEl(app)));
        gridApps.forEach(app => {
            if (app.page === 1) g2.appendChild(this.createIconEl(app));
            else g1.appendChild(this.createIconEl(app));
        });
    },

    createIconEl(app) {
        const wrap = document.createElement('div');
        wrap.className = 'app-icon';
        wrap.onclick = () => Kernel.openApp(app.id);

        const box = document.createElement('div');
        box.className = 'app-icon-box';

        const fallback = document.createElement('span');
        fallback.className = 'app-icon-fallback';
        fallback.textContent = app.glyph || '✦';

        if (app.icon) {
            const img = document.createElement('img');
            img.src = app.icon;
            img.alt = app.name;
            img.onerror = () => {
                img.remove();
                box.appendChild(fallback);
            };
            box.appendChild(img);
        } else {
            box.appendChild(fallback);
        }

        const label = document.createElement('div');
        label.className = 'app-label';
        label.textContent = app.name;

        wrap.appendChild(box);
        wrap.appendChild(label);
        return wrap;
    },

    goPage(pageIndex) {
        this.currentPage = pageIndex === 1 ? 1 : 0;
        const track = document.getElementById('pages-track');
        if (track) track.classList.toggle('page-2', this.currentPage === 1);
        document.getElementById('dot-1')?.classList.toggle('active', this.currentPage === 0);
        document.getElementById('dot-2')?.classList.toggle('active', this.currentPage === 1);
    },

    setupSwipe() {
        const vp = document.getElementById('pages-viewport');
        if (!vp) return;
        let startX = 0;
        vp.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
        }, { passive: true });
        vp.addEventListener('touchend', (e) => {
            const diff = e.changedTouches[0].clientX - startX;
            if (diff < -50 && this.currentPage === 0) this.goPage(1);
            if (diff > 50 && this.currentPage === 1) this.goPage(0);
        }, { passive: true });
    },

    setBrightness(pct, persist = true) {
        const clamped = Math.max(10, Math.min(100, Number(pct) || 85));
        this.brightness = clamped;
        const veil = document.getElementById('brightness-veil');
        if (veil) veil.style.opacity = String(((100 - clamped) / 100) * 0.65);
        if (persist) StorageManager.set('brightness', clamped);
    },

    startClock() {
        const update = () => {
            const now = new Date();
            const hhmm = now.toTimeString().slice(0, 5);
            const clockEl = document.getElementById('clock');
            if (clockEl) clockEl.textContent = hhmm;
            window.postMessage({ type: 'SYSTEM_CLOCK_TICK', time: hhmm, ts: now.toISOString() }, '*');
        };
        update();
        setInterval(update, 1000);
    }
};
