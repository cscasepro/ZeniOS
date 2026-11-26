const StorageManager = {
    PREFIX: 'zenios_v102_',
    MAX_APPROX_BYTES: 4.5 * 1024 * 1024, // Bezpieczny próg dla localStorage (~4.5 MB)

    get(key, fallback = null) {
        try {
            const raw = localStorage.getItem(this.PREFIX + key);
            if (raw === null) return fallback;
            return JSON.parse(raw);
        } catch (err) {
            if (typeof Supervisor !== 'undefined') {
                Supervisor.log('WARN', `StorageManager.get błąd dla klucza "${key}": ${err.message}`);
            }
            return fallback;
        }
    },

    set(key, value) {
        try {
            const serialized = JSON.stringify(value);
            if (this.getUsedBytes() + serialized.length * 2 > this.MAX_APPROX_BYTES) {
                throw new Error('Zbliżono się do limitu pamięci przeglądarki.');
            }
            localStorage.setItem(this.PREFIX + key, serialized);
            return true;
        } catch (err) {
            if (typeof Supervisor !== 'undefined') {
                Supervisor.log('ERROR', `StorageManager.set błąd dla klucza "${key}": ${err.message}`);
            }
            if (typeof Notifications !== 'undefined') {
                Notifications.push('Pamięć pełna', 'Nie udało się zapisać danych. Uruchom Sprzątacz.');
            }
            return false;
        }
    },

    remove(key) {
        try {
            localStorage.removeItem(this.PREFIX + key);
            return true;
        } catch (_) {
            return false;
        }
    },

    getUsedBytes() {
        let total = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith(this.PREFIX)) {
                const v = localStorage.getItem(k) || '';
                total += (k.length + v.length) * 2;
            }
        }
        return total;
    },

    listKeys() {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith(this.PREFIX)) {
                keys.push(k.slice(this.PREFIX.length));
            }
        }
        return keys;
    },

    exportAll() {
        const dump = {};
        this.listKeys().forEach(k => {
            dump[k] = this.get(k);
        });
        return JSON.stringify({ version: 'v1.0.2', exportedAt: Date.now(), data: dump }, null, 2);
    },

    importAll(jsonText) {
        const parsed = JSON.parse(jsonText);
        if (!parsed || typeof parsed.data !== 'object') {
            throw new Error('Nieprawidłowy format kopii zapasowej.');
        }
        Object.entries(parsed.data).forEach(([k, v]) => this.set(k, v));
        return true;
    },

    clearSystemData(keepSettings = true) {
        const preserved = {};
        const keepKeys = keepSettings
            ? ['zenios_icon_style', 'zenios_wallpaper_home', 'zenios_wallpaper_lock', 'zenios_battery_saver', 'zenios_focus_mode']
            : [];
        keepKeys.forEach(k => {
            const val = this.get(k);
            if (val !== null) preserved[k] = val;
        });

        this.listKeys().forEach(k => this.remove(k));
        Object.entries(preserved).forEach(([k, v]) => this.set(k, v));
    }
};
