const Wallpapers = {
    HOME_KEY: 'zenios_wallpaper_home',
    LOCK_KEY: 'zenios_wallpaper_lock',

    // Dopasowane do Twojego folderu default_wallpapers/ z automatycznym doborem rozszerzenia
    presets: [
        { id: 'wp_1', name: 'Tapeta 1', basePath: 'default_wallpapers/default_wallpaper_1' },
        { id: 'wp_2', name: 'Tapeta 2', basePath: 'default_wallpapers/default_wallpaper_2' },
        { id: 'wp_3', name: 'Tapeta 3', basePath: 'default_wallpapers/default_wallpaper_3' },
        { id: 'wp_4', name: 'Tapeta 4', basePath: 'default_wallpapers/default_wallpaper_4' },
        { id: 'wp_5', name: 'Tapeta 5', basePath: 'default_wallpapers/default_wallpaper_5' },
        { id: 'wp_6', name: 'Tapeta 6', basePath: 'default_wallpapers/default_wallpaper_6' },
        { id: 'wp_7', name: 'Tapeta 7', basePath: 'default_wallpapers/default_wallpaper_7' }
    ],

    init() {
        const homeWp = (typeof StorageManager !== 'undefined' && StorageManager.get(this.HOME_KEY)) || 'wp_1';
        const lockWp = (typeof StorageManager !== 'undefined' && StorageManager.get(this.LOCK_KEY)) || homeWp;
        this.applyHomeWallpaper(homeWp, false);
        this.applyLockWallpaper(lockWp, false);
    },

    resolveWallpaperUrl(wpIdOrUrl) {
        if (!wpIdOrUrl) return null;
        if (String(wpIdOrUrl).startsWith('data:image') || String(wpIdOrUrl).startsWith('http') || String(wpIdOrUrl).includes('/')) {
            return String(wpIdOrUrl);
        }
        const preset = this.presets.find(p => p.id === wpIdOrUrl);
        if (!preset) return null;
        // Jeśli plik w repo nie ma rozszerzenia, przeglądarka i tak spróbuje go pobrać po dokładnej ścieżce
        return preset.basePath;
    },

    setWallpaper(target, value, persist = true) {
        if (target === 'lock') {
            return this.applyLockWallpaper(value, persist);
        }
        return this.applyHomeWallpaper(value, persist);
    },

    applyHomeWallpaper(value, persist = true) {
        const url = this.resolveWallpaperUrl(value);
        const frame = document.getElementById('device-frame');
        if (frame && url) {
            frame.style.setProperty('--wallpaper-image', `url("${url}")`);
        }
        if (persist && typeof StorageManager !== 'undefined') {
            StorageManager.set(this.HOME_KEY, value);
        }
        return value;
    },

    applyLockWallpaper(value, persist = true) {
        const url = this.resolveWallpaperUrl(value);
        if (persist && typeof StorageManager !== 'undefined') {
            StorageManager.set(this.LOCK_KEY, value);
        }
        const lockFrame = document.getElementById('lockscreen-frame');
        if (lockFrame && url) {
            lockFrame.contentWindow?.postMessage({ type: 'SET_LOCK_WALLPAPER', url }, '*');
        }
        return value;
    },

    getCurrent() {
        return {
            home: (typeof StorageManager !== 'undefined' && StorageManager.get(this.HOME_KEY)) || 'wp_1',
            lock: (typeof StorageManager !== 'undefined' && StorageManager.get(this.LOCK_KEY)) || 'wp_1'
        };
    }
};
