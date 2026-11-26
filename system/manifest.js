const ZenManifest = {
    osName: 'ZenOS',
    version: 'v1.0.2',
    build: '26.1.0-liquid',
    apps: [
        { id: 'aparat', name: 'Aparat', url: 'apps/aparat.html', icon: 'Icons/Camera_Icon.png', glyph: '📷', page: 0, dock: false, critical: false },
        { id: 'wiadomosci', name: 'Wiadomości', url: 'apps/wiadomosci.html', icon: 'Icons/Messages_icon.png', glyph: '💬', page: 0, dock: true, critical: false },
        { id: 'telefon', name: 'Telefon', url: 'apps/telefon.html', icon: 'Icons/Phone_Icon.png', glyph: '📞', page: 0, dock: true, critical: true },
        { id: 'ustawienia', name: 'Ustawienia', url: 'apps/ustawienia.html', icon: 'Icons/Settings_Icon.png', glyph: '⚙️', page: 0, dock: false, critical: true },
        { id: 'kalkulator', name: 'Kalkulator', url: 'apps/kalkulator.html', icon: 'Icons/calculator_icon.png', glyph: '🧮', page: 0, dock: false, critical: false },
        { id: 'kalendarz', name: 'Kalendarz', url: 'apps/kalendarz.html', icon: 'Icons/calendar_icon.png', glyph: '📅', page: 0, dock: false, critical: false },
        { id: 'zegar', name: 'Zegar', url: 'apps/zegar.html', icon: 'Icons/clock_icons.png', glyph: '⏰', page: 0, dock: false, critical: false },
        { id: 'pliki', name: 'Pliki', url: 'apps/pliki.html', icon: 'Icons/files_icons.png', glyph: '📁', page: 0, dock: false, critical: false },
        { id: 'galeria', name: 'Galeria', url: 'apps/galeria.html', icon: 'Icons/gallery_icon.png', glyph: '🖼️', page: 1, dock: true, critical: false },
        { id: 'lens', name: 'QR', url: 'apps/lens.html', icon: 'Icons/lens_icon.png', glyph: '🔍', page: 1, dock: true, critical: false },
        { id: 'notatki', name: 'Notatki', url: 'apps/notatki.html', icon: 'Icons/notebook_icon.png', glyph: '📝', page: 1, dock: false, critical: false },
        { id: 'pamiec', name: 'Pamięć ZenOS', url: 'apps/pamiec.html', icon: '', glyph: '💾', page: 1, dock: false, critical: false },
        { id: 'latarka', name: 'Latarka', url: 'apps/latarka.html', icon: '', glyph: '🔦', page: 1, dock: false, critical: false },
        { id: 'aktualizacje', name: 'Aktualizacje', url: 'apps/aktualizacje.html', icon: '', glyph: '🔄', page: 1, dock: false, critical: false }
    ],
    wallpapers: [
        { id: 'wp-1', name: 'Głębia iOS', css: 'radial-gradient(circle at 70% 25%, #2563eb 0%, #1d4ed8 34%, #0f172a 75%, #060913 100%)', file: 'default_wallpapers/default_wallpaper_1' },
        { id: 'wp-2', name: 'Błękitne szkło', css: 'linear-gradient(135deg, #d8eceb 0%, #98c7c8 28%, #2d58b8 55%, #162a68 100%)', file: 'default_wallpapers/default_wallpaper_2' },
        { id: 'wp-3', name: 'Ciepły bursztyn', css: 'radial-gradient(circle at 50% 45%, #3b2612 0%, #17120c 58%, #070709 100%)', file: 'default_wallpapers/default_wallpaper_3' },
        { id: 'wp-4', name: 'Lodowy błękit', css: 'linear-gradient(160deg, #1b3b6f 0%, #2c6aa0 45%, #8fd3e8 100%)', file: 'default_wallpapers/default_wallpaper_4' }
    ]
};
