const BatterySaver = {
    STORAGE_KEY: 'zenios_battery_saver',
    enabled: false,

    init() {
        const saved = typeof StorageManager !== 'undefined'
            ? StorageManager.get(this.STORAGE_KEY, false)
            : false;
        this.setEnabled(Boolean(saved), false);
    },

    setEnabled(state, persist = true) {
        this.enabled = Boolean(state);
        document.body.classList.toggle('battery-saver-mode', this.enabled);

        const badge = document.getElementById('battery-badge');
        if (badge) {
            badge.style.display = this.enabled ? 'inline-block' : 'none';
        }

        if (persist && typeof StorageManager !== 'undefined') {
            StorageManager.set(this.STORAGE_KEY, this.enabled);
        }

        if (typeof PerformanceManager !== 'undefined') {
            PerformanceManager.applyPolicy();
        }

        // Powiadom aplikacje o zmianie trybu zasilania
        document.querySelectorAll('.app-frame').forEach(frame => {
            frame.contentWindow?.postMessage({ type: 'OS_BATTERY_SAVER', enabled: this.enabled }, '*');
        });

        return this.enabled;
    },

    toggle() {
        return this.setEnabled(!this.enabled, true);
    },

    getMaxTabs() {
        return this.enabled ? 2 : 4;
    }
};
