const Manifest = {
    osName: 'ZeniOS',
    osVersion: 'v1.0.2',
    apps: [
        { id: 'aparat', name: 'Aparat', icon: 'Icons/Camera_Icon.png', fallback: '📷', file: 'apps/aparat.html', version: '1.0.2', enabled: true },
        { id: 'wiadomosci', name: 'Wiadomości', icon: 'Icons/Messages_icon.png', fallback: '💬', file: 'apps/wiadomosci.html', version: '1.0.2', enabled: true },
        { id: 'telefon', name: 'Telefon', icon: 'Icons/Phone_Icon.png', fallback: '📞', file: 'apps/telefon.html', version: '1.0.2', enabled: true },
        { id: 'ustawienia', name: 'Ustawienia', icon: 'Icons/Settings_Icon.png', fallback: '⚙️', file: 'apps/ustawienia.html', version: '1.0.2', enabled: true },
        { id: 'kalkulator', name: 'Kalkulator', icon: 'Icons/calculator_icon.png', fallback: '🧮', file: 'apps/kalkulator.html', version: '1.0.2', enabled: true },
        { id: 'kalendarz', name: 'Kalendarz', icon: 'Icons/calendar_icon.png', fallback: '📅', file: 'apps/kalendarz.html', version: '1.0.2', enabled: true },
        { id: 'zegar', name: 'Zegar', icon: 'Icons/clock_icons.png', fallback: '⏰', file: 'apps/zegar.html', version: '1.0.2', enabled: true },
        { id: 'pliki', name: 'Pliki', icon: 'Icons/files_icons.png', fallback: '📁', file: 'apps/pliki.html', version: '1.0.2', enabled: true },
        { id: 'galeria', name: 'Galeria', icon: 'Icons/gallery_icon.png', fallback: '🖼️', file: 'apps/galeria.html', version: '1.0.2', enabled: true },
        { id: 'lens', name: 'Lens', icon: 'Icons/lens_icon.png', fallback: '🔍', file: 'apps/lens.html', version: '1.0.2', enabled: true },
        { id: 'notatki', name: 'Notatki', icon: 'Icons/notebook_icon.png', fallback: '📝', file: 'apps/notatki.html', version: '1.0.2', enabled: true },
        { id: 'latarka', name: 'Latarka', icon: '', fallback: '🔦', file: 'apps/latarka.html', version: '1.0.2', enabled: true },
        { id: 'dyktafon', name: 'Dyktafon', icon: '', fallback: '🎙️', file: 'apps/dyktafon.html', version: '1.0.2', enabled: true },
        { id: 'sprzatacz', name: 'Sprzątacz', icon: '', fallback: '🧹', file: 'apps/sprzatacz.html', version: '1.0.2', enabled: true },
        { id: 'aktualizacje', name: 'Aktualizacje', icon: '', fallback: '🔄', file: 'apps/aktualizacje.html', version: '1.0.2', enabled: true }
    ],

    getApps() {
        const overrides = (typeof StorageManager !== 'undefined' && StorageManager.get('zenios_app_states')) || {};
        return this.apps.map(app => ({
            ...app,
            enabled: typeof overrides[app.id] === 'boolean' ? overrides[app.id] : app.enabled
        }));
    },

    setAppEnabled(appId, enabled) {
        const overrides = (typeof StorageManager !== 'undefined' && StorageManager.get('zenios_app_states')) || {};
        overrides[appId] = Boolean(enabled);
        if (typeof StorageManager !== 'undefined') {
            StorageManager.set('zenios_app_states', overrides);
        }
    }
};
