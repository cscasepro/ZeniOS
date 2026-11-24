/* =====================================================================
   ZeniOS — Wi-Fi i Bluetooth (window.ZeniNet)
   ---------------------------------------------------------------------
   • podgląd aktualnie używanej sieci i listy dostępnych sieci
   • łączenie jednym kliknięciem (stan zapisywany w pamięci)
   • lista urządzeń Bluetooth z podłączaniem / odłączaniem
   • przełączniki i zgodność z trybem samolotowym oraz Centrum sterowania
   Ładować PO loading.js.
   ===================================================================== */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const NETWORKS = [
    { ssid: 'ZeniNet', sub: 'Zabezpieczone · 5 GHz', signal: 3 },
    { ssid: 'ZeniNet-5G', sub: 'Zabezpieczone · 6 GHz', signal: 3 },
    { ssid: 'ZeniOS Guest', sub: 'Otwarta sieć', signal: 2, open: true },
    { ssid: 'Kawiarnia Mleczna', sub: 'Zabezpieczone · 2,4 GHz', signal: 2 },
    { ssid: 'DOM_SASIADA', sub: 'Zabezpieczone · 2,4 GHz', signal: 1 },
    { ssid: 'iPhone Kamila', sub: 'Osobisty hotspot', signal: 1 }
  ];

  const BT_MY = [
    { name: 'AirPods Pro', sub: 'Słuchawki · 82%', connected: true },
    { name: 'Apple Watch', sub: 'Zegarek · 64%' },
    { name: 'Magic Keyboard', sub: 'Klawiatura · 100%' }
  ];

  const BT_OTHER = [
    { name: 'ZeniSound Bar', sub: 'Głośnik' },
    { name: 'ZeniCar Audio', sub: 'Samochód' },
    { name: 'Drukarka ZeniPrint', sub: 'Drukarka' }
  ];

  const state = {
    wifiOn: true,
    current: 'ZeniNet',
    connecting: null,
    btOn: true,
    btConnected: 'AirPods Pro',
    btBusy: null
  };

  /* ------------------------------ wspólne ------------------------------ */
  function wifiRowValue() {
    const el = $('wifi-status-value');
    if (!el) return;
    el.textContent = !state.wifiOn ? 'Wyłączone' : state.connecting ? 'Łączenie…' : state.current || 'Brak sieci';
  }

  function btRowValue() {
    const el = $('bt-status-value');
    if (el) el.textContent = state.btOn ? 'Włączony' : 'Wyłączony';
  }

  function toast(msg) {
    if (typeof window.zeniToast === 'function') window.zeniToast(msg);
  }

  function signalIcon(level) {
    const wrap = document.createElement('span');
    wrap.className = 'net-signal';
    wrap.dataset.level = String(level);
    for (let i = 1; i <= 3; i++) {
      const bar = document.createElement('i');
      if (i > level) bar.className = 'off';
      wrap.appendChild(bar);
    }
    return wrap;
  }

  function lockIcon(open) {
    const span = document.createElement('span');
    span.className = 'net-lock';
    span.innerHTML = open
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="11" width="16" height="10" rx="2.5"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="11" width="16" height="10" rx="2.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
    return span;
  }

  /* -------------------------------- Wi-Fi -------------------------------- */
  function renderWifiCurrent() {
    const name = $('wifi-current-name');
    const sub = $('wifi-current-sub');
    const group = $('wifi-current-group');
    if (!name || !sub) return;
    const active = state.wifiOn ? state.current : null;
    group?.classList.toggle('hidden', !active);
    if (!active) return;
    const net = NETWORKS.find((n) => n.ssid === state.current);
    name.textContent = active;
    sub.textContent = state.connecting === active
      ? 'Łączenie…'
      : net ? `Połączono · ${net.sub}` : 'Połączono';
  }

  function renderWifiList() {
    const list = $('wifi-list');
    if (!list) return;
    list.textContent = '';
    NETWORKS.forEach((net) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'settings-row net-row';
      row.dataset.ssid = net.ssid;
      const isCurrent = state.wifiOn && state.current === net.ssid;
      const isBusy = state.connecting === net.ssid;
      row.classList.toggle('connected', isCurrent);
      row.classList.toggle('busy', isBusy);

      const badge = document.createElement('span');
      badge.className = 'row-badge badge-blue';
      badge.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="19.5" r="1.2" fill="#fff" stroke="none"/></svg>';

      const col = document.createElement('div');
      col.className = 'option-text-col';
      const title = document.createElement('span');
      title.className = 'row-title';
      title.textContent = net.ssid;
      const sub = document.createElement('span');
      sub.className = 'option-sub';
      sub.textContent = isBusy ? 'Łączenie…' : isCurrent ? 'Połączono' : net.sub;
      col.append(title, sub);

      row.append(badge, col, lockIcon(Boolean(net.open)));
      row.appendChild(signalIcon(net.signal));
      if (isCurrent) {
        const check = document.createElement('span');
        check.className = 'net-check';
        check.textContent = '✓';
        row.appendChild(check);
      }
      if (isBusy) {
        const spin = document.createElement('span');
        spin.className = 'net-spinner';
        row.appendChild(spin);
      }

      row.addEventListener('click', () => connect(net.ssid));
      list.appendChild(row);
    });
  }

  function renderWifi() {
    const screen = $('settings-wifi');
    screen?.classList.toggle('disabled', !state.wifiOn);
    const toggle = $('wifi-toggle');
    if (toggle) toggle.checked = state.wifiOn;
    wifiRowValue();
    renderWifiCurrent();
    renderWifiList();
  }

  function connect(ssid) {
    if (!state.wifiOn || state.connecting) return;
    if (state.current === ssid) {
      state.connecting = ssid;
      renderWifi();
      setTimeout(() => {
        state.connecting = null;
        renderWifi();
        toast(`Połączono z ${ssid}`);
      }, 500);
      return;
    }
    state.connecting = ssid;
    renderWifi();
    setTimeout(() => {
      state.current = ssid;
      state.connecting = null;
      renderWifi();
      toast(`Połączono z ${ssid}`);
    }, 900);
  }

  function setWifi(on) {
    state.wifiOn = on;
    state.connecting = null;
    if (!on) state.current = null;
    else state.current = 'ZeniNet';
    renderWifi();
    if (!on) toast('Wi-Fi: wyłączone');
  }

  /* ------------------------------ Bluetooth ------------------------------ */
  function renderBtList(container, devices, mine) {
    if (!container) return;
    container.textContent = '';
    devices.forEach((device) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'settings-row net-row';
      const connected = mine && state.btConnected === device.name;
      const busy = state.btBusy === device.name;
      row.classList.toggle('connected', connected);
      row.classList.toggle('busy', busy);

      const badge = document.createElement('span');
      badge.className = 'row-badge badge-blue bt-badge';
      badge.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5"/></svg>';

      const col = document.createElement('div');
      col.className = 'option-text-col';
      const title = document.createElement('span');
      title.className = 'row-title';
      title.textContent = device.name;
      const sub = document.createElement('span');
      sub.className = 'option-sub';
      sub.textContent = busy ? 'Łączenie…' : connected ? `Połączono · ${device.sub}` : device.sub;
      col.append(title, sub);

      row.append(badge, col);
      if (connected) {
        const info = document.createElement('span');
        info.className = 'net-battery';
        info.textContent = 'i';
        row.appendChild(info);
      }
      if (busy) {
        const spin = document.createElement('span');
        spin.className = 'net-spinner';
        row.appendChild(spin);
      }

      row.addEventListener('click', () => toggleDevice(device.name));
      container.appendChild(row);
    });
  }

  function renderBt() {
    const screen = $('settings-bluetooth');
    screen?.classList.toggle('disabled', !state.btOn);
    const toggle = $('bt-toggle');
    if (toggle) toggle.checked = state.btOn;
    btRowValue();
    renderBtList($('bt-list-my'), BT_MY, true);
    renderBtList($('bt-list-other'), BT_OTHER, false);
    const known = $('bt-connected-label');
    if (known) {
      known.textContent = state.btOn
        ? (state.btConnected ? `Połączone: ${state.btConnected}` : 'Brak połączonych urządzeń')
        : 'Bluetooth wyłączony';
    }
  }

  function toggleDevice(name) {
    if (!state.btOn || state.btBusy) return;
    if (state.btConnected === name) {
      state.btConnected = null;
      renderBt();
      toast(`Odłączono ${name}`);
      return;
    }
    state.btBusy = name;
    renderBt();
    setTimeout(() => {
      state.btConnected = name;
      state.btBusy = null;
      renderBt();
      toast(`Połączono z ${name}`);
    }, 850);
  }

  function setBt(on) {
    state.btOn = on;
    state.btBusy = null;
    state.btConnected = on ? 'AirPods Pro' : null;
    renderBt();
    if (!on) toast('Bluetooth: wyłączony');
  }

  /* --------------------------------- init --------------------------------- */
  function bind() {
    $('open-wifi-picker')?.addEventListener('click', () => {
      if (typeof openSettingsSubscreen === 'function') openSettingsSubscreen('settings-wifi');
    });
    $('open-bt-picker')?.addEventListener('click', () => {
      if (typeof openSettingsSubscreen === 'function') openSettingsSubscreen('settings-bluetooth');
    });

    $('wifi-toggle')?.addEventListener('change', (e) => setWifi(e.target.checked));
    $('bt-toggle')?.addEventListener('change', (e) => setBt(e.target.checked));

    /* tryb samolotowy wyłącza oba radia */
    $('airplane-toggle')?.addEventListener('change', (e) => {
      if (e.target.checked) {
        state.wifiOn = false;
        state.btOn = false;
        state.btConnected = null;
      } else {
        state.wifiOn = true;
        state.btOn = true;
        state.btConnected = 'AirPods Pro';
        state.current = 'ZeniNet';
      }
      renderWifi();
      renderBt();
    });

    renderWifi();
    renderBt();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();

  window.ZeniNet = {
    get state() { return Object.assign({}, state); },
    connect,
    setWifi,
    setBt
  };
})();
