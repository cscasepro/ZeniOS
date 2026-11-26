const StorageManager = {
    prefix: 'zenos_v102_',
    memoryCache: new Map(),

    get(key, fallback = null) {
        if (this.memoryCache.has(key)) return this.memoryCache.get(key);
        try {
            const raw = localStorage.getItem(this.prefix + key);
            if (raw === null) return fallback;
            const parsed = JSON.parse(raw);
            this.memoryCache.set(key, parsed);
            return parsed;
        } catch {
            return fallback;
        }
    },

    set(key, value) {
        this.memoryCache.set(key, value);
        try {
            localStorage.setItem(this.prefix + key, JSON.stringify(value));
            return true;
        } catch {
            return false;
        }
    },

    remove(key) {
        this.memoryCache.delete(key);
        try {
            localStorage.removeItem(this.prefix + key);
        } catch {}
    },

    clearCache() {
        this.memoryCache.clear();
    }
};
