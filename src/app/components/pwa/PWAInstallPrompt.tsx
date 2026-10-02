'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISS_KEY = 'coup_pwa_install_dismissed';

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function PWAInstallPrompt() {
  const pathname = usePathname();
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === 'true' || isStandalone());

    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Asset caching is a progressive enhancement.
      });
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setDismissed(localStorage.getItem(DISMISS_KEY) === 'true' || isStandalone());
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  }, []);

  if (!installEvent || dismissed) return null;
  if (pathname.startsWith('/game/') || pathname.startsWith('/lobby/')) return null;

  const install = async () => {
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    setInstallEvent(null);
    if (choice.outcome === 'dismissed') {
      localStorage.setItem(DISMISS_KEY, 'true');
      setDismissed(true);
    }
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, 'true');
    setDismissed(true);
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-[55] mx-auto max-w-md panel-sunk bg-coup-surface/95 p-3 backdrop-blur">
      <div className="flex items-center gap-3">
        <img src="/icons/icon-192-v2.png" alt="" className="h-10 w-10 rounded-lg" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-gray-100">Install Coup</p>
          <p className="text-xs text-gray-400">Faster launch and cached game assets on spotty Wi-Fi.</p>
        </div>
        <button
          type="button"
          className="rounded-lg bg-coup-accent px-3 py-2 text-xs font-bold text-coup-bg"
          onClick={install}
        >
          Install
        </button>
        <button
          type="button"
          className="rounded-lg border border-coup-line px-2.5 py-2 text-xs font-bold text-gray-400"
          onClick={dismiss}
          aria-label="Dismiss install prompt"
        >
          &times;
        </button>
      </div>
    </div>
  );
}
