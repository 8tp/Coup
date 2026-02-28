'use client';

import { useState } from 'react';
import { Character } from '@/shared/types';
import { CHARACTER_DESCRIPTIONS } from '@/shared/constants';
import { CHARACTER_SVG_ICONS } from '../icons';
import { Modal } from '../ui/Modal';

const tabs = ['Overview', 'Characters', 'Actions & Rules'] as const;
type Tab = typeof tabs[number];

const characterThemes: Record<Character, { bg: string; border: string; label: string }> = {
  [Character.Duke]: { bg: 'bg-purple-900/30', border: 'border-purple-500', label: 'text-purple-300' },
  [Character.Assassin]: { bg: 'bg-gray-800/30', border: 'border-gray-500', label: 'text-gray-300' },
  [Character.Captain]: { bg: 'bg-blue-900/30', border: 'border-blue-500', label: 'text-blue-300' },
  [Character.Ambassador]: { bg: 'bg-green-900/30', border: 'border-green-500', label: 'text-green-300' },
  [Character.Contessa]: { bg: 'bg-red-900/30', border: 'border-red-500', label: 'text-red-300' },
};

interface HowToPlayProps {
  open: boolean;
  onClose: () => void;
}

export function HowToPlay({ open, onClose }: HowToPlayProps) {
  const [activeTab, setActiveTab] = useState<Tab>('Overview');

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-2xl" scrollable>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">How to Play</h2>
        <button
          className="text-gray-500 hover:text-white text-2xl leading-none px-1"
          onClick={onClose}
        >
          &times;
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {tabs.map(tab => (
          <button
            key={tab}
            className="how-to-play-tab"
            data-active={activeTab === tab ? 'true' : 'false'}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'Overview' && <OverviewTab />}
      {activeTab === 'Characters' && <CharactersTab />}
      {activeTab === 'Actions & Rules' && <RulesTab />}
    </Modal>
  );
}

function OverviewTab() {
  return (
    <div className="space-y-4 text-sm text-gray-300">
      <div>
        <h3 className="text-coup-accent font-bold text-base mb-2">What is Coup?</h3>
        <p>
          Coup is a game of bluffing, deduction, and deception for 2-6 players.
          Each player starts with 2 influence cards (face-down) and 2 coins.
          The last player with influence remaining wins.
        </p>
      </div>
      <div>
        <h3 className="text-coup-accent font-bold text-base mb-2">Goal</h3>
        <p>
          Eliminate all other players&apos; influence cards. You lose an influence when
          it&apos;s revealed (turned face-up). Lose both and you&apos;re out.
        </p>
      </div>
      <div>
        <h3 className="text-coup-accent font-bold text-base mb-2">Basic Flow</h3>
        <ol className="list-decimal list-inside space-y-1.5">
          <li>On your turn, choose one action (some claim a character role).</li>
          <li>Other players can <span className="text-white font-medium">challenge</span> your claim &mdash; if you were bluffing, you lose an influence. If you were truthful, the challenger loses one.</li>
          <li>Some actions can be <span className="text-white font-medium">blocked</span> by claiming a specific character. The original actor can then challenge the block.</li>
          <li>If no one challenges or blocks, the action resolves.</li>
        </ol>
      </div>
      <div>
        <h3 className="text-coup-accent font-bold text-base mb-2">Key Insight</h3>
        <p className="text-gray-400 italic">
          You can claim ANY character action regardless of what cards you actually hold.
          Bluffing is not just allowed &mdash; it&apos;s essential!
        </p>
      </div>
    </div>
  );
}

function CharactersTab() {
  const characters = Object.values(Character);

  return (
    <div className="grid gap-3">
      {characters.map(char => {
        const Icon = CHARACTER_SVG_ICONS[char];
        const theme = characterThemes[char];
        return (
          <div
            key={char}
            className={`flex items-center gap-3 p-3 rounded-lg border ${theme.bg} ${theme.border}`}
          >
            <div className="shrink-0">
              <Icon size={36} />
            </div>
            <div>
              <div className={`font-bold ${theme.label}`}>{char}</div>
              <div className="text-sm text-gray-400">{CHARACTER_DESCRIPTIONS[char]}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RulesTab() {
  return (
    <div className="space-y-5 text-sm">
      {/* Actions table */}
      <div>
        <h3 className="text-coup-accent font-bold text-base mb-3">Actions</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-gray-300">
            <thead>
              <tr className="border-b border-gray-700 text-xs text-gray-500 uppercase">
                <th className="py-2 pr-3">Action</th>
                <th className="py-2 pr-3">Cost</th>
                <th className="py-2 pr-3">Effect</th>
                <th className="py-2 pr-3">Claims</th>
                <th className="py-2">Blocked By</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-3 font-medium text-white">Income</td>
                <td className="py-2 pr-3">0</td>
                <td className="py-2 pr-3">+1 coin</td>
                <td className="py-2 pr-3 text-gray-500">&mdash;</td>
                <td className="py-2 text-gray-500">&mdash;</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-3 font-medium text-white">Foreign Aid</td>
                <td className="py-2 pr-3">0</td>
                <td className="py-2 pr-3">+2 coins</td>
                <td className="py-2 pr-3 text-gray-500">&mdash;</td>
                <td className="py-2 text-purple-300">Duke</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-3 font-medium text-white">Coup</td>
                <td className="py-2 pr-3">7</td>
                <td className="py-2 pr-3">Target loses influence</td>
                <td className="py-2 pr-3 text-gray-500">&mdash;</td>
                <td className="py-2 text-gray-500">&mdash;</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-3 font-medium text-purple-300">Tax</td>
                <td className="py-2 pr-3">0</td>
                <td className="py-2 pr-3">+3 coins</td>
                <td className="py-2 pr-3 text-purple-300">Duke</td>
                <td className="py-2 text-gray-500">&mdash;</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-3 font-medium text-gray-300">Assassinate</td>
                <td className="py-2 pr-3">3</td>
                <td className="py-2 pr-3">Target loses influence</td>
                <td className="py-2 pr-3 text-gray-300">Assassin</td>
                <td className="py-2 text-red-300">Contessa</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-3 font-medium text-blue-300">Steal</td>
                <td className="py-2 pr-3">0</td>
                <td className="py-2 pr-3">Take 2 coins from target</td>
                <td className="py-2 pr-3 text-blue-300">Captain</td>
                <td className="py-2"><span className="text-blue-300">Captain</span>, <span className="text-green-300">Ambassador</span></td>
              </tr>
              <tr>
                <td className="py-2 pr-3 font-medium text-green-300">Exchange</td>
                <td className="py-2 pr-3">0</td>
                <td className="py-2 pr-3">Draw 2, keep what you want</td>
                <td className="py-2 pr-3 text-green-300">Ambassador</td>
                <td className="py-2 text-gray-500">&mdash;</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Challenging */}
      <div>
        <h3 className="text-coup-accent font-bold text-base mb-2">Challenging</h3>
        <p className="text-gray-400">
          When a player claims a character to perform an action or block, any other player
          can challenge. If the claimed player <span className="text-white">actually has</span> the
          card, the challenger loses an influence and the claimer swaps their revealed card
          for a new one. If the claimer was <span className="text-white">bluffing</span>,
          they lose an influence instead.
        </p>
      </div>

      {/* Blocking */}
      <div>
        <h3 className="text-coup-accent font-bold text-base mb-2">Blocking</h3>
        <p className="text-gray-400">
          Some actions can be blocked by claiming a counter-character. Blocking is itself
          a claim and can be challenged. You don&apos;t need to actually hold the character
          you claim &mdash; you can bluff a block!
        </p>
      </div>

      {/* Forced Coup */}
      <div>
        <h3 className="text-coup-accent font-bold text-base mb-2">Forced Coup</h3>
        <p className="text-gray-400">
          If you have <span className="text-white font-medium">10 or more coins</span> at the
          start of your turn, you <span className="text-white font-medium">must</span> Coup.
          No other action is allowed.
        </p>
      </div>
    </div>
  );
}
