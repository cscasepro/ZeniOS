const Notifications = {
    STORAGE_KEY: 'zenios_notifications',
    items: [],
    MAX_ITEMS: 30,

    init() {
        const saved = typeof StorageManager !== 'undefined' ? StorageManager.get(this.STORAGE_KEY, []) : [];
        this.items = Array.isArray(saved) ? saved : [];
        this.broadcast();
    },

    push(title, body = '', appId = 'system') {
        const muted = typeof FocusMode !== 'undefined' && FocusMode.enabled;
        const notif = {
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            title: String(title || 'Powiadomienie'),
            body: String(body || ''),
            appId,
            time: new Date().toTimeString().slice(0, 5),
            silent: muted
        };

        this.items.unshift(notif);
        if (this.items.length > this.MAX_ITEMS) {
            this.items.pop();
        }

        if (typeof StorageManager !== 'undefined') {
            StorageManager.set(this.STORAGE_KEY, this.items);
        }

        this.broadcast();
        return notif;
    },

    remove(id) {
        this.items = this.items.filter(item => item.id !== id);
        if (typeof StorageManager !== 'undefined') {
            StorageManager.set(this.STORAGE_KEY, this.items);
        }
        this.broadcast();
    },

    clearAll() {
        this.items = [];
        if (typeof StorageManager !== 'undefined') {
            StorageManager.set(this.STORAGE_KEY, []);
        }
        this.broadcast();
    },

    getAll() {
        return [...this.items];
    },

    broadcast() {
        const payload = {
            type: 'NOTIFICATIONS_UPDATED',
            items: this.getAll(),
            focusMode: typeof FocusMode !== 'undefined' ? FocusMode.enabled : false
        };

        const panel = document.getElementById('notifications-frame');
        panel?.contentWindow?.postMessage(payload, '*');

        const lock = document.getElementById('lockscreen-frame');
        lock?.contentWindow?.postMessage(payload, '*');
    }
};
