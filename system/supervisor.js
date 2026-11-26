const Supervisor = {
    logs: [],
    MAX_LOGS: 80,

    init() {
        this.log('INFO', 'Supervisor aktywny w tle (ZeniOS v1.0.2)');

        // Globalne błędy w głównym oknie
        window.addEventListener('error', (event) => {
            this.log('ERROR', `Błąd jądra: ${event.message || 'nieznany'} (${event.filename || ''}:${event.lineno || ''})`);
        });

        window.addEventListener('unhandledrejection', (event) => {
            const reason = event.reason && event.reason.message ? event.reason.message : String(event.reason || 'promise rejection');
            this.log('ERROR', `Nieobsłużony błąd async: ${reason}`);
        });
    },

    log(level, message) {
        const entry = {
            time: new Date().toTimeString().slice(0, 8),
            level,
            message
        };
        this.logs.push(entry);
        if (this.logs.length > this.MAX_LOGS) {
            this.logs.shift();
        }
    },

    getLogs() {
        return [...this.logs];
    },

    clearLogs() {
        this.logs = [];
    },

    // Obsługa komunikatów od odizolowanych aplikacji / modułów
    handleMessage(data, sourceWindow) {
        if (!data || typeof data !== 'object') return false;

        if (data.type === 'APP_ERROR') {
            const appId = data.appId || 'nieznana_apk';
            const msg = data.message || 'Błąd wewnętrzny aplikacji';
            this.log('APP_CRASH', `[${appId}] ${msg}`);

            if (typeof Notifications !== 'undefined') {
                Notifications.push('Nadzór aplikacji', `Wykryto błąd w "${appId}". System chroni pozostałe moduły.`);
            }
            return true;
        }

        if (data.type === 'FORCE_ERROR_BOOT') {
            this.log('WARN', `Wywołano Error Boot przez: ${data.source || 'system'}`);
            if (typeof Bootloader !== 'undefined') {
                Bootloader.triggerErrorBoot(data.code || 'ERR_SUPERVISOR_TRIGGER', data.details || 'Wymuszony restart awaryjny');
            }
            return true;
        }

        if (data.type === 'GET_SUPERVISOR_LOGS' && sourceWindow) {
            sourceWindow.postMessage({ type: 'SUPERVISOR_LOGS', logs: this.getLogs() }, '*');
            return true;
        }

        return false;
    }
};
