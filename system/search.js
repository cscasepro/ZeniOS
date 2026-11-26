const Search = {
    query(rawText = '') {
        const q = String(rawText || '').trim().toLowerCase();
        const results = [];

        const apps = typeof Manifest !== 'undefined' ? Manifest.getApps() : [];
        apps.filter(a => a.enabled).forEach(app => {
            if (!q || app.name.toLowerCase().includes(q) || app.id.toLowerCase().includes(q)) {
                results.push({
                    type: 'Aplikacja',
                    title: app.name,
                    subtitle: `v${app.version}`,
                    action: { type: 'OPEN_APP', appId: app.id }
                });
            }
        });

        const notes = (typeof StorageManager !== 'undefined' && StorageManager.get('notes', [])) || [];
        notes.forEach(note => {
            const title = String(note.title || 'Notatka');
            const text = String(note.text || '');
            if (q && (title.toLowerCase().includes(q) || text.toLowerCase().includes(q))) {
                results.push({
                    type: 'Notatka',
                    title,
                    subtitle: text.slice(0, 48),
                    action: { type: 'OPEN_APP', appId: 'notatki' }
                });
            }
        });

        const events = (typeof StorageManager !== 'undefined' && StorageManager.get('calendar_events', [])) || [];
        events.forEach(ev => {
            const title = String(ev.title || 'Wydarzenie');
            const date = String(ev.date || '');
            if (q && (title.toLowerCase().includes(q) || date.toLowerCase().includes(q))) {
                results.push({
                    type: 'Kalendarz',
                    title,
                    subtitle: date,
                    action: { type: 'OPEN_APP', appId: 'kalendarz' }
                });
            }
        });

        return results.slice(0, 20);
    }
};
