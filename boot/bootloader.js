const Bootloader = {
    isSafeMode: false,

    async start() {
        const params = new URLSearchParams(window.location.search);
        this.isSafeMode = params.get('safemode') === '1';

        this.updateBootScreen(15, this.isSafeMode ? 'Rozruch w Safe Mode...' : 'Sprawdzanie warstw ZeniOS v1.0.2...');
        await this.delay(250);

        if (this.isSafeMode) {
            const badge = document.getElementById('perf-badge');
            if (badge) badge.textContent = '🛡️ SAFE MODE';
        }

        this.updateBootScreen(55, 'Ładowanie jądra i nadzoru...');
        await this.delay(250);

        this.updateBootScreen(85, 'Przygotowanie widoku...');
        await this.delay(250);

        this.updateBootScreen(100, 'Gotowe');
        await this.delay(200);

        this.hideBootScreen();
        return { safeMode: this.isSafeMode };
    },

    updateBootScreen(progress, text) {
        const frame = document.getElementById('boot-screen-frame');
        if (frame && frame.contentWindow) {
            frame.contentWindow.postMessage({ type: 'BOOT_PROGRESS', progress, text }, '*');
        }
    },

    hideBootScreen() {
        const frame = document.getElementById('boot-screen-frame');
        if (!frame) return;
        frame.style.transition = 'opacity 0.35s ease';
        frame.style.opacity = '0';
        setTimeout(() => {
            frame.classList.add('hidden');
            frame.style.display = 'none';
        }, 360);
    },

    triggerErrorBoot(reasonCode = 'ERR_SYSTEM_OVERLOAD', details = '') {
        try {
            console.error(`[Bootloader] ERROR BOOT: ${reasonCode}`, details);
        } catch (_) {}

        const query = new URLSearchParams({
            code: String(reasonCode),
            details: String(details),
            ver: 'v1.0.2'
        });
        window.location.href = `boot/error-boot.html?${query.toString()}`;
    },

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
};
