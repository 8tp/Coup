'use client';

import { useCallback, useEffect, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(el =>
    !el.closest('[inert]') && el.getClientRects().length > 0,
  );
}

/**
 * Keyboard focus for a modal screen that cannot be dismissed.
 *
 * On open it moves focus to `initial` (the heading, so a screen reader reads
 * the result and a key held from the chat box lands on nothing that acts).
 * While open, Tab and Shift+Tab cycle through what is focusable inside
 * `root` and skip anything under an `inert` subtree, which is how a nested
 * dialog takes the trap over: the caller marks the rest of the screen inert.
 */
export function useDialogFocus(
  open: boolean,
  root: RefObject<HTMLElement | null>,
  initial: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return;
    initial.current?.focus({ preventScroll: true });
  }, [open, initial]);

  return useCallback((event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Tab' || !root.current) return;
    const items = focusables(root.current);
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement as HTMLElement | null;
    const inside = !!active && items.includes(active);
    if (event.shiftKey && (!inside || active === first)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (!inside || active === last)) {
      event.preventDefault();
      first.focus();
    }
  }, [root]);
}
