const Watchdog = {
    lastTick: performance.now(),
    lagStrikes: 0,
    loopId: null,

    init() {
        this.lastTick = performance.now();
        const monitor = (now) => {
            const delta = now - this.lastTick;
            this.lastTick = now;

            // Próg lagów: dłuższa pauza między klatkami niż 650ms (poza ukrytą kartą i boot screenem)
            const bootFrame = document.getElementById('boot-screen-frame');
            const isBooting = bootFrame && !bootFrame.classList.contains('hidden');

            if (!document.hidden && !isBooting && delta > 650) {
                this.lagStrikes += 1;
                if (typeof Supervisor !== 'undefined') {
                    Supervisor.log('WARN', `Watchdog wykrył lag (${Math.round(delta)}ms), strike ${this.lagStrikes}/3`);
                }
                if (this.lagStrikes >= 3 && typeof Bootloader !== 'undefined') {
                    Bootloader.triggerErrorBoot('ERR_SYSTEM_OVERLOAD', 'Wykryto powtarzające się przycięcia interfejsu');
                    return;
                }
            } else if (this.lagStrikes > 0) {
                this.lagStrikes = Math.max(0, this.lagStrikes - 0.15);
            }

            this.loopId = requestAnimationFrame(monitor);
        };
        this.loopId = requestAnimationFrame(monitor);
    },

    stop() {
        if (this.loopId !== null) {
            cancelAnimationFrame(this.loopId);
            this.loopId = null;
        }
    }
};
