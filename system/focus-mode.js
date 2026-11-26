const FocusMode = {
    enabled: false,
    listeners: new Set(),

    init() {
        this.enabled = Boolean(StorageManager.get('focus_mode', false));
        this.applyState(this.enabled, false);
    },

    isEnabled() {
        return this.enabled;
    },

    setEnabled(val, persist = true) {
        this.enabled = Boolean(val);
        if (persist) StorageManager.set('focus_mode', this.enabled);
        this.applyState(this.enabled, true);
    },

    toggle() {
        this.setEnabled(!this.enabled, true);
        return this.enabled;
    },

    applyState(active, notify) {
        const badge = document.getElementById('focus-badge');
        if (badge) badge.style.display = active ? 'inline-block' : 'none';
        if (notify) {
            this.listeners.forEach(fn => fn(active));
            window.postMessage({ type: 'FOCUS_MODE_CHANGED', enabled: active }, '*');
        }
    },

    onChange(fn) {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }
};
