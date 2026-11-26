const Kernel = {
    locked: true,
    torchActive: false,
    viewport360: false,

    async boot() {
        StorageManager.get('init_check', true);

        const bootInfo = await Bootloader.start();

        await DeviceTelemetry.init();
        BatterySaver.init();
        FocusMode.init();
        IconTheme.init();
        if (typeof WallpaperManager !== 'undefined' && typeof WallpaperManager.init === 'function') {
            WallpaperManager.init();
        }
        Notifications.init();
        PerformanceManager.init();
        Display.init();
        WidgetsBridge.init();

        this.viewport360 = Boolean(StorageManager.get('viewport_360', false));
        this.setViewport360(this.viewport360, false);

        if (!bootInfo.safeMode && typeof Watchdog !== 'undefined' && typeof Watchdog.start === 'function') {
            Watchdog.start();
        }

        this.bindEvents();
        this.syncAllFrames();
        this.showLockScreen(true);
    },

    setViewport360(enabled, persist = true) {
        this.viewport360 = Boolean(enabled);
        document.body.classList.toggle('viewport-360x720', this.viewport360);
        if (persist) StorageManager.set('viewport_360', this.viewport360);
        window.postMessage({ type: 'VIEWPORT_360_CHANGED', enabled: this.viewport360 }, '*');
    },

    syncAllFrames() {
        const snap = DeviceTelemetry.getSnapshot();
        const frames = [
            document.getElementById('lockscreen-frame'),
            document.getElementById('control-center-frame'),
            document.getElementById('notifications-frame')
        ];
        frames.forEach(f => {
            f?.contentWindow?.postMessage({ type: 'TELEMETRY_UPDATED', telemetry: snap }, '*');
        });
        document.getElementById('lockscreen-frame')?.contentWindow?.postMessage({
            type: 'NOTIFICATIONS_UPDATED',
            items: Notifications.getAll()
        }, '*');
    },

    bindEvents() {
        DeviceTelemetry.onChange((snap) => {
            ['lockscreen-frame', 'control-center-frame'].forEach(id => {
                document.getElementById(id)?.contentWindow?.postMessage({
                    type: 'TELEMETRY_UPDATED',
                    telemetry: snap
                }, '*');
            });
        });

        window.addEventListener('message', (e) => {
            const data = e.data;
            if (!data || !data.type) return;

            if (data.type === 'UNLOCK_DEVICE') {
                this.unlockDevice();
            } else if (data.type === 'OPEN_APP' && data.appId) {
                this.unlockDevice();
                setTimeout(() => this.openApp(data.appId), 140);
            } else if (data.type === 'TORCH_STATE') {
                this.setTorch(Boolean(data.active), data.intensity);
            } else if (data.type === 'TOGGLE_BATTERY_SAVER') {
                BatterySaver.toggle();
            } else if (data.type === 'TOGGLE_FOCUS_MODE') {
                FocusMode.toggle();
            } else if (data.type === 'SET_BRIGHTNESS' && typeof data.value === 'number') {
                Display.setBrightness(data.value);
            } else if (data.type === 'SET_VIEWPORT_360') {
                this.setViewport360(Boolean(data.enabled), true);
            } else if (data.type === 'CLOSE_CONTROL_CENTER') {
                this.toggleControlCenter(false);
            } else if (data.type === 'CLOSE_SEARCH') {
                this.toggleSearch(false);
            } else if (data.type === 'CLOSE_NOTIFICATIONS') {
                this.toggleNotifications(false);
            } else if (data.type === 'STORAGE_CLEANED') {
                Notifications.push('Pamięć ZenOS', `Zwolniono ${data.freedMb || 145.2} MB pamięci tymczasowej.`);
            }
        });
    },

    showLockScreen(show) {
        this.locked = Boolean(show);
        const ls = document.getElementById('lockscreen-frame');
        if (ls) ls.classList.toggle('hidden', !this.locked);
        if (typeof WallpaperManager !== 'undefined' && typeof WallpaperManager.setBlur === 'function') {
            WallpaperManager.setBlur(this.locked);
        }
        if (this.locked) this.syncAllFrames();
    },

    unlockDevice() {
        this.showLockScreen(false);
    },

    lockDevice() {
        this.goHome();
        this.toggleControlCenter(false);
        this.toggleSearch(false);
        this.toggleNotifications(false);
        this.showLockScreen(true);
    },

    openApp(appId) {
        const allApps = (typeof ZenManifest !== 'undefined' && ZenManifest.apps) || [];
        const app = allApps.find(a => a.id === appId);
        if (!app) return;

        this.hideRecents();
        document.getElementById('desktop')?.classList.add('scaled-back');

        const container = document.getElementById('app-container');
        if (!container) return;

        let entry = PerformanceManager.runningApps.get(appId);
        if (!entry) {
            const iframe = document.createElement('iframe');
            iframe.className = 'app-frame';
            iframe.src = app.url;
            iframe.dataset.appId = appId;
            container.appendChild(iframe);
            PerformanceManager.registerApp(appId, iframe, { name: app.name });
        } else {
            PerformanceManager.setForegroundApp(appId);
        }

        Watchdog.ping?.(appId);
    },

    goHome() {
        this.hideRecents();
        PerformanceManager.setForegroundApp(null);
        document.querySelectorAll('.app-frame').forEach(f => {
            f.classList.remove('active');
            f.style.display = 'none';
        });
        document.getElementById('desktop')?.classList.remove('scaled-back');
    },

    toggleControlCenter(forceState) {
        const frame = document.getElementById('control-center-frame');
        if (!frame) return;
        const nextOpen = typeof forceState === 'boolean' ? forceState : frame.classList.contains('hidden');
        frame.classList.toggle('hidden', !nextOpen);
        if (nextOpen) {
            frame.contentWindow?.postMessage({
                type: 'CC_SYNC',
                batterySaver: BatterySaver.isEnabled(),
                focusMode: FocusMode.isEnabled(),
                brightness: Display.brightness,
                torchActive: this.torchActive,
                telemetry: DeviceTelemetry.getSnapshot()
            }, '*');
        }
    },

    toggleSearch(forceState) {
        const frame = document.getElementById('search-frame');
        if (!frame) return;
        const nextOpen = typeof forceState === 'boolean' ? forceState : frame.classList.contains('hidden');
        frame.classList.toggle('hidden', !nextOpen);
        if (nextOpen) {
            frame.contentWindow?.postMessage({ type: 'SEARCH_FOCUS' }, '*');
        }
    },

    toggleNotifications(forceState) {
        const frame = document.getElementById('notifications-frame');
        if (!frame) return;
        const nextOpen = typeof forceState === 'boolean' ? forceState : frame.classList.contains('hidden');
        frame.classList.toggle('hidden', !nextOpen);
        if (nextOpen) {
            frame.contentWindow?.postMessage({ type: 'NOTIFICATIONS_UPDATED', items: Notifications.getAll() }, '*');
        }
    },

    setTorch(active, intensity = 80) {
        this.torchActive = Boolean(active);
        const veil = document.getElementById('torch-veil');
        const ind = document.getElementById('flashlight-indicator');
        if (veil) {
            veil.classList.toggle('active', this.torchActive);
            veil.style.opacity = this.torchActive ? String(Math.max(0.15, (intensity / 100) * 0.94)) : '0';
        }
        if (ind) ind.style.display = this.torchActive ? 'inline-block' : 'none';
    },

    showRecents() {
        const view = document.getElementById('recents-view');
        if (!view) return;
        this.renderRecents();
        view.classList.remove('hidden');
    },

    hideRecents() {
        document.getElementById('recents-view')?.classList.add('hidden');
    },

    renderRecents() {
        const list = document.getElementById('recents-list');
        if (!list) return;
        const items = PerformanceManager.getRunningList();
        if (!items.length) {
            list.innerHTML = '<div style="font-size:13px;opacity:0.75;">Brak otwartych aplikacji w pamięci.</div>';
            return;
        }
        list.innerHTML = items.map(item => `
            <div class="recent-item">
                <div><strong>${item.name}</strong><div style="font-size:11px;opacity:0.7;">${item.state}</div></div>
                <div style="display:flex;gap:6px;">
                    <button class="glass-btn" onclick="Kernel.openApp('${item.id}')">Otwórz</button>
                    <button class="glass-btn" onclick="PerformanceManager.closeApp('${item.id}'); Kernel.renderRecents();">Zamknij</button>
                </div>
            </div>
        `).join('');
    }
};

window.addEventListener('DOMContentLoaded', () => {
    Kernel.boot();
});
