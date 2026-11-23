/* Ekran blokady ZeniOS: obsługa tapety, zegara, gestu przeciągnięcia w górę
 * oraz metod odblokowania: Przeciągnięcie, PIN, Hasło i Wzór. */

(function () {
  const lockLayer = document.getElementById('lockscreen-layer');
  const wallpaperLayer = document.getElementById('wallpaper-layer');
  const lockWallpaper = document.getElementById('lock-wallpaper');
  const lockDate = document.getElementById('lock-date');
  const lockClock = document.getElementById('lock-clock');
  const lockHintText = document.getElementById('lock-hint-text');
  const lockSwipeBtn = document.getElementById('lock-swipe-btn');
  const lockTorchBtn = document.getElementById('lock-torch-btn');
  const lockCameraBtn = document.getElementById('lock-camera-btn');

  const pinPanel = document.getElementById('unlock-pin-panel');
  const pinDots = document.getElementById('pin-dots');
  const pinError = document.getElementById('pin-error');
  const pinKeypad = document.getElementById('pin-keypad');
  const pinClearBtn = document.getElementById('pin-clear-btn');
  const pinCancelBtn = document.getElementById('pin-cancel-btn');

  const passwordPanel = document.getElementById('unlock-password-panel');
  const passwordInput = document.getElementById('lock-password-input');
  const passwordError = document.getElementById('password-error');
  const passwordCancelBtn = document.getElementById('password-cancel-btn');
  const passwordSubmitBtn = document.getElementById('password-submit-btn');

  const patternPanel = document.getElementById('unlock-pattern-panel');
  const patternGrid = document.getElementById('pattern-grid');
  const patternError = document.getElementById('pattern-error');
  const patternResetBtn = document.getElementById('pattern-reset-btn');
  const patternCancelBtn = document.getElementById('pattern-cancel-btn');

  if (!lockLayer) return;

  let currentPin = '';
  let currentPattern = [];
  let isDrawingPattern = false;
  let dragStartY = null;
  let dragDeltaY = 0;

  const DAYS_PL = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
  const MONTHS_PL = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'];

  function updateClockAndDate() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    if (lockClock) lockClock.textContent = `${hh}:${mm}`;
    if (lockDate) {
      lockDate.textContent = `${DAYS_PL[now.getDay()]}, ${now.getDate()} ${MONTHS_PL[now.getMonth()]}`;
    }
  }

  function getSettings() {
    if (window.ZeniSystem && typeof window.ZeniSystem.getLockSettings === 'function') {
      return window.ZeniSystem.getLockSettings();
    }
    return {
      method: 'swipe',
      pin: '1234',
      password: 'zenios',
      pattern: '1-2-5-8-9',
      wallpaper: 'Default_Wallpaper/default_wallpaper_7.jpg'
    };
  }

  function hideAllPanels() {
    if (pinPanel) pinPanel.classList.remove('active');
    if (passwordPanel) passwordPanel.classList.remove('active');
    if (patternPanel) patternPanel.classList.remove('active');
    lockLayer.classList.remove('unlock-mode');
    if (pinError) pinError.textContent = '';
    if (passwordError) passwordError.textContent = '';
    if (patternError) patternError.textContent = '';
  }

  function resetPinInput() {
    currentPin = '';
    if (!pinDots) return;
    [...pinDots.children].forEach((dot) => dot.classList.remove('filled'));
  }

  function resetPatternInput() {
    currentPattern = [];
    if (!patternGrid) return;
    patternGrid.querySelectorAll('.pattern-node').forEach((n) => n.classList.remove('active'));
  }

  function refresh() {
    updateClockAndDate();
    const cfg = getSettings();
    const wp = (window.ZeniSystem && typeof window.ZeniSystem.getLockWallpaper === 'function')
      ? window.ZeniSystem.getLockWallpaper()
      : (cfg.wallpaper || 'Default_Wallpaper/default_wallpaper_7.jpg');
    if (lockWallpaper && wp) {
      lockWallpaper.src = wp;
    }

    hideAllPanels();
    resetPinInput();
    resetPatternInput();
    if (passwordInput) passwordInput.value = '';

    if (lockHintText) {
      if (cfg.method === 'pin') {
        lockHintText.textContent = 'Przeciągnij w górę, aby wpisać PIN';
      } else if (cfg.method === 'password') {
        lockHintText.textContent = 'Przeciągnij w górę, aby wpisać hasło';
      } else if (cfg.method === 'pattern') {
        lockHintText.textContent = 'Przeciągnij w górę, aby narysować wzór';
      } else {
        lockHintText.textContent = 'Przeciągnij w górę, aby odblokować';
      }
    }

    lockLayer.style.transform = '';
    lockLayer.style.opacity = '';
  }

  function unlockDevice() {
    hideAllPanels();
    lockLayer.classList.add('unlocking');
    if (wallpaperLayer) {
      wallpaperLayer.classList.add('active');
      wallpaperLayer.classList.add('unlocked');
    }
    if (window.ZeniSystem && typeof window.ZeniSystem.onUnlocked === 'function') {
      window.ZeniSystem.onUnlocked();
    }
    window.setTimeout(() => {
      lockLayer.classList.remove('active');
      lockLayer.classList.remove('unlocking');
      lockLayer.style.transform = '';
      lockLayer.style.opacity = '';
    }, 340);
  }

  function openUnlockChallenge() {
    const cfg = getSettings();
    if (cfg.method === 'swipe') {
      unlockDevice();
      return;
    }

    hideAllPanels();
    lockLayer.classList.add('unlock-mode');
    lockLayer.style.transform = '';
    lockLayer.style.opacity = '';

    if (cfg.method === 'pin' && pinPanel) {
      resetPinInput();
      pinPanel.classList.add('active');
    } else if (cfg.method === 'password' && passwordPanel) {
      if (passwordInput) {
        passwordInput.value = '';
        window.setTimeout(() => passwordInput.focus(), 60);
      }
      passwordPanel.classList.add('active');
    } else if (cfg.method === 'pattern' && patternPanel) {
      resetPatternInput();
      patternPanel.classList.add('active');
    } else {
      unlockDevice();
    }
  }

  function handlePinDigit(digit) {
    const cfg = getSettings();
    if (currentPin.length >= 4) return;
    currentPin += digit;
    if (pinError) pinError.textContent = '';
    if (pinDots) {
      [...pinDots.children].forEach((dot, idx) => {
        dot.classList.toggle('filled', idx < currentPin.length);
      });
    }

    if (currentPin.length === 4) {
      const expectedPin = String(cfg.pin || '1234').trim();
      if (currentPin === expectedPin) {
        window.setTimeout(unlockDevice, 120);
      } else {
        if (pinError) pinError.textContent = 'Nieprawidłowy kod PIN';
        if (pinDots) {
          pinDots.classList.add('shake');
          window.setTimeout(() => {
            pinDots.classList.remove('shake');
            resetPinInput();
          }, 360);
        } else {
          resetPinInput();
        }
      }
    }
  }

  if (pinKeypad) {
    pinKeypad.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-pin]');
      if (!btn) return;
      handlePinDigit(btn.dataset.pin);
    });
  }

  if (pinClearBtn) {
    pinClearBtn.addEventListener('click', () => {
      resetPinInput();
      if (pinError) pinError.textContent = '';
    });
  }

  if (pinCancelBtn) {
    pinCancelBtn.addEventListener('click', () => {
      resetPinInput();
      hideAllPanels();
    });
  }

  function submitPassword() {
    const cfg = getSettings();
    const entered = passwordInput ? passwordInput.value : '';
    const expected = String(cfg.password || 'zenios');
    if (entered === expected) {
      unlockDevice();
    } else {
      if (passwordError) passwordError.textContent = 'Nieprawidłowe hasło';
      if (passwordInput) {
        passwordInput.classList.add('shake');
        window.setTimeout(() => passwordInput.classList.remove('shake'), 360);
      }
    }
  }

  if (passwordSubmitBtn) {
    passwordSubmitBtn.addEventListener('click', submitPassword);
  }

  if (passwordInput) {
    passwordInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitPassword();
    });
  }

  if (passwordCancelBtn) {
    passwordCancelBtn.addEventListener('click', () => {
      if (passwordInput) passwordInput.value = '';
      hideAllPanels();
    });
  }

  function addPatternNode(nodeEl) {
    if (!nodeEl) return;
    const val = nodeEl.dataset.node;
    if (!val || currentPattern.includes(val)) return;
    currentPattern.push(val);
    nodeEl.classList.add('active');
  }

  function finishPattern() {
    if (!isDrawingPattern) return;
    isDrawingPattern = false;
    if (!currentPattern.length) return;

    const cfg = getSettings();
    const expectedSeq = String(cfg.pattern || '1-2-5-8-9')
      .split(/[^0-9]+/)
      .filter(Boolean)
      .join('-');
    const actualSeq = currentPattern.join('-');

    if (actualSeq === expectedSeq) {
      window.setTimeout(unlockDevice, 140);
    } else {
      if (patternError) patternError.textContent = 'Nieprawidłowy wzór';
      if (patternGrid) {
        patternGrid.classList.add('shake');
        window.setTimeout(() => {
          patternGrid.classList.remove('shake');
          resetPatternInput();
        }, 420);
      } else {
        resetPatternInput();
      }
    }
  }

  if (patternGrid) {
    patternGrid.addEventListener('pointerdown', (e) => {
      const node = e.target.closest('.pattern-node');
      if (!node) return;
      e.preventDefault();
      isDrawingPattern = true;
      if (patternError) patternError.textContent = '';
      resetPatternInput();
      addPatternNode(node);
    });

    window.addEventListener('pointermove', (e) => {
      if (!isDrawingPattern) return;
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const node = target ? target.closest('.pattern-node') : null;
      if (node && patternGrid.contains(node)) {
        addPatternNode(node);
      }
    });

    window.addEventListener('pointerup', finishPattern);
    window.addEventListener('pointercancel', finishPattern);
  }

  if (patternResetBtn) {
    patternResetBtn.addEventListener('click', () => {
      resetPatternInput();
      if (patternError) patternError.textContent = '';
    });
  }

  if (patternCancelBtn) {
    patternCancelBtn.addEventListener('click', () => {
      resetPatternInput();
      hideAllPanels();
    });
  }

  // Przeciągnięcie w górę po ekranie blokady
  lockLayer.addEventListener('pointerdown', (e) => {
    if (!lockLayer.classList.contains('active')) return;
    if (lockLayer.classList.contains('unlock-mode')) return;
    if (e.target.closest('button')) return;
    dragStartY = e.clientY;
    dragDeltaY = 0;
  });

  lockLayer.addEventListener('pointermove', (e) => {
    if (dragStartY === null) return;
    const dy = e.clientY - dragStartY;
    if (dy < 0) {
      dragDeltaY = dy;
      const clamped = Math.max(dy, -220);
      const progress = Math.min(Math.abs(clamped) / 140, 1);
      lockLayer.style.transform = `translateY(${clamped * 0.45}px)`;
      lockLayer.style.opacity = String(1 - progress * 0.25);
    }
  });

  function endSwipeGesture() {
    if (dragStartY === null) return;
    const shouldUnlock = dragDeltaY < -65;
    dragStartY = null;
    dragDeltaY = 0;

    if (shouldUnlock) {
      openUnlockChallenge();
    } else {
      lockLayer.style.transform = '';
      lockLayer.style.opacity = '';
    }
  }

  lockLayer.addEventListener('pointerup', endSwipeGesture);
  lockLayer.addEventListener('pointercancel', endSwipeGesture);

  if (lockSwipeBtn) {
    lockSwipeBtn.addEventListener('click', openUnlockChallenge);
  }

  if (lockTorchBtn) {
    lockTorchBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      lockTorchBtn.classList.toggle('active');
      if (window.ZeniSystem && typeof window.ZeniSystem.toggleTorch === 'function') {
        window.ZeniSystem.toggleTorch(lockTorchBtn.classList.contains('active'));
      }
    });
  }

  if (lockCameraBtn) {
    lockCameraBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      unlockDevice();
      if (window.ZeniSystem && typeof window.ZeniSystem.openApp === 'function') {
        window.ZeniSystem.openApp('app-gallery');
      }
    });
  }

  updateClockAndDate();
  window.setInterval(updateClockAndDate, 15000);

  window.ZeniLockscreen = {
    refresh,
    lockNow: function () {
      if (wallpaperLayer) {
        wallpaperLayer.classList.remove('unlocked');
      }
      refresh();
      lockLayer.classList.add('active');
    }
  };
})();
