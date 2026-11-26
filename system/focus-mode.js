const FocusMode = {
    STORAGE_KEY: 'zenios_focus_mode',
    enabled: false,

    init() {
        const saved = typeof StorageManager !== 'undefined' ? StorageManager.get(this.STORAGE_KEY, false) : false;
        this.setEnabled(Boolean(saved), false);
    },

    setEnabled(state, persist = true) {
        this.enabled = Boolean(state);
        document.body.classList.toggle('focus-mode-active', this.enabled);

        const badge = document.getElementById('focus-badge');
        if (badge) {
            badge.style.display = this.enabled ? 'inline-block' : 'none';
        }

        if (persist && typeof StorageManager !== 'undefined') {
            StorageManager.set(this.STORAGE_KEY, this.enabled);
        }

        if (typeof Notifications !== 'undefined') {
            Notifications.broadcast();
        }

        document.querySelectorAll('.app-frame').forEach(frame => {
            frame.contentWindow?.postMessage({ type: 'OS_FOCUS_MODE', enabled: this.enabled }, '*');
        });

        return this.enabled;
    },

    toggle() {
        return this.setEnabled(!this.enabled, true);
    }
};
