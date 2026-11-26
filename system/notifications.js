const Notifications = {
    items: [],
    listeners: new Set(),

    init() {
        const saved = StorageManager.get('notifications', null);
        if (Array.isArray(saved) && saved.length) {
            this.items = saved;
        } else {
            this.items = [
                { id: 1, title: 'ZenOS Liquid Glass', body: 'Interfejs systemowy gotowy do pracy.', time: 'teraz' },
                { id: 2, title: 'Ustawienia', body: 'Możesz zmienić styl ikon, tapetę oraz tryb skupienia.', time: '5m' }
            ];
        }
        this.emit();
    },

    push(title, body) {
        const entry = {
            id: Date.now() + Math.random(),
            title: String(title || 'ZenOS'),
            body: String(body || ''),
            time: 'teraz'
        };
        this.items.unshift(entry);
        if (this.items.length > 40) this.items.length = 40;
        StorageManager.set('notifications', this.items);
        this.emit();
        return entry;
    },

    clearAll() {
        this.items = [];
        StorageManager.set('notifications', this.items);
        this.emit();
    },

    getAll() {
        return this.items.slice();
    },

    onChange(fn) {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    },

    emit() {
        this.listeners.forEach(fn => fn(this.items.slice()));
        window.postMessage({ type: 'NOTIFICATIONS_UPDATED', items: this.items.slice() }, '*');
    }
};
