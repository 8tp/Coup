'use client';

import { useState, useEffect } from 'react';
import { Character } from '@/shared/types';
import { CHARACTER_SVG_ICONS, CardBack, CoinIcon } from '../icons';
import { haptic, hapticHeavy } from '../../utils/haptic';

interface TutorialProps {
  open: boolean;
  onClose: () => void;
}

const TOTAL_STEPS = 8;

function CharIcon({ char, size }: { char: Character; size: number }) {
  const Icon = CHARACTER_SVG_ICONS[char];
  return <Icon size={size} />;
}

const characterData = [
  {
    char: Character.Duke,
    bgClass: 'bg-purple-900/30',
    borderClass: 'border-purple-500/60',
    textClass: 'text-purple-300',
    action: 'Tax: +3 coins',
    blocks: 'Blocks Foreign Aid',
    desc: 'Wealth and influence',
  },
  {
    char: Character.Assassin,
    bgClass: 'bg-gray-800/30',
    borderClass: 'border-gray-500/60',
    textClass: 'text-gray-300',
    action: 'Assassinate: Pay 3, target loses a card',
    blocks: 'Cannot block',
    desc: 'Silent and deadly',
  },
  {
    char: Character.Captain,
    bgClass: 'bg-blue-900/30',
    borderClass: 'border-blue-500/60',
    textClass: 'text-blue-300',
    action: 'Steal: Take 2 coins from a target',
    blocks: 'Blocks Stealing',
    desc: 'Cunning and resourceful',
  },
  {
    char: Character.Ambassador,
    bgClass: 'bg-green-900/30',
    borderClass: 'border-green-500/60',
    textClass: 'text-green-300',
    action: 'Exchange: Swap cards with the deck',
    blocks: 'Blocks Stealing',
    desc: 'Diplomatic connections',
  },
  {
    char: Character.Contessa,
    bgClass: 'bg-red-900/30',
    borderClass: 'border-red-500/60',
    textClass: 'text-red-300',
    action: 'No action ability',
    blocks: 'Blocks Assassination',
    desc: 'The ultimate protector',
  },
];

export function Tutorial({ open, onClose }: TutorialProps) {
  const [step, setStep] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const [selectedChar, setSelectedChar] = useState(0);
  const [challengeChoice, setChallengeChoice] = useState<null | 'challenge' | 'pass'>(null);
  const [blockChoice, setBlockChoice] = useState<null | 'block'>(null);
  const [influenceRevealed, setInfluenceRevealed] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(0);
      setAnimKey(0);
      setSelectedChar(0);
      setChallengeChoice(null);
      setBlockChoice(null);
      setInfluenceRevealed(false);
    }
  }, [open]);

  useEffect(() => {
    if (step === 1) {
      setInfluenceRevealed(false);
      const timer = setTimeout(() => setInfluenceRevealed(true), 800);
      return () => clearTimeout(timer);
    }
  }, [step, animKey]);

  const goTo = (newStep: number) => {
    setStep(newStep);
    setAnimKey(k => k + 1);
    setChallengeChoice(null);
    setBlockChoice(null);
    haptic();
  };

  if (!open) return null;

  const next = () => goTo(Math.min(step + 1, TOTAL_STEPS - 1));
  const prev = () => goTo(Math.max(step - 1, 0));

  return (
    <div className="fixed inset-0 z-[60] bg-coup-bg flex flex-col">
      {/* Progress */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <div className="flex-1 flex gap-1">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                i <= step ? 'bg-coup-accent' : 'bg-gray-800'
              }`}
            />
          ))}
        </div>
        <button
          onClick={() => { haptic(); onClose(); }}
          className="text-gray-500 hover:text-white text-sm font-medium shrink-0"
        >
          Skip
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 overflow-y-auto">
        <div key={animKey} className="w-full max-w-sm animate-fade-in">
          {step === 0 && <WelcomeStep />}
          {step === 1 && <InfluenceStep revealed={influenceRevealed} />}
          {step === 2 && (
            <CharactersStep
              selected={selectedChar}
              onSelect={(i) => { haptic(); setSelectedChar(i); }}
            />
          )}
          {step === 3 && <ActionsStep />}
          {step === 4 && <BluffingStep />}
          {step === 5 && (
            <ChallengeStep
              choice={challengeChoice}
              onChoose={(c) => { hapticHeavy(); setChallengeChoice(c); }}
            />
          )}
          {step === 6 && (
            <BlockingStep
              choice={blockChoice}
              onChoose={() => { hapticHeavy(); setBlockChoice('block'); }}
            />
          )}
          {step === 7 && <ReadyStep />}
        </div>
      </div>

      {/* Navigation */}
      <div className="px-6 pb-6 pt-2 flex justify-center gap-3 max-w-sm mx-auto w-full">
        {step > 0 && (
          <button className="btn-secondary flex-1" onClick={prev}>
            Back
          </button>
        )}
        {step < TOTAL_STEPS - 1 ? (
          <button className={`btn-primary ${step === 0 ? 'w-full' : 'flex-1'}`} onClick={next}>
            {step === 0 ? "Let's Go" : 'Next'}
          </button>
        ) : (
          <button
            className="btn-primary flex-1"
            onClick={() => { haptic(80); onClose(); }}
          >
            Start Playing
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Step 0: Welcome ───

function WelcomeStep() {
  return (
    <div className="text-center">
      <div className="flex justify-center items-end gap-1 mb-8 h-28">
        {characterData.map((c, i) => {
          const rotation = (i - 2) * 10;
          const lift = Math.abs(i - 2) * 6;
          return (
            <div
              key={c.char}
              style={{
                opacity: 0,
                transform: `rotate(${rotation}deg) translateY(${lift}px)`,
                animation: `fadeIn 0.5s ease-out ${i * 0.1}s forwards`,
              }}
            >
              <div
                className={`w-14 h-20 rounded-lg border-2 ${c.borderClass} ${c.bgClass} flex items-center justify-center`}
              >
                <CharIcon char={c.char} size={28} />
              </div>
            </div>
          );
        })}
      </div>

      <h2 className="text-3xl font-bold text-white mb-3">Welcome to Coup</h2>
      <p className="text-gray-400 mb-2">The art of deception for 2-6 players</p>
      <p className="text-gray-500 text-sm">
        Bluff, challenge, and eliminate your opponents.
        <br />The last player standing wins.
      </p>
    </div>
  );
}

// ─── Step 1: Your Influence ───

function InfluenceStep({ revealed }: { revealed: boolean }) {
  return (
    <div className="text-center">
      <div className="flex justify-center gap-5 mb-8">
        {/* Card 1 - stays face-down */}
        <div className="relative">
          <div className="w-20 h-28 rounded-xl bg-coup-card border-2 border-coup-accent/50 flex items-center justify-center shadow-lg shadow-coup-accent/10">
            <CardBack size={40} />
          </div>
          <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs text-coup-accent font-bold whitespace-nowrap">
            Secret
          </div>
        </div>

        {/* Card 2 - flips to show it being "lost" */}
        <div className="relative" style={{ perspective: '600px' }}>
          <div
            className="w-20 h-28 rounded-xl transition-all"
            style={{
              transform: revealed ? 'rotateY(180deg)' : 'rotateY(0)',
              transformStyle: 'preserve-3d',
              transitionDuration: '0.7s',
            }}
          >
            {/* Front */}
            <div
              className="absolute inset-0 rounded-xl bg-coup-card border-2 border-coup-accent/50 flex items-center justify-center"
              style={{ backfaceVisibility: 'hidden' }}
            >
              <CardBack size={40} />
            </div>
            {/* Back - revealed/lost */}
            <div
              className="absolute inset-0 rounded-xl bg-gray-800/80 border-2 border-red-500/60 flex flex-col items-center justify-center"
              style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
            >
              <div className="opacity-40">
                <CharIcon char={Character.Duke} size={32} />
              </div>
              <div className="text-red-400 text-[10px] font-bold mt-1">REVEALED</div>
            </div>
          </div>
          <div
            className={`absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs font-bold whitespace-nowrap transition-colors duration-700 ${
              revealed ? 'text-red-400' : 'text-coup-accent'
            }`}
          >
            {revealed ? 'Lost!' : 'Secret'}
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-2xl font-bold text-white mb-3">Your Influence</h2>
        <p className="text-gray-400 text-sm mb-2">
          You start with <span className="text-white font-medium">2 secret cards</span> and{' '}
          <span className="text-coup-accent font-medium">2 coins</span>.
        </p>
        <p className="text-gray-500 text-sm">
          When a card is revealed, you lose that influence.
          <br />
          <span className="text-red-400">Lose both and you&apos;re eliminated.</span>
        </p>
      </div>
    </div>
  );
}

// ─── Step 2: Characters ───

function CharactersStep({ selected, onSelect }: { selected: number; onSelect: (i: number) => void }) {
  const c = characterData[selected];

  return (
    <div className="text-center">
      <h2 className="text-xl font-bold text-white mb-4">5 Characters</h2>

      {/* Selector row */}
      <div className="flex justify-center gap-2 mb-5">
        {characterData.map((ch, i) => {
          const isActive = i === selected;
          return (
            <button
              key={ch.char}
              onClick={() => onSelect(i)}
              className={`w-12 h-16 rounded-lg border-2 flex items-center justify-center transition-all duration-300 ${
                isActive
                  ? `${ch.borderClass} ${ch.bgClass} scale-110 shadow-lg`
                  : 'border-gray-700 bg-coup-card/50 opacity-50 hover:opacity-75'
              }`}
            >
              <CharIcon char={ch.char} size={24} />
            </button>
          );
        })}
      </div>

      {/* Detail card */}
      <div
        key={selected}
        className={`rounded-xl border-2 ${c.borderClass} ${c.bgClass} p-5 animate-fade-in`}
      >
        <div className="flex items-center justify-center gap-3 mb-3">
          <CharIcon char={c.char} size={40} />
          <div className="text-left">
            <div className={`text-xl font-bold ${c.textClass}`}>{c.char}</div>
            <div className="text-gray-500 text-xs">{c.desc}</div>
          </div>
        </div>
        <div className="space-y-2 text-sm text-left">
          <div className="flex items-start gap-2">
            <span className="text-coup-accent font-bold text-xs mt-0.5 shrink-0">ACTION</span>
            <span className="text-gray-300">{c.action}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-blue-400 font-bold text-xs mt-0.5 shrink-0">BLOCK</span>
            <span className="text-gray-300">{c.blocks}</span>
          </div>
        </div>
      </div>

      <p className="text-gray-600 text-xs mt-3">Tap each character to learn more</p>
    </div>
  );
}

// ─── Step 3: Actions ───

function ActionsStep() {
  const actions = [
    {
      name: 'Income',
      cost: null,
      effect: '+1 coin',
      tag: 'Always safe',
      tagColor: 'text-green-400',
      coins: 1,
    },
    {
      name: 'Foreign Aid',
      cost: null,
      effect: '+2 coins',
      tag: 'Duke can block',
      tagColor: 'text-yellow-400',
      coins: 2,
    },
    {
      name: 'Coup',
      cost: 7,
      effect: 'Target loses a card',
      tag: 'Forced at 10+',
      tagColor: 'text-red-400',
      coins: 0,
    },
  ];

  return (
    <div>
      <h2 className="text-xl font-bold text-white mb-1 text-center">Basic Actions</h2>
      <p className="text-gray-500 text-xs mb-4 text-center">No character claim needed</p>

      <div className="space-y-3 mb-5">
        {actions.map((a, i) => (
          <div
            key={a.name}
            className="flex items-center gap-3 bg-coup-card/60 border border-gray-700 rounded-xl p-3"
            style={{
              opacity: 0,
              animation: `fadeIn 0.3s ease-out ${i * 0.15}s forwards`,
            }}
          >
            <div className="w-10 h-10 rounded-lg bg-coup-bg flex items-center justify-center shrink-0">
              {a.coins > 0 ? (
                <div className="flex flex-wrap justify-center gap-0.5">
                  {Array.from({ length: a.coins }, (_, j) => (
                    <CoinIcon key={j} size={a.coins > 1 ? 14 : 18} />
                  ))}
                </div>
              ) : (
                <span className="text-lg">&#9876;</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-white font-bold text-sm">{a.name}</span>
                {a.cost && (
                  <span className="text-xs text-coup-accent">({a.cost} coins)</span>
                )}
              </div>
              <div className="text-gray-400 text-xs">{a.effect}</div>
            </div>
            <span className={`text-[10px] font-medium ${a.tagColor} shrink-0`}>{a.tag}</span>
          </div>
        ))}
      </div>

      <div className="border-t border-gray-800 pt-3">
        <p className="text-gray-500 text-xs text-center">
          Character actions (<span className="text-purple-300">Tax</span>,{' '}
          <span className="text-blue-300">Steal</span>,{' '}
          <span className="text-gray-300">Assassinate</span>,{' '}
          <span className="text-green-300">Exchange</span>) require claiming a role.
          <br />
          <span className="text-gray-400">Anyone can challenge the claim!</span>
        </p>
      </div>
    </div>
  );
}

// ─── Step 4: Bluffing ───

function BluffingStep() {
  const [showBluff, setShowBluff] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowBluff(true), 600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="text-center">
      <h2 className="text-2xl font-bold text-white mb-2">The Secret</h2>
      <p className="text-coup-accent font-bold text-lg mb-6">You can claim ANY character!</p>

      {/* Your hand */}
      <div className="mb-4">
        <p className="text-gray-500 text-xs mb-2">Your actual cards:</p>
        <div className="flex justify-center gap-3">
          <div className="w-14 h-20 rounded-lg border-2 border-blue-500/60 bg-blue-900/30 flex flex-col items-center justify-center">
            <CharIcon char={Character.Captain} size={22} />
            <span className="text-blue-300 text-[9px] font-bold mt-0.5">Captain</span>
          </div>
          <div className="w-14 h-20 rounded-lg border-2 border-red-500/60 bg-red-900/30 flex flex-col items-center justify-center">
            <CharIcon char={Character.Contessa} size={22} />
            <span className="text-red-300 text-[9px] font-bold mt-0.5">Contessa</span>
          </div>
        </div>
      </div>

      {/* Bluff */}
      <div
        className={`transition-all duration-500 ${
          showBluff ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        <div className="flex justify-center mb-1">
          <svg width="20" height="20" viewBox="0 0 20 20" className="text-gray-600">
            <path d="M10 4v8M10 16v-1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>

        <div className="inline-block bg-purple-900/40 border-2 border-purple-500/60 rounded-xl px-4 py-3 mb-3">
          <div className="flex items-center gap-2 justify-center">
            <CharIcon char={Character.Duke} size={24} />
            <span className="text-purple-300 font-bold">
              &quot;I have Duke &mdash; Tax!&quot;
            </span>
          </div>
          <div className="flex items-center justify-center gap-1 mt-2">
            <span className="text-coup-accent font-bold text-sm">+3</span>
            <CoinIcon size={14} />
            <CoinIcon size={14} />
            <CoinIcon size={14} />
          </div>
        </div>

        <p className="text-gray-400 text-sm">
          You don&apos;t have Duke, but <span className="text-white font-medium">no one knows!</span>
        </p>
        <p className="text-gray-500 text-xs mt-2">
          If no one challenges, the bluff works.
          <br />But if someone calls your bluff...
        </p>
      </div>
    </div>
  );
}

// ─── Step 5: Challenge (Interactive) ───

function ChallengeStep({
  choice,
  onChoose,
}: {
  choice: null | 'challenge' | 'pass';
  onChoose: (c: 'challenge' | 'pass') => void;
}) {
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    if (choice) {
      const timer = setTimeout(() => setShowResult(true), choice === 'challenge' ? 600 : 300);
      return () => clearTimeout(timer);
    }
    setShowResult(false);
  }, [choice]);

  return (
    <div className="text-center">
      <h2 className="text-xl font-bold text-white mb-4">Challenging</h2>

      <div className="bg-coup-card/60 border border-gray-700 rounded-xl p-4 mb-4">
        <p className="text-gray-400 text-sm mb-3">
          <span className="text-white font-bold">Alex</span> claims{' '}
          <span className="text-purple-300 font-bold">Duke</span> for Tax...
        </p>

        {/* Alex's card */}
        <div className="flex justify-center mb-3" style={{ perspective: '600px' }}>
          <div
            className="w-16 h-[5.5rem] relative rounded-lg transition-all"
            style={{
              transform: choice === 'challenge' ? 'rotateY(180deg)' : 'rotateY(0)',
              transformStyle: 'preserve-3d',
              transitionDuration: '0.6s',
            }}
          >
            {/* Front */}
            <div
              className="absolute inset-0 rounded-lg bg-coup-card border-2 border-gray-600 flex items-center justify-center"
              style={{ backfaceVisibility: 'hidden' }}
            >
              <CardBack size={32} />
            </div>
            {/* Back - Captain revealed (not Duke!) */}
            <div
              className="absolute inset-0 rounded-lg bg-blue-900/40 border-2 border-red-500 flex flex-col items-center justify-center"
              style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
            >
              <CharIcon char={Character.Captain} size={28} />
              <span className="text-blue-300 text-[10px] font-bold mt-0.5">Captain</span>
            </div>
          </div>
        </div>

        {/* Buttons or result */}
        {!choice && (
          <div>
            <p className="text-gray-500 text-xs mb-3">Do you think Alex is bluffing?</p>
            <div className="flex gap-2">
              <button
                className="flex-1 bg-red-600 text-white font-bold py-2.5 px-3 rounded-xl text-sm active:scale-95 transition-transform animate-pulse-gold"
                onClick={() => onChoose('challenge')}
              >
                Challenge!
              </button>
              <button
                className="flex-1 bg-coup-card text-gray-300 font-bold py-2.5 px-3 rounded-xl text-sm border border-gray-600 active:scale-95 transition-transform"
                onClick={() => onChoose('pass')}
              >
                Let it go
              </button>
            </div>
          </div>
        )}

        {choice === 'challenge' && (
          <div className={`transition-all duration-500 ${showResult ? 'opacity-100' : 'opacity-0'}`}>
            <p className="text-red-400 font-bold mb-1">Caught bluffing!</p>
            <p className="text-gray-400 text-xs">
              Alex doesn&apos;t have Duke &mdash; Alex loses an influence!
            </p>
          </div>
        )}

        {choice === 'pass' && (
          <div className={`transition-all duration-500 ${showResult ? 'opacity-100' : 'opacity-0'}`}>
            <p className="text-coup-accent font-bold mb-1">Alex takes 3 coins</p>
            <p className="text-gray-400 text-xs">
              Were they bluffing? You&apos;ll never know...
            </p>
          </div>
        )}
      </div>

      <div className="text-xs text-gray-500">
        {choice === 'challenge' ? (
          <p>
            But beware &mdash; if Alex <span className="text-white">really had Duke</span>,{' '}
            <span className="text-red-400">you</span> would lose an influence instead!
          </p>
        ) : choice === 'pass' ? (
          <p>
            Sometimes it&apos;s safer to let it go.
            <br />A wrong challenge costs <span className="text-red-400">you</span> an influence!
          </p>
        ) : (
          <p>Any player can challenge when someone claims a character.</p>
        )}
      </div>
    </div>
  );
}

// ─── Step 6: Blocking (Interactive) ───

function BlockingStep({
  choice,
  onChoose,
}: {
  choice: null | 'block';
  onChoose: () => void;
}) {
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    if (choice) {
      const timer = setTimeout(() => setShowResult(true), 400);
      return () => clearTimeout(timer);
    }
    setShowResult(false);
  }, [choice]);

  return (
    <div className="text-center">
      <h2 className="text-xl font-bold text-white mb-4">Blocking</h2>

      <div className="bg-coup-card/60 border border-gray-700 rounded-xl p-4 mb-4">
        {/* Attack visualization */}
        <div className="flex items-center justify-between mb-4 px-2">
          <div className="text-left">
            <p className="text-white font-bold text-sm">Alex</p>
            <p className="text-gray-500 text-xs">Assassinates</p>
          </div>
          <div
            className={`text-2xl transition-all duration-500 ${
              choice ? 'opacity-20 scale-75' : 'opacity-100'
            }`}
          >
            <span className={choice ? '' : 'inline-block animate-pulse'}>&#9876;&#65039;</span>
          </div>
          <div className="text-right">
            <p className="text-coup-accent font-bold text-sm">You</p>
            <p className="text-gray-500 text-xs">Targeted!</p>
          </div>
        </div>

        {/* Shield appears when blocked */}
        {choice && showResult && (
          <div className="flex justify-center mb-3 animate-fade-in">
            <div className="flex items-center gap-2 bg-red-900/30 border border-red-500/40 rounded-lg px-3 py-2">
              <CharIcon char={Character.Contessa} size={20} />
              <span className="text-red-300 font-bold text-sm">Blocked with Contessa!</span>
            </div>
          </div>
        )}

        {!choice ? (
          <button
            className="w-full bg-red-900/50 border-2 border-red-500 text-red-200 font-bold py-3 rounded-xl text-sm active:scale-95 transition-all hover:bg-red-900/70 animate-pulse-gold"
            onClick={onChoose}
          >
            Block with Contessa!
          </button>
        ) : showResult ? (
          <p className="text-green-400 text-sm font-medium animate-fade-in">
            Assassination prevented!
          </p>
        ) : null}
      </div>

      {/* Block reference */}
      <div className="text-xs text-gray-500 space-y-2">
        <p>
          Some actions can be <span className="text-white">blocked</span> by claiming a counter-character:
        </p>
        <div className="bg-coup-card/40 rounded-lg p-2.5 text-left space-y-1.5">
          <div><span className="text-purple-300 font-medium">Duke</span> blocks Foreign Aid</div>
          <div><span className="text-red-300 font-medium">Contessa</span> blocks Assassination</div>
          <div>
            <span className="text-blue-300 font-medium">Captain</span>{' / '}
            <span className="text-green-300 font-medium">Ambassador</span> block Stealing
          </div>
        </div>
        {choice && (
          <p className="text-gray-400 animate-fade-in">
            Blocks are also claims &mdash; they can be challenged!
            <br />You can even <span className="text-coup-accent">bluff a block</span>.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Step 7: Ready ───

function ReadyStep() {
  return (
    <div className="text-center">
      <h2 className="text-2xl font-bold text-white mb-2">You&apos;re Ready!</h2>
      <p className="text-gray-400 text-sm mb-5">Quick reference:</p>

      <div className="space-y-2 mb-5">
        {characterData.map((c, i) => (
          <div
            key={c.char}
            className={`flex items-center gap-3 ${c.bgClass} border ${c.borderClass} rounded-lg p-2.5`}
            style={{
              opacity: 0,
              animation: `fadeIn 0.3s ease-out ${i * 0.08}s forwards`,
            }}
          >
            <CharIcon char={c.char} size={24} />
            <div className="text-left flex-1 min-w-0">
              <span className={`font-bold text-sm ${c.textClass}`}>{c.char}</span>
              <div className="text-gray-400 text-xs truncate">{c.action}</div>
            </div>
            <div className="text-[10px] text-gray-500 shrink-0 text-right max-w-[80px]">
              {c.blocks}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-coup-accent/10 border border-coup-accent/30 rounded-xl p-3">
        <p className="text-coup-accent font-bold text-sm mb-1">Remember</p>
        <p className="text-gray-400 text-xs">
          Bluffing is not just allowed &mdash; it&apos;s essential!
          <br />Read your opponents. Trust no one.
        </p>
      </div>
    </div>
  );
}
