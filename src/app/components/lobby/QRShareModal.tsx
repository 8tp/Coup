'use client';

import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Modal } from '../ui/Modal';
import { haptic } from '../../utils/haptic';

interface QRShareModalProps {
  open: boolean;
  onClose: () => void;
  roomCode: string;
}

export function QRShareModal({ open, onClose, roomCode }: QRShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [url, setUrl] = useState(`https://coup.chuds.dev/lobby/${roomCode}`);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setUrl(`${window.location.origin}/lobby/${roomCode}`);
    }
  }, [roomCode]);

  const handleCopyLink = () => {
    haptic();
    setCopied(true);
    setCopyError(false);
    setTimeout(() => setCopied(false), 2000);

    if (!navigator.clipboard?.writeText) {
      setCopyError(true);
      setCopied(false);
      setTimeout(() => setCopyError(false), 2000);
      return;
    }

    navigator.clipboard.writeText(url).catch(() => {
      setCopyError(true);
      setCopied(false);
      setTimeout(() => setCopyError(false), 2000);
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Share Room">
      <div className="flex flex-col items-center space-y-4">
        {/* QR Code */}
        <div className="bg-white rounded-xl p-4">
          <QRCodeSVG value={url} size={200} />
        </div>

        {/* Link */}
        <p className="text-gray-400 text-sm text-center break-all">{url}</p>
        <p className="min-h-4 text-xs text-center" aria-live="polite">
          {copied && <span className="text-green-400">Invite link copied</span>}
          {copyError && <span className="text-red-300">Copy failed - select the link above</span>}
        </p>

        {/* Copy Link Button */}
        <button
          type="button"
          onClick={handleCopyLink}
          className="btn-primary w-full"
        >
          {copied ? 'Copied!' : 'Copy Link'}
        </button>

        {/* Close */}
        <button
          type="button"
          onClick={() => { haptic(); onClose(); }}
          className="btn-secondary w-full"
        >
          Close
        </button>
      </div>
    </Modal>
  );
}
