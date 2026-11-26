const IconTheme = {
    STORAGE_KEY: 'zenios_icon_style',
    defaultStyle: 'color',
    availableStyles: {
        color: { id: 'color', name: 'Kolorowy', file: 'system/icon-styles/color.css' },
        dark: { id: 'dark', name: 'Ciemny', file: 'system/icon-styles/dark.css' },
        bw: { id: 'bw', name: 'Szaro-biały', file: 'system/icon-styles/bw.css' },
        'pink-purple': { id: 'pink-purple', name: 'Różowo-fioletowy', file: 'system/icon-styles/pink-purple.css' }
    },

    init() {
        const saved = (typeof StorageManager !== 'undefined' && StorageManager.get(this.STORAGE_KEY))
            || localStorage.getItem(this.STORAGE_KEY)
            || this.defaultStyle;
        this.setStyle(saved, false);
    },

    setStyle(styleId, persist = true) {
        const chosen = this.availableStyles[styleId] ? styleId : this.defaultStyle;
        const link = document.getElementById('icon-style-sheet');
        if (link) {
            link.href = this.availableStyles[chosen].file;
        }
        document.body.dataset.iconStyle = chosen;

        if (persist) {
            if (typeof StorageManager !== 'undefined') {
                StorageManager.set(this.STORAGE_KEY, chosen);
            } else {
                localStorage.setItem(this.STORAGE_KEY, chosen);
            }
        }
        return chosen;
    },

    getStyle() {
        return document.body.dataset.iconStyle || this.defaultStyle;
    }
};
