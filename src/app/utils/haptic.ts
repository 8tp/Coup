const supportsHaptic =
  typeof window === 'undefined'
    ? false
    : window.matchMedia('(pointer: coarse)').matches;

function _haptic() {
  try {
    if (navigator.vibrate) {
      navigator.vibrate(50);
      return;
    }

    if (!supportsHaptic) return;

    const labelEl = document.createElement('label');
    labelEl.ariaHidden = 'true';
    labelEl.style.display = 'none';

    const inputEl = document.createElement('input');
    inputEl.type = 'checkbox';
    inputEl.setAttribute('switch', '');
    labelEl.appendChild(inputEl);

    document.head.appendChild(labelEl);
    labelEl.click();
    document.head.removeChild(labelEl);
  } catch {
    // do nothing
  }
}

export function haptic(pattern?: number | number[]): void {
  if (pattern && navigator.vibrate) {
    navigator.vibrate(pattern);
    return;
  }

  _haptic();
}

export function hapticHeavy(): void {
  if (navigator.vibrate) {
    navigator.vibrate([50, 70, 50]);
    return;
  }

  _haptic();
  setTimeout(() => _haptic(), 120);
}
