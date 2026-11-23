/* =====================================================================
   ZeniOS — moduły systemowe wielokrotnego użytku
   1. window.ZeniPeek         — podgląd konwersacji bez oznaczania jako przeczytane
   2. window.ZeniMessageMenu  — menu kontekstowe pojedynczej wiadomości
   3. window.ZeniMessages     — aplikacja „Wiadomości” (przykład integracji)
   Ładować PO loading.js. Nakładki trafiają do .phone-screen (główny kontener).
   ===================================================================== */
(function () {
  'use strict';

  const HOLD_MS = 450;      // czas przytrzymania
  const MOVE_CANCEL = 10;   // ruch (px) anulujący timer — nie blokuje przewijania

  /* ------------------------------ helpery ------------------------------ */
  const screenEl = () => document.querySelector('.phone-screen') || document.body;
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const toast = (msg) => { if (typeof window.zeniToast === 'function') window.zeniToast(msg); };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const deepFreeze = (o) => {
    Object.values(o).forEach((v) => { if (v && typeof v === 'object') deepFreeze(v); });
    return Object.freeze(o);
  };

  /* Wspólny detektor przytrzymania. Zwraca funkcję odpinającą nasłuchiwanie.
     Obsługuje: pointerdown / pointerup / pointermove / pointercancel.
     Po udanym przytrzymaniu „połyka” następujący po nim click. */
  function bindLongPress(root, opts) {
    const { selector, holdMs = HOLD_MS, onLongPress, onShortClick } = opts;
    const ac = new AbortController();
    const sig = { signal: ac.signal };
    let timer = null, startX = 0, startY = 0, target = null, pid = null, suppressUntil = 0;

    const cancel = () => { clearTimeout(timer); timer = null; target = null; pid = null; };

    root.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const t = e.target.closest(selector);
      if (!t || !root.contains(t)) return;
      cancel();
      target = t; startX = e.clientX; startY = e.clientY; pid = e.pointerId;
      timer = setTimeout(() => {
        const hit = target;
        cancel();
        suppressUntil = Date.now() + 700;
        onLongPress(hit, e);
      }, holdMs);
    }, sig);

    root.addEventListener('pointermove', (e) => {
      if (!timer || e.pointerId !== pid) return;
      if (Math.hypot(e.clientX - startX, e.clientY - startY) > MOVE_CANCEL) cancel();
    }, sig);

    ['pointerup', 'pointercancel'].forEach((type) => root.addEventListener(type, cancel, sig));
    root.addEventListener('pointerleave', cancel, sig);

    root.addEventListener('contextmenu', (e) => {
      if (e.target.closest(selector)) e.preventDefault();
    }, sig);

    // capture: połknij click po przytrzymaniu, w przeciwnym razie obsłuż krótkie kliknięcie
    root.addEventListener('click', (e) => {
      if (Date.now() < suppressUntil) {
        e.stopImmediatePropagation();
        e.preventDefault();
        return;
      }
      const t = e.target.closest(selector);
      if (t && root.contains(t) && onShortClick) onShortClick(t, e);
    }, { signal: ac.signal, capture: true });

    return () => { cancel(); ac.abort(); };
  }

  /* Wspólne etykiety reakcji */
  const REACTIONS = [
    { id: 'heart', label: '❤️', title: 'Serce' },
    { id: 'up',    label: '👍', title: 'Kciuk w górę' },
    { id: 'down',  label: '👎', title: 'Kciuk w dół' },
    { id: 'haha',  label: 'HA HA', title: 'Haha', text: true },
    { id: 'excl',  label: '!!', title: 'Wykrzykniki', text: true },
    { id: 'q',     label: '?', title: 'Pytanie', text: true }
  ];
  const reactionById = (id) => REACTIONS.find((r) => r.id === id);

  /* =====================================================================
     1. ZeniPeek
     ---------------------------------------------------------------------
     Tryb TYLKO DO ODCZYTU. Moduł nie ma dostępu do stanu aplikacji,
     nie dotyka localStorage i nigdy sam nie wywołuje onMarkAsRead —
     robi to wyłącznie po kliknięciu w kartę (po onOpenFullChat).

     Użycie:
       ZeniPeek.attach(listEl, {
         itemSelector: '.moja-rozmowa',
         getConversation: (itemEl) => ({ id, title, accent, avatar:{text,color},
                                         messages:[{from:'me'|'them', text, time, reactions:[]}] }),
         onOpenFullChat: (conv) => ...,
         onMarkAsRead:   (conv) => ...
       });
     ===================================================================== */
  const ZeniPeek = (function () {
    let overlay, backdrop, card, grab, head, avatarEl, titleEl, subEl, bodyEl;
    let current = null;          // { conv, handlers }
    let openedAt = 0;
    let down = null, travelled = 0, dragMoved = false;

    function build() {
      if (overlay) return;
      overlay = el('div', 'zpeek');
      overlay.setAttribute('aria-hidden', 'true');
      backdrop = el('div', 'zpeek-backdrop');
      card = el('div', 'zpeek-card');
      card.setAttribute('role', 'dialog');
      card.setAttribute('aria-label', 'Podgląd rozmowy');

      grab = el('div', 'zpeek-grab');
      grab.appendChild(el('span'));
      head = el('header', 'zpeek-head');
      avatarEl = el('div', 'zpeek-avatar');
      const titles = el('div', 'zpeek-titles');
      titleEl = el('div', 'zpeek-title');
      subEl = el('div', 'zpeek-sub', 'Podgląd · nie oznaczono jako przeczytane');
      titles.append(titleEl, subEl);
      head.append(avatarEl, titles);
      bodyEl = el('div', 'zpeek-body');
      const foot = el('footer', 'zpeek-foot', 'Dotknij kartę, aby otworzyć czat');

      card.append(grab, head, bodyEl, foot);
      overlay.append(backdrop, card);
      screenEl().appendChild(overlay);

      // kliknięcie w rozmyte tło = zamknięcie bez zmiany statusu
      backdrop.addEventListener('click', () => {
        if (Date.now() - openedAt < 350) return; // zwolnienie palca po przytrzymaniu
        close('backdrop');
      });

      // śledź ruch, żeby przewijanie historii nie liczyło się jako „tap”
      card.addEventListener('pointerdown', (e) => {
        down = { x: e.clientX, y: e.clientY }; travelled = 0; dragMoved = false;
      });
      card.addEventListener('pointermove', (e) => {
        if (down) travelled = Math.max(travelled, Math.hypot(e.clientX - down.x, e.clientY - down.y));
      });

      // kliknięcie w kartę = otwórz pełny czat, DOPIERO TERAZ oznacz jako przeczytane
      card.addEventListener('click', () => {
        if (!current || dragMoved || travelled > MOVE_CANCEL) return;
        const { conv, handlers } = current;
        close('card');
        if (handlers.onOpenFullChat) handlers.onOpenFullChat(conv);
        if (handlers.onMarkAsRead) handlers.onMarkAsRead(conv);
      });

      // przesunięcie w dół (uchwyt + nagłówek) zamyka podgląd
      [grab, head].forEach((handle) => {
        let sy = null;
        handle.addEventListener('pointerdown', (e) => {
          sy = e.clientY; handle.setPointerCapture(e.pointerId);
          card.style.transition = 'none';
        });
        handle.addEventListener('pointermove', (e) => {
          if (sy == null) return;
          const dy = Math.max(0, e.clientY - sy);
          if (dy > MOVE_CANCEL) dragMoved = true;
          card.style.transform = `translateY(${dy}px)`;
          backdrop.style.opacity = String(Math.max(0, 1 - dy / 320));
        });
        const end = (e) => {
          if (sy == null) return;
          const dy = Math.max(0, e.clientY - sy);
          sy = null;
          card.style.transition = '';
          backdrop.style.opacity = '';
          if (dy > 80) close('swipe'); else card.style.transform = '';
        };
        handle.addEventListener('pointerup', end);
        handle.addEventListener('pointercancel', end);
      });

      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && current) close('escape'); });
    }

    function renderMessage(m, accent) {
      const row = el('div', `zpeek-msg ${m.from === 'me' ? 'me' : 'them'}`);
      const bub = el('div', 'zpeek-bubble');
      if (m.author) bub.appendChild(el('div', 'zpeek-author', m.author));
      bub.appendChild(el('div', 'zpeek-text', m.text));
      const meta = el('div', 'zpeek-meta', (m.time || '') + (m.edited ? ' · edytowano' : ''));
      bub.appendChild(meta);
      if (m.reactions && m.reactions.length) {
        const rs = el('div', 'zpeek-reacts');
        m.reactions.forEach((id) => {
          const r = reactionById(id);
          rs.appendChild(el('span', r && r.text ? 'txt' : '', r ? r.label : id));
        });
        bub.appendChild(rs);
      }
      row.appendChild(bub);
      return row;
    }

    /* conv: { id, title, subtitle?, accent?, avatar?:{text,color,image?}, messages:[] }
       handlers: { onOpenFullChat, onMarkAsRead, onClose }
       options:  { accent, renderMessage(m, conv) -> HTMLElement } */
    function open(conv, handlers, options) {
      build();
      handlers = handlers || {};
      options = options || {};
      const snap = deepFreeze(clone(conv)); // kopia tylko do odczytu — nie da się zmienić stanu aplikacji
      current = { conv: snap, handlers };
      openedAt = Date.now();

      const accent = options.accent || snap.accent || '#0a84ff';
      card.style.setProperty('--peek-accent', accent);
      titleEl.textContent = snap.title || '';
      subEl.textContent = snap.subtitle || 'Podgląd · nie oznaczono jako przeczytane';

      avatarEl.textContent = '';
      avatarEl.style.background = (snap.avatar && snap.avatar.color) || accent;
      if (snap.avatar && snap.avatar.image) {
        const img = el('img'); img.src = snap.avatar.image; img.alt = '';
        avatarEl.appendChild(img);
      } else {
        avatarEl.textContent = (snap.avatar && snap.avatar.text) || (snap.title || '?').charAt(0).toUpperCase();
      }

      bodyEl.textContent = '';
      const make = options.renderMessage || ((m) => renderMessage(m, accent));
      (snap.messages || []).forEach((m) => bodyEl.appendChild(make(m, snap)));

      card.style.transform = '';
      overlay.setAttribute('aria-hidden', 'false');
      overlay.classList.add('open');
      bodyEl.scrollTop = bodyEl.scrollHeight; // najnowsze na dole, starsze do przewinięcia
    }

    function close(reason) {
      if (!current) return;
      const { conv, handlers } = current;
      current = null;
      overlay.classList.remove('open');
      overlay.setAttribute('aria-hidden', 'true');
      card.style.transform = '';
      if (handlers.onClose) handlers.onClose(conv, reason || 'close');
    }

    /* Podłącza przytrzymanie (podgląd) i krótkie kliknięcie (pełny czat) do listy. */
    function attach(root, cfg) {
      const handlers = {
        onOpenFullChat: cfg.onOpenFullChat,
        onMarkAsRead: cfg.onMarkAsRead,
        onClose: cfg.onClose
      };
      return bindLongPress(root, {
        selector: cfg.itemSelector,
        holdMs: cfg.holdMs || HOLD_MS,
        onLongPress: (item) => open(cfg.getConversation(item), handlers, { accent: cfg.accent, renderMessage: cfg.renderMessage }),
        onShortClick: (item) => {
          const conv = cfg.getConversation(item);
          if (cfg.onShortClick) { cfg.onShortClick(conv, item); return; }
          if (handlers.onOpenFullChat) handlers.onOpenFullChat(conv);
          if (handlers.onMarkAsRead) handlers.onMarkAsRead(conv);   // zwykłe kliknięcie = przeczytane
        }
      });
    }

    return { open, close, attach, isOpen: () => !!current };
  })();

  /* =====================================================================
     2. ZeniMessageMenu
     ---------------------------------------------------------------------
       ZeniMessageMenu.attach(threadEl, {
         bubbleSelector: '.msg-bubble',
         getMessage: (bubbleEl) => ({ id, text, own:true|false, reactions:['heart'] }),
         actions: ['reply','unsend','edit','copy','translate','more'] | (msg)=>[...],
         onReact(reactionId, msg), onReply(msg), onUnsend(msg), onEdit(msg),
         onCopy(msg), onTranslate(msg), onMore(msg)
       });
     Własne akcje: { id, label, icon?, danger?, ownOnly?, onSelect(msg) }.
     ===================================================================== */
  const ICON = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICONS = {
    reply: ICON('<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 6 6v3"/>'),
    unsend: ICON('<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>'),
    edit: ICON('<path d="M4 20h4L19 9l-4-4L4 16v4z"/>'),
    copy: ICON('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>'),
    translate: ICON('<path d="M4 5h9"/><path d="M8.5 3v2"/><path d="M6 5c.6 3.5 2.6 6.2 5.5 8"/><path d="M12 5c-.6 3.5-3 6.5-7 8.5"/><path d="M12 20l4-9 4 9"/><path d="M13.3 17h5.4"/>'),
    more: ICON('<circle cx="5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="19" cy="12" r="1.2" fill="currentColor"/>')
  };
  const BUILTIN_ACTIONS = [
    { id: 'reply',     label: 'Odpowiedz',      cb: 'onReply' },
    { id: 'unsend',    label: 'Cofnij wysłanie', cb: 'onUnsend', danger: true, ownOnly: true },
    { id: 'edit',      label: 'Edytuj',         cb: 'onEdit', ownOnly: true },
    { id: 'copy',      label: 'Kopiuj',         cb: 'onCopy', alwaysAvailable: true },
    { id: 'translate', label: 'Tłumacz',        cb: 'onTranslate' },
    { id: 'more',      label: 'Więcej...',      cb: 'onMore' }
  ];

  const ZeniMessageMenu = (function () {
    let overlay = null, hiddenBubble = null, escHandler = null, closeTimer = null;

    async function copyText(text) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (e) {
        try { // zapasowa ścieżka, gdy Clipboard API jest zablokowane (np. brak HTTPS)
          const ta = el('textarea');
          ta.value = text; ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
          document.body.appendChild(ta); ta.select();
          const ok = document.execCommand('copy');
          ta.remove();
          return ok;
        } catch (e2) { return false; }
      }
    }

    function resolveActions(cfg, msg) {
      let list = typeof cfg.actions === 'function' ? cfg.actions(msg) : cfg.actions;
      if (!list) list = BUILTIN_ACTIONS.map((a) => a.id);
      const out = [];
      list.forEach((item) => {
        const def = typeof item === 'string' ? BUILTIN_ACTIONS.find((a) => a.id === item) : item;
        if (!def) return;
        if (def.ownOnly && !msg.own) return;
        const custom = typeof item !== 'string';
        const hasCb = custom ? typeof def.onSelect === 'function' : (typeof cfg[def.cb] === 'function' || def.alwaysAvailable);
        if (hasCb) out.push({ def, custom });
      });
      return out;
    }

    function close(immediate) {
      if (!overlay) return;
      const ov = overlay;
      overlay = null;
      if (escHandler) { document.removeEventListener('keydown', escHandler); escHandler = null; }
      if (hiddenBubble) { hiddenBubble.style.visibility = ''; hiddenBubble = null; }
      ov.classList.remove('open');
      ov.setAttribute('aria-hidden', 'true');
      if (immediate) ov.remove(); else closeTimer = setTimeout(() => ov.remove(), 220);
    }

    function open(cfg) {
      close(true);
      clearTimeout(closeTimer);
      const msg = cfg.message || {};
      const bubble = cfg.bubble;
      const screen = screenEl();
      const sr = screen.getBoundingClientRect();
      const br = bubble.getBoundingClientRect();

      overlay = el('div', 'zmenu measuring');
      overlay.setAttribute('aria-hidden', 'false');
      const backdrop = el('div', 'zmenu-backdrop');
      backdrop.addEventListener('click', () => close());

      // ostry klon dymka ponad rozmytym tłem
      const spot = bubble.cloneNode(true);
      spot.removeAttribute('id');
      spot.classList.add('zmenu-spot');
      spot.style.width = `${br.width}px`;
      spot.style.visibility = 'visible';

      // pasek szybkich reakcji
      const bar = el('div', 'zmenu-reactions');
      (cfg.reactions || REACTIONS).forEach((r) => {
        const b = el('button', `zmenu-react${r.text ? ' txt' : ''}${(msg.reactions || []).includes(r.id) ? ' active' : ''}`, r.label);
        b.type = 'button'; b.title = r.title || ''; b.setAttribute('aria-label', r.title || r.label);
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          close();
          if (typeof cfg.onReact === 'function') cfg.onReact(r.id, msg);
        });
        bar.appendChild(b);
      });

      // pionowe menu akcji
      const menu = el('div', 'zmenu-actions');
      menu.setAttribute('role', 'menu');
      resolveActions(cfg, msg).forEach(({ def, custom }) => {
        const b = el('button', `zmenu-item${def.danger ? ' danger' : ''}`);
        b.type = 'button'; b.setAttribute('role', 'menuitem');
        b.appendChild(el('span', 'zmenu-item-label', def.label));
        const ic = el('span', 'zmenu-item-icon');
        ic.innerHTML = def.icon || ICONS[def.id] || '';
        b.appendChild(ic);
        b.addEventListener('click', async (e) => {
          e.stopPropagation();
          close();
          if (custom) { def.onSelect(msg); return; }
          if (def.id === 'copy') {
            const ok = await copyText(msg.text || '');
            toast(ok ? 'Skopiowano' : 'Nie udało się skopiować');
          }
          if (typeof cfg[def.cb] === 'function') cfg[def.cb](msg);
        });
        menu.appendChild(b);
      });

      overlay.append(backdrop, spot, bar, menu);
      screen.appendChild(overlay);

      /* --- pozycjonowanie: nigdy poza ekran ZeniOS, pasek statusu ani nawigację --- */
      const W = sr.width, H = sr.height;
      const TOP = 40, BOTTOM = 76, GAP = 8, SIDE = 10;
      menu.style.width = `${Math.min(236, W - SIDE * 2)}px`;
      const barW = bar.offsetWidth, barH = bar.offsetHeight;
      const menuW = menu.offsetWidth, menuH = menu.offsetHeight;

      let bubbleH = br.height;
      const maxBubbleH = H - TOP - BOTTOM - barH - menuH - GAP * 2;
      if (bubbleH > maxBubbleH) {            // bardzo długi dymek — przytnij i pozwól przewijać
        bubbleH = Math.max(48, maxBubbleH);
        spot.style.maxHeight = `${bubbleH}px`;
        spot.style.overflow = 'auto';
      }
      const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi));
      const left = clamp(br.left - sr.left, SIDE, W - SIDE - br.width);
      const minTop = TOP + barH + GAP;
      const maxTop = H - BOTTOM - menuH - GAP - bubbleH;
      const top = clamp(br.top - sr.top, minTop, maxTop);

      const alignRight = !!msg.own;
      const edge = (w) => clamp(alignRight ? left + br.width - w : left, SIDE, W - SIDE - w);

      spot.style.left = `${left}px`;
      spot.style.top = `${top}px`;
      bar.style.left = `${edge(barW)}px`;
      bar.style.top = `${top - GAP - barH}px`;
      menu.style.left = `${edge(menuW)}px`;
      menu.style.top = `${top + bubbleH + GAP}px`;
      bar.style.transformOrigin = `${alignRight ? 'right' : 'left'} bottom`;
      menu.style.transformOrigin = `${alignRight ? 'right' : 'left'} top`;

      hiddenBubble = bubble;
      bubble.style.visibility = 'hidden';
      requestAnimationFrame(() => {
        if (!overlay) return;
        overlay.classList.remove('measuring');
        overlay.classList.add('open');
      });

      escHandler = (e) => { if (e.key === 'Escape') close(); };
      document.addEventListener('keydown', escHandler);
    }

    function attach(root, cfg) {
      return bindLongPress(root, {
        selector: cfg.bubbleSelector,
        holdMs: cfg.holdMs || HOLD_MS,
        onLongPress: (bubble) => {
          const message = cfg.getMessage(bubble);
          if (message) open(Object.assign({}, cfg, { bubble, message }));
        }
      });
    }

    return { open, close, attach, isOpen: () => !!overlay, REACTIONS };
  })();

  /* =====================================================================
     3. ZeniMessages — aplikacja „Wiadomości” (przykład podłączenia)
     ===================================================================== */
  const ZeniMessages = (function () {
    const STORE_KEY = 'zenios.messages.v1';

    const seed = () => ([
      {
        id: 'zenios', title: 'ZeniOS System', accent: '#30d158', avatar: { text: 'Z', color: '#30d158' }, unread: 2,
        messages: [
          { id: 1, from: 'them', text: 'Witaj w nowej wersji pulpitu z widżetami.', time: '16:20' },
          { id: 2, from: 'them', text: 'Wskazówka: przytrzymaj rozmowę, aby zerknąć bez oznaczania jako przeczytane.', time: '16:21' }
        ]
      },
      {
        id: 'mama', title: 'Mama', accent: '#ff375f', avatar: { text: 'M', color: '#ff375f' }, unread: 1,
        messages: [
          { id: 1, from: 'them', text: 'Kupisz po drodze chleb?', time: '15:02' },
          { id: 2, from: 'me', text: 'Jasne, jakiś konkretny?', time: '15:03' },
          { id: 3, from: 'them', text: 'Ten razowy, z piekarni na rogu. Obiad o 18:00 😊', time: '15:05' }
        ]
      },
      {
        id: 'kuba', title: 'Kuba', accent: '#0a84ff', avatar: { text: 'K', color: '#0a84ff' }, unread: 3,
        messages: [
          { id: 1, from: 'me', text: 'Siema, grasz dzisiaj wieczorem?', time: '12:10' },
          { id: 2, from: 'them', text: 'Pewnie, po 19 będę wolny.', time: '12:14' },
          { id: 3, from: 'me', text: 'Super. Możemy dokończyć ten projekt w ZeniOS?', time: '12:15' },
          { id: 4, from: 'them', text: 'Tak, mam już pomysł na tryb ciemny dla Kalendarza.', time: '12:18' },
          { id: 5, from: 'me', text: 'Mega. A widżety? Poprawiłem szkło, wygląda jak dock.', time: '12:20' },
          { id: 6, from: 'them', text: 'Widziałem screeny, naprawdę czysto to wygląda.', time: '12:22' },
          { id: 7, from: 'me', text: 'Dzięki! Jeszcze baterię przerabiam na styl iOS.', time: '12:23' },
          { id: 8, from: 'them', text: 'Z liczbą w środku? Ciekawe.', time: '12:25' },
          { id: 9, from: 'them', text: 'Daj znać jak skończysz, to przetestuję na telefonie.', time: '12:26' },
          { id: 10, from: 'them', text: 'I weź ładowarkę 😄', time: '12:27' }
        ]
      },
      {
        id: 'ola', title: 'Ola', accent: '#bf5af2', avatar: { text: 'O', color: '#bf5af2' }, unread: 0,
        messages: [
          { id: 1, from: 'them', text: 'Zdjęcia znad morza już w galerii!', time: 'Wczoraj' },
          { id: 2, from: 'me', text: 'Widzę, świetne ujęcia 🌊', time: 'Wczoraj' }
        ]
      }
    ]);

    let state = load();
    let currentId = null;
    let replyTo = null;     // { id, text }
    let editing = null;     // id edytowanej wiadomości
    const $ = (id) => document.getElementById(id);

    function load() {
      try {
        const raw = localStorage.getItem(STORE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length) return parsed;
        }
      } catch (e) { /* brak localStorage — działamy w pamięci */ }
      return seed();
    }
    function save() {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignoruj */ }
    }

    const byId = (id) => state.find((c) => c.id === id);
    const lastOf = (c) => c.messages[c.messages.length - 1];

    /* ---- logika „przeczytane” — JEDYNE miejsce, które zmienia unread ---- */
    function markAsRead(id) {
      const c = byId(id);
      if (!c || !c.unread) return;
      c.unread = 0;
      save();
      renderList();
    }

    /* ----------------------------- lista rozmów ----------------------------- */
    function renderList() {
      const list = $('msg-conv-list');
      if (!list) return;
      list.textContent = '';
      state.forEach((c) => {
        const last = lastOf(c);
        const row = el('div', `msg-conv${c.unread ? ' unread' : ''}`);
        row.dataset.conv = c.id;
        row.setAttribute('role', 'button');
        row.tabIndex = 0;

        row.appendChild(el('span', 'msg-unread-dot'));
        const av = el('div', 'msg-avatar', c.avatar.text);
        av.style.background = c.avatar.color;
        const main = el('div', 'msg-conv-main');
        const top = el('div', 'msg-conv-top');
        top.append(el('span', 'msg-conv-name', c.title), el('span', 'msg-conv-time', last ? last.time : ''));
        main.append(top, el('div', 'msg-conv-prev', last ? (last.from === 'me' ? 'Ty: ' : '') + last.text : 'Brak wiadomości'));
        row.append(av, main);
        if (c.unread) row.appendChild(el('span', 'msg-unread-count', String(c.unread)));
        list.appendChild(row);
      });
    }

    const snapshot = (c) => ({
      id: c.id, title: c.title, accent: c.accent, avatar: c.avatar, unread: c.unread,
      messages: c.messages.map((m) => ({
        id: m.id, from: m.from, text: m.text, time: m.time,
        reactions: (m.reactions || []).slice(), edited: !!m.edited
      }))
    });

    /* ------------------------------ widok czatu ------------------------------ */
    function openChat(id) {
      const c = byId(id);
      if (!c) return;
      currentId = id;
      cancelComposerMode();
      $('msg-chat-screen').style.setProperty('--chat-accent', c.accent);
      const av = $('msg-chat-avatar');
      av.textContent = c.avatar.text; av.style.background = c.avatar.color;
      $('msg-chat-name').textContent = c.title;
      $('msg-list-screen').classList.remove('active');
      $('msg-chat-screen').classList.add('active');
      renderThread(true);   // po pokazaniu ekranu, inaczej scrollHeight = 0 i czat nie przewija się na dół
    }

    function closeChat() {
      ZeniMessageMenu.close(true);
      currentId = null;
      cancelComposerMode();
      $('msg-chat-screen').classList.remove('active');
      $('msg-list-screen').classList.add('active');
      renderList();
    }

    function renderThread(scrollToEnd) {
      const c = byId(currentId);
      const thread = $('msg-thread');
      if (!c || !thread) return;
      const prevScroll = thread.scrollTop;
      thread.textContent = '';
      c.messages.forEach((m) => {
        const row = el('div', `msg-row ${m.from === 'me' ? 'me' : 'them'}`);
        const b = el('div', 'msg-bubble');
        b.dataset.mid = m.id;
        if (m.replyTo) {
          const q = el('div', 'msg-quote', m.replyTo.text);
          b.appendChild(q);
        }
        b.appendChild(el('span', 'msg-text', m.text));
        if (m.edited) b.appendChild(el('span', 'msg-edited', 'edytowano'));
        if (m.reactions && m.reactions.length) {
          const rs = el('span', 'msg-reacts');
          m.reactions.forEach((id) => {
            const r = reactionById(id);
            rs.appendChild(el('span', r && r.text ? 'txt' : '', r ? r.label : id));
          });
          b.appendChild(rs);
        }
        row.appendChild(b);
        thread.appendChild(row);
      });
      thread.scrollTop = scrollToEnd ? thread.scrollHeight : prevScroll;
    }

    /* --------------------------- pole wpisywania --------------------------- */
    function showBanner(title, text) {
      $('msg-banner-title').textContent = title;
      $('msg-banner-text').textContent = text;
      $('msg-banner').hidden = false;
    }
    function cancelComposerMode() {
      replyTo = null; editing = null;
      const b = $('msg-banner');
      if (b) b.hidden = true;
      const inp = $('msg-input');
      if (inp) inp.value = '';
    }
    function nowTime() {
      const d = new Date();
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
    function send() {
      const c = byId(currentId);
      const inp = $('msg-input');
      const text = inp.value.trim();
      if (!c || !text) return;
      if (editing != null) {
        const m = c.messages.find((x) => x.id === editing);
        if (m) { m.text = text; m.edited = true; }
      } else {
        const id = c.messages.reduce((mx, x) => Math.max(mx, x.id), 0) + 1;
        const msg = { id, from: 'me', text, time: nowTime(), reactions: [] };
        if (replyTo) msg.replyTo = { id: replyTo.id, text: replyTo.text };
        c.messages.push(msg);
      }
      cancelComposerMode();
      save();
      renderThread(true);
    }

    /* ---------------- callbacki menu wiadomości (podłączone do stanu) ---------------- */
    const msgOf = (m) => { const c = byId(currentId); return c && c.messages.find((x) => x.id === m.id); };
    const menuHandlers = {
      onReact(reactionId, m) {
        const real = msgOf(m); if (!real) return;
        real.reactions = real.reactions || [];
        const i = real.reactions.indexOf(reactionId);
        if (i >= 0) real.reactions.splice(i, 1); else real.reactions.push(reactionId);   // przypnij / odepnij
        save(); renderThread(false);
      },
      onReply(m) {
        replyTo = { id: m.id, text: m.text };
        editing = null;
        showBanner('Odpowiedź', m.text);
        $('msg-input').focus();
      },
      onUnsend(m) {
        const c = byId(currentId); if (!c) return;
        c.messages = c.messages.filter((x) => x.id !== m.id);
        save(); renderThread(false); renderList();
        toast('Cofnięto wysłanie');
      },
      onEdit(m) {
        editing = m.id; replyTo = null;
        showBanner('Edycja wiadomości', m.text);
        const inp = $('msg-input'); inp.value = m.text; inp.focus();
      },
      onCopy() { /* kopiowanie wykonuje moduł; tu można dodać własną logikę */ },
      onTranslate() { toast('Tłumaczenie wymaga usługi online (demo)'); },
      onMore() { toast('Więcej opcji — wkrótce'); }
    };

    /* --------------------------------- init --------------------------------- */
    function init() {
      const list = $('msg-conv-list');
      if (!list) return;
      renderList();

      // 1) ZeniPeek: przytrzymanie = podgląd (bez zmian unread), klik = pełny czat + przeczytane
      ZeniPeek.attach(list, {
        itemSelector: '.msg-conv',
        getConversation: (item) => snapshot(byId(item.dataset.conv)),
        onOpenFullChat: (conv) => openChat(conv.id),
        onMarkAsRead: (conv) => markAsRead(conv.id)
      });

      // 2) ZeniMessageMenu: przytrzymanie dymka = reakcje + akcje
      ZeniMessageMenu.attach($('msg-thread'), Object.assign({
        bubbleSelector: '.msg-bubble',
        getMessage: (bubble) => {
          const c = byId(currentId);
          const m = c && c.messages.find((x) => x.id === Number(bubble.dataset.mid));
          return m ? { id: m.id, text: m.text, own: m.from === 'me', reactions: (m.reactions || []).slice() } : null;
        },
        actions: ['reply', 'unsend', 'edit', 'copy', 'translate', 'more']
      }, menuHandlers));

      $('msg-back-btn').addEventListener('click', closeChat);
      $('msg-send').addEventListener('click', send);
      $('msg-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } });
      $('msg-banner-close').addEventListener('click', cancelComposerMode);
      $('msg-reset-btn').addEventListener('click', () => {
        state = seed(); save(); renderList(); toast('Przywrócono dane demo');
      });

      // zamknij nakładki, gdy aplikacja zostanie zamknięta
      const app = $('app-messages');
      if (app && 'MutationObserver' in window) {
        new MutationObserver(() => {
          if (!app.classList.contains('open')) { ZeniPeek.close('app-closed'); ZeniMessageMenu.close(true); }
        }).observe(app, { attributes: true, attributeFilter: ['class'] });
      }
    }

    return { init, markAsRead, openChat };
  })();

  /* --------------------------- eksport / start --------------------------- */
  window.ZeniPeek = ZeniPeek;
  window.ZeniMessageMenu = ZeniMessageMenu;
  window.ZeniMessages = ZeniMessages;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ZeniMessages.init);
  else ZeniMessages.init();
})();
