const SearchSystem = {
    query(term = '') {
        const q = String(term).trim().toLowerCase();
        const allApps = (typeof ZenManifest !== 'undefined' && ZenManifest.apps) || [];
        return allApps.filter(app => !q || app.name.toLowerCase().includes(q) || app.id.toLowerCase().includes(q));
    },

    openAppFromSearch(appId) {
        Kernel.toggleSearch(false);
        Kernel.openApp(appId);
    }
};
