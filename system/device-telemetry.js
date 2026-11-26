const DeviceTelemetry = {
    state: {
        level: 100,
        charging: false,
        time: '15:19',
        dateLabel: 'Czwartek, 26 listopada'
    },
    listeners: new Set(),

    async init() {
        this.updateClockAndDate();
        setInterval(() => this.updateClockAndDate(), 1000);

        if (typeof navigator !== 'undefined' && typeof navigator.getBattery === 'function') {
            try {
                const bat = await navigator.getBattery();
                const syncBat = () => {
                    this.state.level = Math.round((bat.level ?? 1) * 100);
                    this.state.charging = Boolean(bat.charging);
                    this.applyBatteryUI();
                    this.emit();
                };
                syncBat();
                bat.addEventListener('levelchange', syncBat);
                bat.addEventListener('chargingchange', syncBat);
                return;
            } catch {}
        }
        this.applyBatteryUI();
    },

    updateClockAndDate() {
        const now = new Date();
        const hhmm = now.toTimeString().slice(0, 5);
        const days = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
        const months = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];

        this.state.time = hhmm;
        this.state.dateLabel = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]}`;

        const clockEl = document.getElementById('clock');
        if (clockEl) clockEl.textContent = hhmm;
        this.emit();
    },

    applyBatteryUI() {
        const pctEl = document.getElementById('battery-pct');
        const chgEl = document.getElementById('charging-icon');
        if (pctEl) pctEl.textContent = `${this.state.level}%`;
        if (chgEl) chgEl.style.display = this.state.charging ? 'inline-block' : 'none';
    },

    getSnapshot() {
        return { ...this.state };
    },

    onChange(fn) {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    },

    emit() {
        const snap = this.getSnapshot();
        this.listeners.forEach(fn => fn(snap));
        window.postMessage({ type: 'TELEMETRY_UPDATED', telemetry: snap }, '*');
    }
};
