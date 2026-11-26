const WallpaperManager = {
    currentId: 'wp-1',

    init() {
        const savedId = StorageManager.get('wallpaper_id', 'wp-1');
        this.applyWallpaper(savedId, false);
    },

    applyWallpaper(id, persist = true) {
        const list = (typeof ZenManifest !== 'undefined' && ZenManifest.wallpapers) || [];
        const wp = list.find(w => w.id === id) || list[0];
        if (!wp) return;

        this.currentId = wp.id;
        document.documentElement.style.setProperty('--bg-wallpaper', wp.css);

        const layer = document.getElementById('wallpaper-layer');
        if (wp.file) {
            const probe = new Image();
            probe.onload = () => {
                document.documentElement.style.setProperty('--wallpaper-image', `url("${wp.file}")`);
                if (layer) layer.style.backgroundImage = `url("${wp.file}"), ${wp.css}`;
            };
            probe.onerror = () => {
                document.documentElement.style.setProperty('--wallpaper-image', 'none');
                if (layer) layer.style.backgroundImage = wp.css;
            };
            probe.src = wp.file;
        } else if (layer) {
            layer.style.backgroundImage = wp.css;
        }

        if (persist) StorageManager.set('wallpaper_id', wp.id);
        window.postMessage({ type: 'WALLPAPER_CHANGED', id: wp.id }, '*');
    },

    setBlur(blurred) {
        const layer = document.getElementById('wallpaper-layer');
        if (layer) layer.classList.toggle('blurred', Boolean(blurred));
    }
};
