const supportsHaptic =
  typeof window !== 'undefined' &&
  window.matchMedia('(pointer: coarse)').matches;

function hasVibrate(): boolean {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator;
}

let iosCheckbox: HTMLInputElement | null = null;

function iosHapticTrick(): void {
  if (!iosCheckbox) {
    iosCheckbox = document.createElement('input');
    iosCheckbox.type = 'checkbox';
    iosCheckbox.style.position = 'fixed';
    iosCheckbox.style.left = '-9999px';
    iosCheckbox.style.opacity = '0';
    document.body.appendChild(iosCheckbox);
  }
  iosCheckbox.checked = !iosCheckbox.checked;
  iosCheckbox.click();
}

export function haptic(pattern: number | number[] = 50): void {
  if (!supportsHaptic) return;

  if (hasVibrate()) {
    navigator.vibrate(pattern);
  } else {
    iosHapticTrick();
  }
}
