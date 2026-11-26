const PerformanceManager = {
    DEFAULT_MAX_TABS: 4,
    activeAppId: null,
    tabHistory: [], // Najstarsze zakładki na początku

    init() {
        this.applyPolicy();
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.suspendAllBackground();
            } else if (this.activeAppId) {
                this.promoteToTop1(this.activeAppId);
            }
        });
    },

    getTabLimit() {
        if (typeof BatterySaver !== 'undefined' && BatterySaver.enabled) {
            return BatterySaver.getMaxTabs();
        }
        const custom = typeof StorageManager !== 'undefined' ? StorageManager.get('zenios_max_tabs') : null;
        return typeof custom === 'number' && custom >= 1 ? custom : this.DEFAULT_MAX_TABS;
    },

    applyPolicy() {
        const limit = this.getTabLimit();
        while (this.tabHistory.length > limit) {
            const oldestId = this.tabHistory.shift();
            if (oldestId !== this.activeAppId && typeof Kernel !== 'undefined') {
                Kernel.killApp(oldestId, false);
            }
        }
        const badge = document.getElementById('perf-badge');
        if (badge && !(typeof Bootloader !== 'undefined' && Bootloader.isSafeMode)) {
            badge.textContent = `⚡ TOP-1 (max ${limit})`;
        }
    },

    promoteToTop1(appId) {
        this.activeAppId = appId;
        this.tabHistory = this.tabHistory.filter(id => id !== appId);
        this.tabHistory.push(appId);

        this.applyPolicy();

        document.querySelectorAll('.app-frame').forEach(frame => {
            const id = frame.dataset.appId;
            const isTop = id === appId;
            frame.classList.toggle('active', isTop);
            frame.style.visibility = isTop ? 'visible' : 'hidden';

            frame.contentWindow?.postMessage({
                type: 'OS_PRIORITY',
                level: isTop ? 'TOP_1' : 'BACKGROUND',
                batterySaver: typeof BatterySaver !== 'undefined' ? BatterySaver.enabled : false
            }, '*');
        });
    },

    suspendAllBackground() {
        this.activeAppId = null;
        document.querySelectorAll('.app-frame').forEach(frame => {
            frame.classList.remove('active');
            frame.style.visibility = 'hidden';
            frame.contentWindow?.postMessage({
                type: 'OS_PRIORITY',
                level: 'BACKGROUND',
                batterySaver: typeof BatterySaver !== 'undefined' ? BatterySaver.enabled : false
            }, '*');
        });
    },

    purgeBackground() {
        const keepActive = this.activeAppId;
        const toKill = this.tabHistory.filter(id => id !== keepActive);
        toKill.forEach(id => {
            if (typeof Kernel !== 'undefined') Kernel.killApp(id, false);
        });
        this.tabHistory = keepActive ? [keepActive] : [];
        if (!keepActive && typeof Kernel !== 'undefined') {
            Kernel.goHome();
        }
    }
};
