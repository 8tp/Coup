'use client';

import { useRef, useState, type RefObject } from 'react';
import { Character } from '@/shared/types';
import { CHARACTER_DESCRIPTIONS } from '@/shared/constants';
import { Modal } from '../ui/Modal';
import { haptic } from '../../utils/haptic';
import { CHARACTER_PALETTE, characterCardVars } from '../../utils/characterPalette';
import { CardArtwork, CharacterCardBadge } from '../game/CardArtwork';
import { ReformationTutorial } from '../tutorial/ReformationTutorial';

const tabs = ['Overview', 'Characters', 'Actions and rules', 'Reformation'] as const;
type Tab = typeof tabs[number];

interface HowToPlayProps {
  open: boolean;
  onClose: () => void;
}

export function HowToPlay({ open, onClose }: HowToPlayProps) {
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [showReformationTutorial, setShowReformationTutorial] = useState(false);
  const walkthroughTriggerRef = useRef<HTMLButtonElement>(null);

  const closeReformationTutorial = () => {
    setShowReformationTutorial(false);
    requestAnimationFrame(() => walkthroughTriggerRef.current?.focus());
  };

  return (
    <>
      <Modal open={open && !showReformationTutorial} onClose={onClose} maxWidth="max-w-2xl" scrollable>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">How to play</h2>
          <button
            className="court-icon-btn text-2xl leading-none"
            onClick={() => { haptic(); onClose(); }}
            aria-label="Close"
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
              onClick={() => { haptic(); setActiveTab(tab); }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'Overview' && <OverviewTab />}
        {activeTab === 'Characters' && <CharactersTab />}
        {activeTab === 'Actions and rules' && <RulesTab />}
        {activeTab === 'Reformation' && (
          <ReformationTab
            walkthroughTriggerRef={walkthroughTriggerRef}
            onOpenWalkthrough={() => setShowReformationTutorial(true)}
          />
        )}
      </Modal>
      <ReformationTutorial
        open={showReformationTutorial}
        onClose={closeReformationTutorial}
      />
    </>
  );
}

function OverviewTab() {
  return (
    <div className="space-y-4 text-sm text-gray-300">
      <div>
        <h3 className="text-coup-accent font-bold text-base mb-2">What is Coup?</h3>
        <p>
          Coup is a bluffing game for 2 to 6 players. Everyone starts with two face-down
          cards, called influence, and 2 coins. The last player with a face-down card wins.
        </p>
      </div>
      <div>
        <h3 className="text-coup-accent font-bold text-base mb-2">Goal</h3>
        <p>
          Make everyone else lose their influence. When you lose an influence, you turn
          one of your cards face-up. Lose both and you&apos;re out.
        </p>
      </div>
      <div>
        <h3 className="text-coup-accent font-bold text-base mb-2">Basic flow</h3>
        <ol className="list-decimal list-inside space-y-1.5">
          <li>On your turn, take one action. Some actions claim a character.</li>
          <li>Any other player can <span className="text-white font-medium">challenge</span> a claim. If you were bluffing, you lose an influence. If you weren&apos;t, the challenger loses one.</li>
          <li>Some actions can be <span className="text-white font-medium">blocked</span> by claiming the character that counters them. The player who acted can challenge the block.</li>
          <li>If nobody challenges or blocks, the action happens.</li>
        </ol>
      </div>
      <div>
        <h3 className="text-coup-accent font-bold text-base mb-2">Bluffing</h3>
        <p className="text-gray-400">
          You can claim any character, whatever you hold. A claim only costs you if
          someone challenges it and you were lying.
        </p>
      </div>
      <div className="border-t border-coup-line/70 pt-4 mt-2">
        <h3 className="text-coup-accent font-bold text-base mb-2">About the original game</h3>
        <p>
          Coup is a card game designed by <span className="text-white font-medium">Rikki Tahta</span>,
          originally published in 2012 by <span className="text-white font-medium">La Mame Games</span> and{' '}
          <span className="text-white font-medium">Indie Boards &amp; Cards</span>.
          This is a fan-made adaptation. If you enjoy it, please support the creators
          by{' '}
          <a
            href="https://www.amazon.com/Indie-Boards-and-Cards-COU1IBC/dp/B00GDI4HX4"
            target="_blank"
            rel="noopener noreferrer"
            className="text-coup-accent underline hover:text-white"
          >
            purchasing the physical game
          </a>.
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
        const theme = CHARACTER_PALETTE[char];
        return (
          <div
            key={char}
            className={`flex items-center gap-3 p-3 rounded border ${theme.tint} ${theme.edge}`}
          >
            {/* A real card frame, so the roster teaches the same band the
                table uses (ART-DIRECTION §1.2). */}
            <div className="card-face h-14 w-10 shrink-0" style={characterCardVars(char)}>
              <CardArtwork character={char} variant="focus" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
              <CharacterCardBadge character={char} />
            </div>
            <div>
              <div className={`font-bold ${theme.text}`}>{char}</div>
              <div className="text-sm text-coup-ink-mute">{CHARACTER_DESCRIPTIONS[char]}</div>
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
              <tr className="border-b border-coup-line/70 text-xs text-coup-ink-mute uppercase">
                <th className="py-2 pr-3">Action</th>
                <th className="py-2 pr-3">Cost</th>
                <th className="py-2 pr-3">Effect</th>
                <th className="py-2 pr-3">Claims</th>
                <th className="py-2">Blocked By</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              <tr className="border-b border-coup-line/40">
                <td className="py-2 pr-3 font-medium text-white">Income</td>
                <td className="py-2 pr-3">0</td>
                <td className="py-2 pr-3">+1 coin</td>
                <td className="py-2 pr-3 text-coup-ink-mute">&mdash;</td>
                <td className="py-2 text-coup-ink-mute">&mdash;</td>
              </tr>
              <tr className="border-b border-coup-line/40">
                <td className="py-2 pr-3 font-medium text-white">Foreign Aid</td>
                <td className="py-2 pr-3">0</td>
                <td className="py-2 pr-3">+2 coins</td>
                <td className="py-2 pr-3 text-coup-ink-mute">&mdash;</td>
                <td className="py-2 text-purple-300">Duke</td>
              </tr>
              <tr className="border-b border-coup-line/40">
                <td className="py-2 pr-3 font-medium text-white">Coup</td>
                <td className="py-2 pr-3">7</td>
                <td className="py-2 pr-3">Target loses influence</td>
                <td className="py-2 pr-3 text-coup-ink-mute">&mdash;</td>
                <td className="py-2 text-coup-ink-mute">&mdash;</td>
              </tr>
              <tr className="border-b border-coup-line/40">
                <td className="py-2 pr-3 font-medium text-purple-300">Tax</td>
                <td className="py-2 pr-3">0</td>
                <td className="py-2 pr-3">+3 coins</td>
                <td className="py-2 pr-3 text-purple-300">Duke</td>
                <td className="py-2 text-coup-ink-mute">&mdash;</td>
              </tr>
              <tr className="border-b border-coup-line/40">
                <td className="py-2 pr-3 font-medium text-gray-300">Assassinate</td>
                <td className="py-2 pr-3">3</td>
                <td className="py-2 pr-3">Target loses influence</td>
                <td className="py-2 pr-3 text-gray-300">Assassin</td>
                <td className="py-2 text-red-300">Contessa</td>
              </tr>
              <tr className="border-b border-coup-line/40">
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
                <td className="py-2 text-coup-ink-mute">&mdash;</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Challenging */}
      <div>
        <h3 className="text-coup-accent font-bold text-base mb-2">Challenging</h3>
        <p className="text-gray-400">
          Any player can challenge a claim, whether it&apos;s for an action or a block. If the
          claimer has the card, they show it, shuffle it into the deck and draw a new one, and
          the challenger loses an influence. If they don&apos;t, the claimer loses an influence.
        </p>
      </div>

      {/* Blocking */}
      <div>
        <h3 className="text-coup-accent font-bold text-base mb-2">Blocking</h3>
        <p className="text-gray-400">
          Some actions can be blocked by claiming the character that counters them. A block
          is a claim, so it can be challenged, and you can bluff it.
        </p>
      </div>

      {/* Forced Coup */}
      <div>
        <h3 className="text-coup-accent font-bold text-base mb-2">Forced Coup</h3>
        <p className="text-gray-400">
          If you start your turn with 10 or more coins, you must Coup.
        </p>
      </div>
    </div>
  );
}

function ReformationTab({
  onOpenWalkthrough,
  walkthroughTriggerRef,
}: {
  onOpenWalkthrough: () => void;
  walkthroughTriggerRef: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <div className="space-y-5 text-sm">
      <div>
        <h3 className="text-coup-accent font-bold text-base mb-2">What is Reformation?</h3>
        <p className="text-gray-400">
          Reformation is an expansion that adds factions, three actions (Convert, Embezzle
          and Examine) and the <span className="text-teal-300 font-medium">Inquisitor</span>.
          Turn it on in the lobby settings before the game starts.
        </p>
      </div>

      <div className="panel-sunk bg-coup-accent/15 p-3">
        <h3 className="text-coup-accent font-bold text-base mb-2">Quick start</h3>
        <ol className="list-decimal list-inside space-y-1.5 text-gray-300">
          <li>Check faction markers before targeting: <span className="text-blue-300 font-bold">▲ LOY</span> and <span className="text-red-300 font-bold">◆ REF</span>.</li>
          <li>Use Convert to fix targeting, rescue an ally, or put coins into the reserve.</li>
          <li>Only Embezzle when the reserve is worth the challenge risk.</li>
          <li>With the Inquisitor, Exchange draws 1 card instead of 2, and Examine shows you a player&apos;s card.</li>
        </ol>
        <button
          ref={walkthroughTriggerRef}
          type="button"
          className="mt-3 w-full rounded-lg border border-coup-accent/50 bg-coup-bg/50 px-3 py-2 text-sm font-bold text-coup-accent transition hover:bg-coup-accent/10"
          onClick={() => { haptic(80); onOpenWalkthrough(); }}
        >
          Open the walkthrough
        </button>
      </div>

      <div>
        <h3 className="text-coup-accent font-bold text-base mb-2">Factions</h3>
        <p className="text-gray-400 mb-2">
          Each player is a <span className="text-blue-300 font-medium">▲ Loyalist</span> or a{' '}
          <span className="text-red-300 font-medium">◆ Reformist</span>. You can&apos;t Coup,
          Assassinate, Steal from or Examine a player in your own faction. Once every player left
          is in one faction, anyone can target anyone. While both factions remain, only the other
          faction can block your Foreign Aid.
        </p>
      </div>

      <div>
        <h3 className="text-coup-accent font-bold text-base mb-2">New actions</h3>
        <div className="space-y-3 text-gray-400">
          <div>
            <span className="text-white font-medium">Convert:</span> pay 1 coin to switch your own
            faction, or 2 coins to switch another player&apos;s. The coins go to the Treasury Reserve.
            Nobody can challenge or block it.
          </div>
          <div>
            <span className="text-white font-medium">Embezzle:</span> take every coin in the
            Treasury Reserve by claiming you don&apos;t have a Duke. A challenge works the other way
            round: the challenger wins if you do have one.
          </div>
          <div>
            <span className="text-teal-300 font-medium">Examine:</span> claim the Inquisitor. Your
            target picks one of their face-down cards to show you. Then you return it, or make them
            swap it for a random card from the deck.
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-coup-accent font-bold text-base mb-2">Inquisitor</h3>
        <p className="text-gray-400">
          Replaces the Ambassador when it&apos;s turned on. The Inquisitor can Exchange (drawing
          1 card instead of 2), Examine another player&apos;s card, and block Steal like the Captain.
        </p>
      </div>

      <div>
        <h3 className="text-coup-accent font-bold text-base mb-2">Treasury Reserve</h3>
        <p className="text-gray-400">
          A pool of coins kept apart from the treasury. Convert payments go in, and Embezzle
          takes them all out.
        </p>
      </div>
    </div>
  );
}
