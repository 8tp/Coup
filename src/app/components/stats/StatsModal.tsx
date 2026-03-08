'use client';

import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { haptic } from '../../utils/haptic';
import { useStatsStore } from '../../stores/statsStore';
import { OverviewTab } from './OverviewTab';
import { AwardsTab } from './AwardsTab';
import { HistoryTab } from './HistoryTab';

const tabs = ['Overview', 'Awards', 'History'] as const;
type Tab = typeof tabs[number];

interface StatsModalProps {
  open: boolean;
  onClose: () => void;
}

export function StatsModal({ open, onClose }: StatsModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [confirmReset, setConfirmReset] = useState(false);
  const { stats, loaded, loadStats, resetStats } = useStatsStore();

  useEffect(() => {
    if (open && !loaded) {
      loadStats();
    }
  }, [open, loaded, loadStats]);

  // Reset confirm state when modal closes
  useEffect(() => {
    if (!open) setConfirmReset(false);
  }, [open]);

  const handleReset = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    resetStats();
    setConfirmReset(false);
  };

  const lifetime = stats?.lifetime;
  const history = stats?.history ?? [];
  const awardCounts = lifetime?.awardCounts ?? {};

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-md" scrollable>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">My Stats</h2>
        <button
          className="text-gray-500 hover:text-white text-2xl leading-none px-1"
          onClick={() => { haptic(); onClose(); }}
        >
          &times;
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {tabs.map(tab => (
          <button
            key={tab}
            className="how-to-play-tab"
            data-active={activeTab === tab ? 'true' : 'false'}
            onClick={() => { haptic(); setActiveTab(tab); }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'Overview' && lifetime && lifetime.gamesPlayed > 0 && <OverviewTab lifetime={lifetime} />}
      {activeTab === 'Overview' && (!lifetime || lifetime.gamesPlayed === 0) && (
        <div className="text-center py-8">
          <p className="text-gray-400 text-sm mb-1">No games played yet.</p>
          <p className="text-gray-600 text-xs">Play a game to start tracking your stats!</p>
        </div>
      )}
      {activeTab === 'Awards' && <AwardsTab awardCounts={awardCounts} />}
      {activeTab === 'History' && <HistoryTab history={history} />}

      {/* Reset - only show when there are stats to reset */}
      {lifetime && lifetime.gamesPlayed > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-800">
          {confirmReset ? (
            <div className="flex items-center gap-2">
              <p className="text-xs text-red-400 flex-1">Are you sure? This cannot be undone.</p>
              <button
                className="text-xs text-red-400 hover:text-red-300 font-medium px-2 py-1"
                onClick={handleReset}
              >
                Confirm
              </button>
              <button
                className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1"
                onClick={() => setConfirmReset(false)}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              className="text-xs text-gray-600 hover:text-red-400 transition-colors w-full text-center py-1"
              onClick={handleReset}
            >
              Reset Stats
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}
