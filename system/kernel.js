const Kernel = {
    booted: false,

    async init() {
        if (this.booted) return;
        this.booted = true;

        if (typeof Supervisor !== 'undefined') Supervisor.init();
        if (typeof StorageManager !== 'undefined') StorageManager.init?.();
        if (typeof BatterySaver !== 'undefined') BatterySaver.init();
        if (typeof FocusMode !== 'undefined') FocusMode.init();
        if (typeof IconTheme !== 'undefined') IconTheme.init();
        if (typeof PerformanceManager !== 'undefined') PerformanceManager.init();
        if (typeof Watchdog !== 'undefined') Watchdog.init();

        if (typeof Bootloader !== 'undefined') {
            await Bootloader.start();
        }

        if (typeof Display !== 'undefined') Display.init();
        if (typeof Wallpapers !== 'undefined') Wallpapers.init();
        if (typeof Widgets !== 'undefined') Widgets.init();
        if (typeof Notifications !== 'undefined') Notifications.init();

        this.startClock();
        this.bindMessages();
    },

    openApp(appId) {
        const apps = typeof Manifest !== 'undefined' ? Manifest.getApps() : [];
        const app = apps.find(a => a.id === appId && a.enabled);
        if (!app) return;

        Display.hideOverlays(['recents-view', 'control-center-frame', 'notifications-frame', 'search-frame']);

        const container = document.getElementById('app-container');
        if (!container) return;

        let frame = container.querySelector(`.app-frame[data-app-id="${app.id}"]`);
        if (!frame) {
            frame = document.createElement('iframe');
            frame.className = 'app-frame';
            frame.dataset.appId = app.id;
            frame.src = app.file;
            frame.onerror = () => {
                if (typeof Supervisor !== 'undefined') {
                    Supervisor.log('ERROR', `Nie udało się załadować aplikacji: ${app.file}`);
                }
            };
            container.appendChild(frame);
        }

        if (typeof PerformanceManager !== 'undefined') {
            PerformanceManager.promoteToTop1(app.id);
        } else {
            frame.classList.add('active');
        }
    },

    killApp(appId, refreshRecents = false) {
        const frame = document.querySelector(`.app-frame[data-app-id="${appId}"]`);
        if (frame) {
            frame.contentWindow?.postMessage({ type: 'OS_PRIORITY', level: 'BACKGROUND' }, '*');
            frame.remove();
        }
        if (typeof PerformanceManager !== 'undefined') {
            PerformanceManager.tabHistory = PerformanceManager.tabHistory.filter(id => id !== appId);
            if (PerformanceManager.activeAppId === appId) {
                PerformanceManager.activeAppId = null;
            }
        }
        if (refreshRecents && typeof Display !== 'undefined') {
            Display.renderRecents();
        }
    },

    goHome() {
        if (typeof Display !== 'undefined') Display.showHome();
    },

    showRecents() {
        if (typeof Display !== 'undefined') Display.renderRecents();
    },

    toggleControlCenter() {
        if (typeof Display !== 'undefined') Display.toggleOverlay('control-center-frame');
    },

    toggleNotifications() {
        if (typeof Display !== 'undefined') Display.toggleOverlay('notifications-frame');
    },

    toggleSearch() {
        if (typeof Display !== 'undefined') Display.toggleOverlay('search-frame');
    },

    lockDevice() {
        this.goHome();
        const lock = document.getElementById('lockscreen-frame');
        if (lock) {
            lock.classList.remove('hidden');
            if (typeof Wallpapers !== 'undefined') {
                const cur = Wallpapers.getCurrent();
                Wallpapers.applyLockWallpaper(cur.lock, false);
            }
            if (typeof Notifications !== 'undefined') {
                Notifications.broadcast();
            }
        }
    },

    unlockDevice() {
        const lock = document.getElementById('lockscreen-frame');
        if (lock) lock.classList.add('hidden');
        if (typeof Widgets !== 'undefined') Widgets.syncData();
    },

    startClock() {
        const update = () => {
            const now = new Date();
            const hhmm = now.toTimeString().slice(0, 5);
            const clockEl = document.getElementById('clock');
            if (clockEl) clockEl.textContent = hhmm;

            const lockFrame = document.getElementById('lockscreen-frame');
            lockFrame?.contentWindow?.postMessage({ type: 'OS_CLOCK', time: hhmm }, '*');
        };
        update();
        setInterval(update, 1000);
    },

    bindMessages() {
        window.addEventListener('message', (e) => {
            const data = e.data;
            if (!data || typeof data !== 'object') return;

            if (typeof Supervisor !== 'undefined' && Supervisor.handleMessage(data, e.source)) {
                return;
            }

            switch (data.type) {
                case 'UNLOCK_SCREEN':
                    this.unlockDevice();
                    break;
                case 'OPEN_APP':
                    if (data.appId) this.openApp(data.appId);
                    break;
                case 'GO_HOME':
                    this.goHome();
                    break;
                case 'TOGGLE_FLASHLIGHT': {
                    const ind = document.getElementById('flashlight-indicator');
                    if (ind) ind.style.display = data.state ? 'inline-block' : 'none';
                    const dev = document.getElementById('device-frame');
                    if (dev) {
                        dev.style.boxShadow = data.state
                            ? '0 0 55px 12px rgba(255, 255, 255, 0.55)'
                            : '0 25px 60px rgba(0, 0, 0, 0.85)';
                    }
                    break;
                }
                case 'TOGGLE_BATTERY_SAVER':
                    if (typeof BatterySaver !== 'undefined') {
                        BatterySaver.setEnabled(Boolean(data.state), true);
                    }
                    break;
                case 'TOGGLE_FOCUS_MODE':
                    if (typeof FocusMode !== 'undefined') {
                        FocusMode.setEnabled(Boolean(data.state), true);
                    }
                    break;
                case 'SET_ICON_STYLE':
                    if (typeof IconTheme !== 'undefined' && data.style) {
                        IconTheme.setStyle(data.style, true);
                    }
                    break;
                case 'SET_WALLPAPER':
                    if (typeof Wallpapers !== 'undefined') {
                        Wallpapers.setWallpaper(data.target || 'home', data.value, true);
                    }
                    break;
                case 'UPDATE_WIDGETS_CONFIG':
                    if (typeof Widgets !== 'undefined') {
                        Widgets.applyConfig(data.config || {}, true);
                    }
                    break;
                case 'PUSH_NOTIFICATION':
                    if (typeof Notifications !== 'undefined') {
                        Notifications.push(data.title, data.body, data.appId || 'app');
                    }
                    break;
                case 'SEARCH_QUERY':
                    if (typeof Search !== 'undefined' && e.source) {
                        e.source.postMessage({ type: 'SEARCH_RESULTS', items: Search.query(data.query || '') }, '*');
                    }
                    break;
                case 'REFRESH_DESKTOP':
                    if (typeof Display !== 'undefined') Display.renderDesktop();
                    if (typeof Widgets !== 'undefined') Widgets.syncData();
                    break;
            }
        });
    }
};

window.addEventListener('DOMContentLoaded', () => Kernel.init());
