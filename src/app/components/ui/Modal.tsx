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

export function Modal({ open, onClose, title, maxWidth = 'max-w-md', scrollable, children }: ModalProps) {
  const titleId = useId();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />
      <div
        className={`relative bg-coup-surface panel-sunk p-6 w-full ${maxWidth} animate-slide-up ${scrollable ? 'max-h-[85vh] overflow-y-auto' : ''}`}
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
