const WidgetsBridge = {
    init() {
        window.addEventListener('message', (e) => {
            if (!e.data || !e.data.type) return;
            if (e.data.type === 'WIDGET_OPEN_APP' && e.data.appId) {
                Kernel.openApp(e.data.appId);
            }
        });
    },

    refresh() {
        const frame = document.getElementById('widgets-frame');
        frame?.contentWindow?.postMessage({ type: 'WIDGET_REFRESH' }, '*');
    }
};
