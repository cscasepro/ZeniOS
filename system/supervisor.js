const Supervisor = {
    crashCount: 0,
    maxCrashesBeforeSafeMode: 3,

    init() {
        this.crashCount = Number(StorageManager.get('crash_count', 0)) || 0;
        window.addEventListener('error', (event) => {
            this.handleSystemError('UNCAUGHT_ERROR', event.message || 'Błąd krytyczny skryptu');
        });
        window.addEventListener('unhandledrejection', (event) => {
            this.handleSystemError('PROMISE_REJECTION', String(event.reason || 'Nieobsłużone odrzucenie obietnicy'));
        });
    },

    handleAppHang(appId, reason) {
        console.error(`[Supervisor] ${appId}: ${reason}`);
    },

    handleSystemError(code, details) {
        this.crashCount += 1;
        StorageManager.set('crash_count', this.crashCount);
        if (this.crashCount >= this.maxCrashesBeforeSafeMode && typeof Bootloader !== 'undefined') {
            StorageManager.set('crash_count', 0);
            Bootloader.triggerErrorBoot(code, details);
        }
    },

    resetCrashCounter() {
        this.crashCount = 0;
        StorageManager.set('crash_count', 0);
    }
};
