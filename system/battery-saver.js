const BatterySaver = {
    enabled: false,
    listeners: new Set(),

    init() {
        this.enabled = Boolean(StorageManager.get('battery_saver', false));
        this.applyState(this.enabled, false);
    },

    isEnabled() {
        return this.enabled;
    },

    setEnabled(val, persist = true) {
        this.enabled = Boolean(val);
        if (persist) StorageManager.set('battery_saver', this.enabled);
        this.applyState(this.enabled, true);
    },

    toggle() {
        this.setEnabled(!this.enabled, true);
        return this.enabled;
    },

    applyState(active, notify) {
        document.body.classList.toggle('battery-saver-mode', active);
        const badge = document.getElementById('battery-badge');
        if (badge) badge.style.display = active ? 'inline-block' : 'none';

        if (active && typeof PerformanceManager !== 'undefined') {
            PerformanceManager.throttleBackground(true);
        } else if (!active && typeof PerformanceManager !== 'undefined') {
            PerformanceManager.throttleBackground(false);
        }

        if (notify) {
            this.listeners.forEach(fn => fn(active));
            window.postMessage({ type: 'BATTERY_SAVER_CHANGED', enabled: active }, '*');
        }
    },

    onChange(fn) {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }
};
