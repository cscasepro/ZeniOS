const IconTheme = {
    currentStyle: 'liquid',
    allowed: ['liquid', 'color', 'dark', 'bw', 'pink-purple'],

    init() {
        const saved = StorageManager.get('icon_style', 'liquid');
        this.setStyle(saved, false);
    },

    setStyle(styleName, persist = true) {
        const next = this.allowed.includes(styleName) ? styleName : 'liquid';
        this.currentStyle = next;
        document.body.setAttribute('data-icon-style', next);

        const link = document.getElementById('icon-style-sheet');
        if (link) {
            link.href = `system/icon-styles/${next}.css`;
        }

        if (persist) StorageManager.set('icon_style', next);
        window.postMessage({ type: 'ICON_STYLE_CHANGED', style: next }, '*');
    },

    getStyle() {
        return this.currentStyle;
    }
};
