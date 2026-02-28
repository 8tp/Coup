'use client';

interface ModalProps {
  open: boolean;
  onClose?: () => void;
  title?: string;
  children: React.ReactNode;
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />
      <div className="relative bg-coup-surface border border-gray-700 rounded-2xl p-6 w-full max-w-md animate-slide-up">
        {title && (
          <h2 className="text-xl font-bold mb-4">{title}</h2>
        )}
        {children}
      </div>
    </div>
  );
}
