const Watchdog = {
    timer: null,
    heartbeatMap: new Map(),
    timeoutMs: 8000,

    start() {
        this.stop();
        this.timer = setInterval(() => this.checkHealth(), 2500);
    },

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    },

    ping(sourceId) {
        this.heartbeatMap.set(sourceId, Date.now());
    },

    checkHealth() {
        const now = Date.now();
        this.heartbeatMap.forEach((ts, id) => {
            if (now - ts > this.timeoutMs && id === PerformanceManager.activeAppId) {
                Supervisor.handleAppHang(id, 'Brak odpowiedzi aplikacji (watchdog timeout)');
            }
        });
    }
};
