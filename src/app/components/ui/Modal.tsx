'use client';

import { useId } from 'react';

interface ModalProps {
  open: boolean;
  onClose?: () => void;
  title?: string;
  maxWidth?: string;
  scrollable?: boolean;
  children: React.ReactNode;
}

export function Modal({ open, onClose, title, maxWidth = 'max-w-md', children }: ModalProps) {
  const titleId = useId();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />
      <div
        /* Every dialog fits the viewport and scrolls inside itself: a dialog taller
           than a small phone used to push its own confirm button off-screen
           with nothing to scroll. (`scrollable` is now the default for every dialog.) */
        className={`relative bg-coup-surface panel-sunk p-4 sm:p-6 w-full ${maxWidth} animate-slide-up max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : 'Dialog'}
      >
        {title && (
          <h2 id={titleId} className="text-xl font-bold mb-4">{title}</h2>
        )}
        {children}
      </div>
    </div>
  );
}
