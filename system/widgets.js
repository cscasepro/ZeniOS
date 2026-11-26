const Widgets = {
    STORAGE_KEY: 'zenios_widgets_config',
    config: {
        enabled: true,
        showNote: true,
        showPhoto: true
    },

    init() {
        const saved = typeof StorageManager !== 'undefined' ? StorageManager.get(this.STORAGE_KEY) : null;
        if (saved && typeof saved === 'object') {
            this.config = { ...this.config, ...saved };
        }
        this.applyConfig(this.config, false);
        this.syncData();
    },

    applyConfig(nextConfig, persist = true) {
        this.config = { ...this.config, ...nextConfig };
        const frame = document.getElementById('widgets-frame');
        if (frame) {
            frame.classList.toggle('hidden', !this.config.enabled);
        }
        if (persist && typeof StorageManager !== 'undefined') {
            StorageManager.set(this.STORAGE_KEY, this.config);
        }
        this.syncData();
    },

    syncData() {
        const frame = document.getElementById('widgets-frame');
        if (!frame || this.config.enabled === false) return;

        const notes = (typeof StorageManager !== 'undefined' && StorageManager.get('notes', [])) || [];
        const photos = (typeof StorageManager !== 'undefined' && StorageManager.get('gallery_photos', [])) || [];
        const latestNote = notes[0] ? notes[0].title || notes[0].text || 'Notatka' : 'Brak notatek';
        const latestPhoto = photos[0] ? photos[0].dataUrl || photos[0].src || null : null;

        frame.contentWindow?.postMessage({
            type: 'WIDGETS_DATA',
            config: this.config,
            latestNote,
            latestPhoto,
            batterySaver: typeof BatterySaver !== 'undefined' ? BatterySaver.enabled : false
        }, '*');
    }
};
