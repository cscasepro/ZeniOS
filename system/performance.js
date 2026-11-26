const PerformanceManager = {
    activeAppId: null,
    runningApps: new Map(),
    backgroundThrottled: false,
    maxBackgroundApps: 4,

    init() {
        this.updateBadge();
    },

    registerApp(appId, iframeEl, meta = {}) {
        if (!this.runningApps.has(appId) && this.runningApps.size >= this.maxBackgroundApps) {
            const oldestKey = this.runningApps.keys().next().value;
            if (oldestKey && oldestKey !== appId && oldestKey !== this.activeAppId) {
                this.closeApp(oldestKey);
            }
        }
        this.runningApps.set(appId, {
            id: appId,
            iframe: iframeEl,
            meta,
            lastActive: Date.now(),
            state: 'active'
        });
        this.setForegroundApp(appId);
    },

    setForegroundApp(appId) {
        this.activeAppId = appId;
        this.runningApps.forEach((entry, id) => {
            const isFg = id === appId;
            entry.state = isFg ? 'active' : 'background';
            if (isFg) entry.lastActive = Date.now();
            if (entry.iframe) {
                entry.iframe.classList.toggle('active', isFg);
                entry.iframe.style.display = isFg ? 'block' : 'none';
                try {
                    entry.iframe.contentWindow?.postMessage({
                        type: 'LIFECYCLE_STATE',
                        state: isFg ? 'FOREGROUND' : (this.backgroundThrottled ? 'PAUSED' : 'BACKGROUND')
                    }, '*');
                } catch {}
            }
        });
        this.updateBadge();
    },

    closeApp(appId) {
        const entry = this.runningApps.get(appId);
        if (!entry) return;
        if (entry.iframe && entry.iframe.parentNode) {
            entry.iframe.src = 'about:blank';
            entry.iframe.parentNode.removeChild(entry.iframe);
        }
        this.runningApps.delete(appId);
        if (this.activeAppId === appId) this.activeAppId = null;
        this.updateBadge();
    },

    throttleBackground(throttle) {
        this.backgroundThrottled = Boolean(throttle);
        this.runningApps.forEach((entry, id) => {
            if (id !== this.activeAppId && entry.iframe) {
                try {
                    entry.iframe.contentWindow?.postMessage({
                        type: 'LIFECYCLE_STATE',
                        state: this.backgroundThrottled ? 'PAUSED' : 'BACKGROUND'
                    }, '*');
                } catch {}
            }
        });
        this.updateBadge();
    },

    purgeBackground() {
        const toClose = [];
        this.runningApps.forEach((_, id) => {
            if (id !== this.activeAppId) toClose.push(id);
        });
        toClose.forEach(id => this.closeApp(id));
        if (typeof Kernel !== 'undefined') Kernel.renderRecents();
        this.updateBadge();
    },

    getRunningList() {
        return Array.from(this.runningApps.values()).map(e => ({
            id: e.id,
            name: e.meta?.name || e.id,
            state: e.state,
            lastActive: e.lastActive
        }));
    },

    updateBadge() {
        const badge = document.getElementById('perf-badge');
        if (!badge) return;
        if (typeof Bootloader !== 'undefined' && Bootloader.isSafeMode) {
            badge.textContent = '🛡️ SAFE MODE';
            return;
        }
        badge.textContent = this.backgroundThrottled ? '⚡ TOP-1 • ECO' : '⚡ TOP-1';
    }
};
